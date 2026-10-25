import dotenv from 'dotenv';
import path from 'node:path';
const env = process.env.APP_ENV || process.argv[2] || 'development';
if(!['development','test','staging','production'].includes(env)) throw new Error('Ambiente inválido');
dotenv.config({path:path.resolve(`.env.${env}`),override:false});
export const config = {env, port:Number(process.env.PORT || 4100), databaseUrl:process.env.DATABASE_URL, jwtSecret:process.env.JWT_SECRET, notificationMode:process.env.NOTIFICATION_MODE || 'log'};
if(!config.databaseUrl || !config.jwtSecret || config.jwtSecret.length<32) throw new Error('Configura DATABASE_URL y JWT_SECRET (32 caracteres mínimo)');
