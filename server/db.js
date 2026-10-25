import pg from 'pg';
import {config} from './config.js';
export const pool = new pg.Pool({connectionString:config.databaseUrl,max:10});
export async function transaction(fn){
 const client=await pool.connect();
 try {await client.query('BEGIN'); const result=await fn(client); await client.query('COMMIT'); return result;}
 catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();}
}
export async function audit(db,user,action,entity,id){await db.query('INSERT INTO audit_log(user_id,action,entity,entity_id) VALUES($1,$2,$3,$4)',[user?.id||null,action,entity,id]);}
