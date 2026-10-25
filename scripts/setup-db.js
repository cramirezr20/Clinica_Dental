import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
const environments=process.argv.slice(2).length?process.argv.slice(2):['development','test','staging','production'];
for(const env of environments){
 const cfg=dotenv.parse(await fs.readFile(`.env.${env}`));
 const target=new URL(cfg.DATABASE_URL);
 const dbName=target.pathname.slice(1);
 if(!/^dentalgest_(development|test|staging|production)$/.test(dbName)) throw Error('Nombre de base no permitido');
 const root=new URL(target); root.pathname='/postgres';
 const admin=new pg.Client({connectionString:root.toString()}); await admin.connect();
 if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[dbName])).rowCount) await admin.query(`CREATE DATABASE "${dbName}"`);
 await admin.end();
 const db=new pg.Client({connectionString:target.toString()}); await db.connect();
 try {
 await db.query('BEGIN');
 await db.query(await fs.readFile('server/schema.sql','utf8'));
 if(cfg.ALLOW_DEMO_SEED==='true'){
 for(const [name,email,role,password] of [
 ['Administrador demo','admin@dentalgest.local','admin','Admin.Dental2026!'],
 ['Recepción demo','recepcion@dentalgest.local','reception','Recepcion.Dental2026!'],
 ['Dra. Sofía Méndez','dentista@dentalgest.local','dentist','Dentista.Dental2026!']]){
 await db.query('INSERT INTO users(name,email,role,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING',[name,email,role,await bcrypt.hash(password,12)]);
 }
 if(!(await db.query('SELECT 1 FROM patients LIMIT 1')).rowCount){
 await db.query(`INSERT INTO patients(first_name,last_name,birth_date,phone,address,email,reminder_consent) VALUES
 ('Ana','López García','1995-04-18','5555-0101','Zona 1, Ciudad de Guatemala','ana@example.com',true),
 ('Luis','Ramírez Pérez','1988-09-03','5555-0102','Zona 7, Ciudad de Guatemala','luis@example.com',true),
 ('María','González','2001-01-22','5555-0103','Mixco, Guatemala','maria@example.com',false)`);
 }
 if(!(await db.query('SELECT 1 FROM treatments LIMIT 1')).rowCount) await db.query(`INSERT INTO treatments(name,description,price_cents,duration_minutes) VALUES
 ('Evaluación general','Consulta inicial y evaluación odontológica',15000,30),
 ('Limpieza dental','Profilaxis y eliminación de placa',30000,45),
 ('Restauración dental','Restauración con resina',45000,60),
 ('Extracción simple','Extracción dental simple',50000,60)`);
 if(!(await db.query('SELECT 1 FROM appointments LIMIT 1')).rowCount){
 const p=(await db.query('SELECT id FROM patients ORDER BY id LIMIT 1')).rows[0];
 const d=(await db.query("SELECT id FROM users WHERE role='dentist' ORDER BY id LIMIT 1")).rows[0];
 const t=(await db.query('SELECT id,price_cents FROM treatments ORDER BY id LIMIT 1')).rows[0];
 const start=new Date(); start.setDate(start.getDate()+2);start.setHours(10,0,0,0);
 const a=(await db.query('INSERT INTO appointments(patient_id,dentist_id,treatment_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$5) RETURNING id',[p.id,d.id,t.id,start,new Date(+start+1800000)])).rows[0];
 await db.query("INSERT INTO notifications(appointment_id,scheduled_at) VALUES($1,$2)",[a.id,new Date(+start-86400000)]);
 const proc=(await db.query('INSERT INTO procedures(patient_id,dentist_id,treatment_id,performed_at,notes,price_cents) VALUES($1,$2,$3,now(),$4,$5) RETURNING id',[p.id,d.id,t.id,'Evaluación de demostración. Paciente ficticio.',t.price_cents])).rows[0];
 const inv=(await db.query('INSERT INTO invoices(patient_id) VALUES($1) RETURNING id',[p.id])).rows[0];
 await db.query('INSERT INTO invoice_items(invoice_id,procedure_id,description,amount_cents) VALUES($1,$2,$3,$4)',[inv.id,proc.id,'Evaluación general',t.price_cents]);
 }
 }
 await db.query('COMMIT');console.log(`${env}: esquema y usuarios preparados`);
 }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}
