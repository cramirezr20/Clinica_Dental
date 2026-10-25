import nodemailer from 'nodemailer';
import {config} from './config.js';
import {transaction,audit} from './db.js';
export async function runReminders(){
 return transaction(async db=>{
 const rows=(await db.query(`SELECT n.*,a.starts_at,a.status appointment_status,p.email,p.first_name,p.reminder_consent
 FROM notifications n JOIN appointments a ON a.id=n.appointment_id JOIN patients p ON p.id=a.patient_id
 WHERE n.status IN ('pending','failed') AND n.attempts<3 AND n.scheduled_at<=now()
 ORDER BY n.id FOR UPDATE OF n SKIP LOCKED LIMIT 20`)).rows;
 let processed=0;
 for(const n of rows){
 if(!['scheduled','confirmed'].includes(n.appointment_status)||!n.reminder_consent||new Date(n.starts_at)<=new Date()){
 await db.query("UPDATE notifications SET status='cancelled' WHERE id=$1",[n.id]);continue;
 }
 const date=new Date(n.starts_at).toLocaleString('es-GT',{timeZone:'America/Guatemala'});
 const body=`Hola ${n.first_name}. Recuerda tu cita dental el ${date}. Comunícate con el consultorio para cualquier cambio.`;
 try{
 if(config.notificationMode==='smtp'){
 if(!process.env.SMTP_HOST)throw Error('Falta configurar SMTP_HOST');
 const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}:undefined,connectionTimeout:10000,socketTimeout:15000});
 await transport.sendMail({from:process.env.SMTP_FROM,to:n.email,subject:'Recordatorio de cita · DentalGest',text:body,messageId:`<dentalgest-${config.env}-${n.id}@dentalgest.local>`});
 }
 await db.query("UPDATE notifications SET status=$2,attempts=attempts+1,sent_at=now(),body=$3,last_error=NULL WHERE id=$1",[n.id,config.notificationMode==='smtp'?'sent':'simulated',body]);
 await audit(db,null,'recordatorio_procesado','notifications',n.id);processed++;
 }catch(e){await db.query("UPDATE notifications SET status='failed',attempts=attempts+1,last_error=$2,scheduled_at=now()+interval '15 minutes' WHERE id=$1",[n.id,String(e.message).slice(0,300)]);}
 }
 return {processed,mode:config.notificationMode};
 });
}
