import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import dotenv from 'dotenv';
const env=process.argv[2]||'development';if(!['development','test','staging','production'].includes(env))throw Error('Ambiente inválido');
const config=dotenv.parse(await fs.readFile(`.env.${env}`));const url=new URL(config.DATABASE_URL);await fs.mkdir('.local/backups',{recursive:true});
const file=`.local/backups/${env}-${new Date().toISOString().replaceAll(':','-')}.dump`;
const child=spawn('C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',['-h',url.hostname,'-p',url.port,'-U',url.username,'-d',url.pathname.slice(1),'-F','c','-f',file],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password)},stdio:'inherit',windowsHide:true});
child.on('exit',code=>{if(code)process.exitCode=code;else console.log(`Respaldo: ${file}`);});
