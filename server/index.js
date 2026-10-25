import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {z} from 'zod';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {config} from './config.js';
import {pool,transaction,audit} from './db.js';
import {runReminders} from './reminders.js';
export const app=express();
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:'],upgradeInsecureRequests:null}}}));
app.use(express.json({limit:'100kb'}));
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
const idSchema=z.coerce.number().int().positive();
const id=req=>idSchema.parse(req.params.id);
const text=z.string().trim().min(1).max(250);
const money=z.number().int().min(0).max(100000000);
const instant=z.string().datetime({offset:true});
const patientSchema=z.object({first_name:text,last_name:text,birth_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&v>='0001-01-01'&&new Date(v).toISOString().slice(0,10)===v&&v<=new Date().toISOString().slice(0,10),'Fecha de nacimiento inválida'),phone:z.string().trim().min(7).max(25),address:text,email:z.string().trim().email().max(250),reminder_consent:z.boolean()});
const treatmentSchema=z.object({name:text,description:z.string().trim().min(1).max(2000),price_cents:money,duration_minutes:z.number().int().min(5).max(480)});
const appointmentSchema=z.object({patient_id:idSchema,dentist_id:idSchema,treatment_id:idSchema,starts_at:instant});
const procedureSchema=z.object({patient_id:idSchema,treatment_id:idSchema,appointment_id:idSchema.nullable().optional(),performed_at:instant,notes:z.string().trim().min(3).max(10000)});
const billingRoles=['admin','reception'];
const clinicalRoles=['admin','dentist'];
const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({error:'No tienes permiso para esta operación.'});
app.get('/api/health',async(req,res)=>{await pool.query('SELECT 1');res.json({status:'ok',environment:config.env});});
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false,message:{error:'Demasiados intentos. Espera 15 minutos.'}});
app.post('/api/auth/login',loginLimiter,async(req,res)=>{
 const b=z.object({email:z.string().email(),password:z.string().min(1).max(200)}).parse(req.body);
 const user=(await pool.query('SELECT * FROM users WHERE lower(email)=lower($1) AND active',[b.email])).rows[0];
 if(!user||!await bcrypt.compare(b.password,user.password_hash))fail(401,'Correo o contraseña incorrectos.');
 const token=jwt.sign({sub:String(user.id)},config.jwtSecret,{expiresIn:'8h',issuer:`dentalgest:${config.env}`,audience:'dentalgest-web'});
 await audit(pool,user,'login','users',user.id);
 res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role},environment:config.env});
});
app.use('/api',async(req,res,next)=>{
 try{
 const token=req.headers.authorization?.replace(/^Bearer /,'');
 const payload=jwt.verify(token,config.jwtSecret,{issuer:`dentalgest:${config.env}`,audience:'dentalgest-web'});
 const user=(await pool.query('SELECT id,name,email,role FROM users WHERE id=$1 AND active',[payload.sub])).rows[0];
 if(!user)fail(401,'Sesión no válida.');req.user=user;next();
 }catch{res.status(401).json({error:'Tu sesión expiró. Inicia sesión nuevamente.'});}
});
app.get('/api/me',(req,res)=>res.json({user:req.user,environment:config.env,notificationMode:config.notificationMode}));
app.get('/api/data',async(req,res)=>{
 const [patients,treatments,dentists,appointments,procedures,invoices,notifications]=await Promise.all([
 pool.query('SELECT * FROM patients ORDER BY last_name,first_name'),
 pool.query('SELECT * FROM treatments ORDER BY name'),
 pool.query("SELECT id,name FROM users WHERE role='dentist' AND active ORDER BY name"),
 pool.query(`SELECT a.*,p.first_name||' '||p.last_name patient_name,u.name dentist_name,t.name treatment_name FROM appointments a JOIN patients p ON p.id=a.patient_id JOIN users u ON u.id=a.dentist_id JOIN treatments t ON t.id=a.treatment_id WHERE ($1::int IS NULL OR a.dentist_id=$1) ORDER BY starts_at DESC`,[req.user.role==='dentist'?req.user.id:null]),
 pool.query(`SELECT pr.id,pr.patient_id,pr.dentist_id,pr.treatment_id,pr.appointment_id,pr.performed_at,pr.price_cents,CASE WHEN $1 THEN pr.notes ELSE NULL END notes,p.first_name||' '||p.last_name patient_name,t.name treatment_name,u.name dentist_name,EXISTS(SELECT 1 FROM invoice_items it WHERE it.procedure_id=pr.id AND NOT it.released) invoiced FROM procedures pr JOIN patients p ON p.id=pr.patient_id JOIN treatments t ON t.id=pr.treatment_id JOIN users u ON u.id=pr.dentist_id ORDER BY pr.performed_at DESC`,[clinicalRoles.includes(req.user.role)]),
 billingRoles.includes(req.user.role)?pool.query(`SELECT i.*,p.first_name||' '||p.last_name patient_name,COALESCE((SELECT sum(amount_cents) FROM invoice_items WHERE invoice_id=i.id),0)::bigint total_cents,COALESCE((SELECT sum(amount_cents) FROM payments WHERE invoice_id=i.id),0)::bigint paid_cents FROM invoices i JOIN patients p ON p.id=i.patient_id ORDER BY i.id DESC`):Promise.resolve({rows:[]}),
 billingRoles.includes(req.user.role)?pool.query('SELECT * FROM notifications ORDER BY id DESC LIMIT 200'):Promise.resolve({rows:[]})
 ]);
 res.json({patients:patients.rows,treatments:treatments.rows,dentists:dentists.rows,appointments:appointments.rows,procedures:procedures.rows,invoices:invoices.rows.map(i=>({...i,total_cents:Number(i.total_cents),paid_cents:Number(i.paid_cents)})),notifications:notifications.rows});
});
app.post('/api/patients',roles(...billingRoles),async(req,res)=>{
 const b=patientSchema.parse(req.body);
 const row=await transaction(async db=>{const r=(await db.query('INSERT INTO patients(first_name,last_name,birth_date,phone,address,email,reminder_consent) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',Object.values(b))).rows[0];await audit(db,req.user,'crear','patients',r.id);return r;});res.status(201).json(row);
});
app.put('/api/patients/:id',roles(...billingRoles),async(req,res)=>{
 const b=patientSchema.parse(req.body),pid=id(req);
 const row=await transaction(async db=>{
 const r=(await db.query('UPDATE patients SET first_name=$1,last_name=$2,birth_date=$3,phone=$4,address=$5,email=$6,reminder_consent=$7 WHERE id=$8 RETURNING *',[...Object.values(b),pid])).rows[0];
 if(!r)fail(404,'Paciente no encontrado.');
 if(!r.reminder_consent)await db.query("UPDATE notifications SET status='cancelled' WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id=$1) AND status IN ('pending','failed')",[pid]);
 await audit(db,req.user,'editar','patients',pid);return r;
 });res.json(row);
});
app.delete('/api/patients/:id',roles(...billingRoles),async(req,res)=>{
 const pid=id(req);
 const result=await transaction(async db=>{
 if(!(await db.query('SELECT id FROM patients WHERE id=$1 FOR UPDATE',[pid])).rowCount)fail(404,'Paciente no encontrado.');
 const references=(await db.query('SELECT (EXISTS(SELECT 1 FROM appointments WHERE patient_id=$1) OR EXISTS(SELECT 1 FROM procedures WHERE patient_id=$1) OR EXISTS(SELECT 1 FROM invoices WHERE patient_id=$1)) used',[pid])).rows[0].used;
 if(references){await db.query('UPDATE patients SET active=false WHERE id=$1',[pid]);await db.query("UPDATE notifications SET status='cancelled' WHERE appointment_id IN(SELECT id FROM appointments WHERE patient_id=$1) AND status IN('pending','failed')",[pid]);}
 else await db.query('DELETE FROM patients WHERE id=$1',[pid]);
 await audit(db,req.user,references?'desactivar':'eliminar','patients',pid);return {message:references?'Paciente desactivado; historial conservado.':'Paciente eliminado.'};
 });res.json(result);
});
app.post('/api/patients/:id/restore',roles(...billingRoles),async(req,res)=>{
 const r=await transaction(async db=>{const row=(await db.query('UPDATE patients SET active=true WHERE id=$1 RETURNING id',[id(req)])).rows[0];if(!row)fail(404,'Paciente no encontrado.');await audit(db,req.user,'reactivar','patients',row.id);return row;});res.json(r);
});
app.post('/api/treatments',roles('admin'),async(req,res)=>{
 const b=treatmentSchema.parse(req.body);
 const row=await transaction(async db=>{const r=(await db.query('INSERT INTO treatments(name,description,price_cents,duration_minutes) VALUES($1,$2,$3,$4) RETURNING *',Object.values(b))).rows[0];await audit(db,req.user,'crear','treatments',r.id);return r;});res.status(201).json(row);
});
app.put('/api/treatments/:id',roles('admin'),async(req,res)=>{
 const b=treatmentSchema.extend({active:z.boolean()}).parse(req.body);
 const row=await transaction(async db=>{const r=(await db.query('UPDATE treatments SET name=$1,description=$2,price_cents=$3,duration_minutes=$4,active=$5 WHERE id=$6 RETURNING *',[...Object.values(b),id(req)])).rows[0];if(!r)fail(404,'Tratamiento no encontrado.');await audit(db,req.user,'editar','treatments',r.id);return r;});res.json(row);
});
async function schedule(db,b,actor,appointmentId=null){
 if(actor.role==='dentist'&&b.dentist_id!==actor.id)fail(403,'Solo puedes gestionar tu propia agenda.');
 if(new Date(b.starts_at)<=new Date())fail(400,'La cita debe programarse en el futuro.');
 const patient=(await db.query('SELECT * FROM patients WHERE id=$1 AND active FOR SHARE',[b.patient_id])).rows[0];
 const dentist=(await db.query("SELECT id FROM users WHERE id=$1 AND role='dentist' AND active FOR SHARE",[b.dentist_id])).rows[0];
 const treatment=(await db.query('SELECT * FROM treatments WHERE id=$1 AND active FOR SHARE',[b.treatment_id])).rows[0];
 if(!patient||!dentist||!treatment)fail(400,'Selecciona paciente, dentista y tratamiento activos.');
 const end=new Date(+new Date(b.starts_at)+treatment.duration_minutes*60000);
 let row;
 if(appointmentId){
 const previous=(await db.query('SELECT * FROM appointments WHERE id=$1 FOR UPDATE',[appointmentId])).rows[0];
 if(!previous)fail(404,'Cita no encontrada.');
 if(actor.role==='dentist'&&previous.dentist_id!==actor.id)fail(403,'No puedes editar otra agenda.');
 if(!['scheduled','confirmed'].includes(previous.status))fail(409,'La cita ya está cerrada.');
 row=(await db.query("UPDATE appointments SET patient_id=$1,dentist_id=$2,treatment_id=$3,starts_at=$4,ends_at=$5,status='scheduled' WHERE id=$6 RETURNING *",[b.patient_id,b.dentist_id,b.treatment_id,b.starts_at,end,appointmentId])).rows[0];
 await db.query("UPDATE notifications SET status='cancelled' WHERE appointment_id=$1 AND status IN ('pending','failed')",[appointmentId]);
 }else row=(await db.query('INSERT INTO appointments(patient_id,dentist_id,treatment_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING *',[b.patient_id,b.dentist_id,b.treatment_id,b.starts_at,end])).rows[0];
 if(patient.reminder_consent)await db.query('INSERT INTO notifications(appointment_id,scheduled_at) VALUES($1,$2)',[row.id,new Date(Math.max(Date.now(),+new Date(b.starts_at)-86400000))]);
 await audit(db,actor,appointmentId?'reprogramar':'crear','appointments',row.id);return row;
}
app.post('/api/appointments',async(req,res)=>res.status(201).json(await transaction(db=>schedule(db,appointmentSchema.parse(req.body),req.user))));
app.put('/api/appointments/:id',async(req,res)=>res.json(await transaction(db=>schedule(db,appointmentSchema.parse(req.body),req.user,id(req)))));
app.patch('/api/appointments/:id/status',async(req,res)=>{
 const b=z.object({status:z.enum(['confirmed','cancelled','no_show','attended']),reason:z.string().trim().max(1000).optional()}).parse(req.body);
 if(b.status==='attended'&&!clinicalRoles.includes(req.user.role))fail(403,'Solo el personal clínico finaliza la atención.');
 const row=await transaction(async db=>{
 const a=(await db.query('SELECT * FROM appointments WHERE id=$1 FOR UPDATE',[id(req)])).rows[0];
 if(!a)fail(404,'Cita no encontrada.');if(req.user.role==='dentist'&&a.dentist_id!==req.user.id)fail(403,'Solo puedes gestionar tu agenda.');
 if(!['scheduled','confirmed'].includes(a.status))fail(409,'La cita ya está cerrada.');
 if(b.status==='cancelled'&&!b.reason)fail(400,'Indica el motivo de cancelación.');
 if(['attended','no_show'].includes(b.status)&&new Date(a.starts_at)>new Date())fail(400,'La cita todavía no ha comenzado.');
 if(b.status==='attended'&&!(await db.query('SELECT id FROM procedures WHERE appointment_id=$1',[a.id])).rowCount)fail(400,'Registra al menos un procedimiento antes de finalizar.');
 const r=(await db.query('UPDATE appointments SET status=$2,cancellation_reason=$3 WHERE id=$1 RETURNING *',[a.id,b.status,b.reason||null])).rows[0];
 if(b.status!=='confirmed')await db.query("UPDATE notifications SET status='cancelled' WHERE appointment_id=$1 AND status IN('pending','failed')",[a.id]);
 await audit(db,req.user,b.status,'appointments',a.id);return r;
 });res.json(row);
});
app.post('/api/procedures',roles(...clinicalRoles),async(req,res)=>{
 const b=procedureSchema.parse(req.body);
 if(new Date(b.performed_at)>new Date())fail(400,'El procedimiento no puede tener fecha futura.');
 const row=await transaction(async db=>{
 if(!(await db.query('SELECT id FROM patients WHERE id=$1 AND active FOR SHARE',[b.patient_id])).rowCount)fail(400,'Paciente inactivo o inexistente.');
 const t=(await db.query('SELECT * FROM treatments WHERE id=$1 AND active FOR SHARE',[b.treatment_id])).rows[0];if(!t)fail(400,'Tratamiento no disponible.');
 let dentist=req.user.id;
 if(req.user.role==='admin')dentist=idSchema.parse(req.body.dentist_id);
 if(!(await db.query("SELECT id FROM users WHERE id=$1 AND role='dentist' AND active FOR SHARE",[dentist])).rowCount)fail(400,'Dentista inválido.');
 if(b.appointment_id){const a=(await db.query('SELECT * FROM appointments WHERE id=$1 FOR SHARE',[b.appointment_id])).rows[0];if(!a||a.patient_id!==b.patient_id||a.dentist_id!==dentist||!['scheduled','confirmed'].includes(a.status)||new Date(a.starts_at)>new Date(b.performed_at))fail(400,'La cita no coincide con la atención o todavía no ha comenzado.');}
 const r=(await db.query('INSERT INTO procedures(patient_id,dentist_id,treatment_id,appointment_id,performed_at,notes,price_cents) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[b.patient_id,dentist,b.treatment_id,b.appointment_id||null,b.performed_at,b.notes,t.price_cents])).rows[0];
 await audit(db,req.user,'registrar','procedures',r.id);return r;
 });res.status(201).json(row);
});
app.post('/api/invoices',roles(...billingRoles),async(req,res)=>{
 const b=z.object({patient_id:idSchema,procedure_ids:z.array(idSchema).min(1).max(100).refine(a=>new Set(a).size===a.length)}).parse(req.body);
 const row=await transaction(async db=>{
 const procedures=(await db.query('SELECT pr.*,t.name FROM procedures pr JOIN treatments t ON t.id=pr.treatment_id WHERE pr.id=ANY($1::int[]) AND pr.patient_id=$2 ORDER BY pr.id FOR UPDATE OF pr',[b.procedure_ids,b.patient_id])).rows;
 if(procedures.length!==b.procedure_ids.length)fail(400,'Los procedimientos deben pertenecer al paciente seleccionado.');
 if((await db.query('SELECT 1 FROM invoice_items WHERE procedure_id=ANY($1::int[]) AND NOT released',[b.procedure_ids])).rowCount)fail(409,'Un procedimiento ya está facturado.');
 const r=(await db.query('INSERT INTO invoices(patient_id) VALUES($1) RETURNING *',[b.patient_id])).rows[0];
 for(const p of procedures)await db.query('INSERT INTO invoice_items(invoice_id,procedure_id,description,amount_cents) VALUES($1,$2,$3,$4)',[r.id,p.id,p.name,p.price_cents]);
 await audit(db,req.user,'emitir','invoices',r.id);return r;
 });res.status(201).json(row);
});
app.get('/api/invoices/:id',roles(...billingRoles),async(req,res)=>{
 const invoice=(await pool.query("SELECT i.*,p.first_name||' '||p.last_name patient_name,p.address,p.email FROM invoices i JOIN patients p ON p.id=i.patient_id WHERE i.id=$1",[id(req)])).rows[0];if(!invoice)fail(404,'Factura no encontrada.');
 const items=(await pool.query('SELECT * FROM invoice_items WHERE invoice_id=$1 ORDER BY id',[invoice.id])).rows;
 const payments=(await pool.query('SELECT * FROM payments WHERE invoice_id=$1 ORDER BY id',[invoice.id])).rows;
 res.json({...invoice,items,payments});
});
app.post('/api/invoices/:id/payments',roles(...billingRoles),async(req,res)=>{
 const b=z.object({amount_cents:money.refine(v=>v>0),method:z.enum(['cash','card','transfer']),reference:z.string().trim().max(250).default(''),idempotency_key:z.string().uuid()}).parse(req.body);
 const row=await transaction(async db=>{
 const inv=(await db.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[id(req)])).rows[0];if(!inv)fail(404,'Factura no encontrada.');
 const previous=(await db.query('SELECT * FROM payments WHERE idempotency_key=$1',[b.idempotency_key])).rows[0];
 if(previous){if(previous.invoice_id!==inv.id||previous.amount_cents!==b.amount_cents||previous.method!==b.method||previous.reference!==b.reference)fail(409,'La clave de pago ya fue utilizada para otra operación.');return previous;}
 if(inv.voided)fail(409,'La factura está anulada.');
 const total=Number((await db.query('SELECT COALESCE(sum(amount_cents),0) total FROM invoice_items WHERE invoice_id=$1',[inv.id])).rows[0].total);
 const paid=Number((await db.query('SELECT COALESCE(sum(amount_cents),0) total FROM payments WHERE invoice_id=$1',[inv.id])).rows[0].total);
 if(b.amount_cents>total-paid)fail(400,'El pago supera el saldo pendiente.');
 const r=(await db.query('INSERT INTO payments(invoice_id,amount_cents,method,reference,idempotency_key,user_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[inv.id,b.amount_cents,b.method,b.reference,b.idempotency_key,req.user.id])).rows[0];await audit(db,req.user,'pagar','invoices',inv.id);return r;
 });res.status(201).json(row);
});
app.post('/api/invoices/:id/void',roles('admin'),async(req,res)=>{
 const reason=text.parse(req.body.reason);
 await transaction(async db=>{
 const i=(await db.query('SELECT * FROM invoices WHERE id=$1 FOR UPDATE',[id(req)])).rows[0];if(!i)fail(404,'Factura no encontrada.');if(i.voided)fail(409,'La factura ya está anulada.');
 if((await db.query('SELECT 1 FROM payments WHERE invoice_id=$1',[i.id])).rowCount)fail(409,'No se puede anular una factura que tiene pagos.');
 await db.query('UPDATE invoices SET voided=true,void_reason=$2 WHERE id=$1',[i.id,reason]);await db.query('UPDATE invoice_items SET released=true WHERE invoice_id=$1',[i.id]);await audit(db,req.user,'anular','invoices',i.id);
 });res.json({message:'Factura anulada.'});
});
app.get('/api/users',roles('admin'),async(req,res)=>res.json((await pool.query('SELECT id,name,email,role,active FROM users ORDER BY id')).rows));
const userSchema=z.object({name:text,email:z.string().trim().email().transform(s=>s.toLowerCase()),role:z.enum(['admin','reception','dentist']),password:z.string().min(12).max(100)});
app.post('/api/users',roles('admin'),async(req,res)=>{
 const b=userSchema.parse(req.body);const hash=await bcrypt.hash(b.password,12);
 const r=await transaction(async db=>{const u=(await db.query('INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) RETURNING id,name,email,role,active',[b.name,b.email,b.role,hash])).rows[0];await audit(db,req.user,'crear','users',u.id);return u;});res.status(201).json(r);
});
app.put('/api/users/:id',roles('admin'),async(req,res)=>{
 const b=userSchema.omit({password:true}).extend({active:z.boolean(),password:z.string().min(12).max(100).optional()}).parse(req.body);
 if(id(req)===req.user.id&&(!b.active||b.role!=='admin'))fail(400,'No puedes quitarte tu propio acceso de administrador.');
 const hash=b.password?await bcrypt.hash(b.password,12):null;
 const r=await transaction(async db=>{
 const old=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[id(req)])).rows[0];if(!old)fail(404,'Usuario no encontrado.');
 if(old.role==='dentist'&&(!b.active||b.role!=='dentist')&&(await db.query("SELECT 1 FROM appointments WHERE dentist_id=$1 AND status IN('scheduled','confirmed')",[old.id])).rowCount)fail(409,'Reasigna o cancela las citas pendientes de este dentista.');
 const u=(await db.query('UPDATE users SET name=$1,email=$2,role=$3,active=$4,password_hash=COALESCE($5,password_hash) WHERE id=$6 RETURNING id,name,email,role,active',[b.name,b.email,b.role,b.active,hash,old.id])).rows[0];await audit(db,req.user,'editar','users',u.id);return u;
 });res.json(r);
});
app.get('/api/audit',roles('admin'),async(req,res)=>res.json((await pool.query('SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 300')).rows));
app.post('/api/notifications/run',roles(...billingRoles),async(req,res)=>res.json(await runReminders()));
app.use('/api',(req,res)=>res.status(404).json({error:'Ruta no encontrada.'}));
app.use(express.static(path.resolve('dist')));
app.get('/{*path}',(req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.use((err,req,res,next)=>{
 if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});
 const codes={'23P01':[409,'El paciente o dentista ya tiene una cita en ese horario.'],'23505':[409,'El registro ya existe o ya fue facturado.'],'23503':[409,'El registro está relacionado con otros datos.'],'23514':[400,'Los datos no cumplen las reglas de integridad.']};
 const mapped=codes[err.code];const status=mapped?.[0]||err.status||500;
 if(status===500)console.error(err);
 res.status(status).json({error:mapped?.[1]||(status===500?'Error interno. Revisa el registro del servidor.':err.message)});
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=app.listen(config.port,'127.0.0.1',()=>console.log(`DentalGest ${config.env}: http://127.0.0.1:${config.port}`));
 const timer=setInterval(()=>runReminders().catch(e=>console.error('Recordatorios:',e.message)),60000);timer.unref();
 const stop=()=>{clearInterval(timer);server.close(async()=>{await pool.end();process.exit(0);});};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
