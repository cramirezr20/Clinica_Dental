import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
process.env.APP_ENV='test';
const {app}=await import('../server/index.js');
const {pool}=await import('../server/db.js');
const {runReminders}=await import('../server/reminders.js');
let server,base,admin,reception,dentist,patient,treatment,dentistId,appointment,procedure,invoice;
async function call(route,method='GET',body,token=admin){const response=await fetch(base+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
const patientData={first_name:'Prueba',last_name:'Integración',birth_date:'1995-03-04',phone:'5555-9999',address:'Datos ficticios de prueba',email:'prueba@example.com',reminder_consent:true};
before(async()=>{
 assert.equal(new URL(process.env.DATABASE_URL).pathname,'/dentalgest_test','Las pruebas solo pueden usar dentalgest_test');
 await pool.query('TRUNCATE patients,treatments,appointments,procedures,invoices,invoice_items,payments,notifications,audit_log RESTART IDENTITY CASCADE');
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
 for(const [mail,password,key] of [['admin','Admin.Dental2026!','admin'],['recepcion','Recepcion.Dental2026!','reception'],['dentista','Dentista.Dental2026!','dentist']]){
 const r=await call('/auth/login','POST',{email:`${mail}@dentalgest.local`,password},null);assert.equal(r.status,200);if(key==='admin')admin=r.body.token;if(key==='reception')reception=r.body.token;if(key==='dentist'){dentist=r.body.token;dentistId=r.body.user.id;}
 }
});
after(async()=>{await new Promise(r=>server.close(r));await pool.end();});
test('Rechaza credenciales incorrectas y acceso anónimo',async()=>{
 assert.equal((await call('/auth/login','POST',{email:'admin@dentalgest.local',password:'incorrecta'},null)).status,401);
 assert.equal((await call('/data','GET',undefined,null)).status,401);
});
test('Permisos de catálogo y administración',async()=>{
 assert.equal((await call('/users','GET',undefined,reception)).status,403);
 assert.equal((await call('/treatments','POST',{name:'Limpieza prueba',description:'Tratamiento de prueba',price_cents:30000,duration_minutes:30},reception)).status,403);
 const r=await call('/treatments','POST',{name:'Limpieza prueba',description:'Tratamiento de prueba',price_cents:30000,duration_minutes:30});assert.equal(r.status,201);treatment=r.body;
});
test('Crea, valida y edita paciente',async()=>{
 assert.equal((await call('/patients','POST',{...patientData,birth_date:'2999-01-01'},reception)).status,400);
 assert.equal((await call('/patients','POST',{...patientData,birth_date:'2024-02-31'},reception)).status,400);
 const r=await call('/patients','POST',patientData,reception);assert.equal(r.status,201);patient=r.body;
 assert.equal((await call(`/patients/${patient.id}`,'PUT',{...patientData,phone:'5555-8888'},reception)).status,200);
});
test('Concurrencia de citas: solo una reserva gana',async()=>{
 const starts_at=new Date(Date.now()+3*86400000).toISOString();
 const results=await Promise.all([1,2].map(()=>call('/appointments','POST',{patient_id:patient.id,dentist_id:dentistId,treatment_id:treatment.id,starts_at})));
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);appointment=results.find(r=>r.status===201).body;
});
test('Reprograma cita y cancela el recordatorio anterior',async()=>{
 const r=await call(`/appointments/${appointment.id}`,'PUT',{patient_id:patient.id,dentist_id:dentistId,treatment_id:treatment.id,starts_at:new Date(Date.now()+4*86400000).toISOString()});assert.equal(r.status,200);
 const statuses=(await pool.query('SELECT status FROM notifications WHERE appointment_id=$1 ORDER BY id',[appointment.id])).rows.map(r=>r.status);assert.deepEqual(statuses,['cancelled','pending']);
});
test('Cancela cita y evita cambios sobre citas cerradas',async()=>{
 assert.equal((await call(`/appointments/${appointment.id}/status`,'PATCH',{status:'cancelled',reason:'Prueba de cancelación'})).status,200);
 assert.equal((await call(`/appointments/${appointment.id}/status`,'PATCH',{status:'confirmed'})).status,409);
 assert.equal(Number((await pool.query("SELECT count(*) FROM notifications WHERE appointment_id=$1 AND status='pending'",[appointment.id])).rows[0].count),0);
});
test('Procedimiento clínico: permisos y precio histórico',async()=>{
 const b={patient_id:patient.id,treatment_id:treatment.id,performed_at:new Date(Date.now()-60000).toISOString(),notes:'Procedimiento ficticio para prueba.'};
 assert.equal((await call('/procedures','POST',b,reception)).status,403);
 const r=await call('/procedures','POST',b,dentist);assert.equal(r.status,201);procedure=r.body;
 await call(`/treatments/${treatment.id}`,'PUT',{name:treatment.name,description:treatment.description,price_cents:99900,duration_minutes:30,active:true});
 assert.equal((await pool.query('SELECT price_cents FROM procedures WHERE id=$1',[procedure.id])).rows[0].price_cents,30000);
 const data=(await call('/data','GET',undefined,reception)).body;assert.equal(data.procedures[0].notes,null);
});
test('Facturación impide duplicar procedimientos',async()=>{
 const body={patient_id:patient.id,procedure_ids:[procedure.id]};const r=await call('/invoices','POST',body,reception);assert.equal(r.status,201);invoice=r.body;
 assert.equal((await call('/invoices','POST',body,reception)).status,409);
 assert.equal((await call('/invoices','POST',body,dentist)).status,403);
});
test('Pago parcial idempotente y validación de sobrepago',async()=>{
 const b={amount_cents:10000,method:'cash',reference:'Prueba',idempotency_key:randomUUID()};
 const a=await call(`/invoices/${invoice.id}/payments`,'POST',b,reception),again=await call(`/invoices/${invoice.id}/payments`,'POST',b,reception);assert.equal(a.status,201);assert.equal(again.body.id,a.body.id);
 assert.equal((await call(`/invoices/${invoice.id}/payments`,'POST',{...b,amount_cents:50000,idempotency_key:randomUUID()},reception)).status,400);
 assert.equal((await call(`/invoices/${invoice.id}/void`,'POST',{reason:'No permitido con pagos'})).status,409);
});
test('Pagos concurrentes no exceden el saldo',async()=>{
 const results=await Promise.all([1,2].map(()=>call(`/invoices/${invoice.id}/payments`,'POST',{amount_cents:20000,method:'transfer',reference:'Concurrencia',idempotency_key:randomUUID()},reception)));
 assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
 const detail=(await call(`/invoices/${invoice.id}`)).body;assert.equal(detail.payments.reduce((s,p)=>s+p.amount_cents,0),30000);
});
test('Recordatorios vencidos se simulan y no se duplican',async()=>{
 const a=await call('/appointments','POST',{patient_id:patient.id,dentist_id:dentistId,treatment_id:treatment.id,starts_at:new Date(Date.now()+3600000).toISOString()});assert.equal(a.status,201);
 assert.equal((await runReminders()).processed,1);assert.equal((await runReminders()).processed,0);
 assert.equal((await pool.query('SELECT status FROM notifications WHERE appointment_id=$1',[a.body.id])).rows[0].status,'simulated');
});
test('Elimina paciente sin referencias y conserva el que tiene historial',async()=>{
 const p=(await call('/patients','POST',{...patientData,email:'eliminar@example.com'})).body;
 assert.equal((await call(`/patients/${p.id}`,'DELETE')).status,200);assert.equal((await pool.query('SELECT 1 FROM patients WHERE id=$1',[p.id])).rowCount,0);
 assert.equal((await call(`/patients/${patient.id}`,'DELETE')).status,200);assert.equal((await pool.query('SELECT active FROM patients WHERE id=$1',[patient.id])).rows[0].active,false);
 const log=(await call('/audit')).body;assert.ok(log.length>10);
});
test('Administrador no puede desactivarse a sí mismo',async()=>{
 const me=(await call('/me')).body.user;
 assert.equal((await call(`/users/${me.id}`,'PUT',{name:me.name,email:me.email,role:'admin',active:false})).status,400);
});
