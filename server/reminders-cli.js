import {runReminders} from './reminders.js';
import {pool} from './db.js';
try{console.log(await runReminders());}finally{await pool.end();}
