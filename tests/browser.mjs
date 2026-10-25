import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
await fs.mkdir('.local/qa',{recursive:true});
const report=[];const errors=[];
try{
 for(const [env,port] of [['development',4100],['test',4101],['staging',4102],['production',4103]]){
 for(const [mail,password] of [['admin','Admin.Dental2026!'],['recepcion','Recepcion.Dental2026!'],['dentista','Dentista.Dental2026!']]){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${port}`);await page.getByLabel('Correo electrónico').fill(`${mail}@dentalgest.local`);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.getByRole('heading',{name:/Hola,/}).waitFor();
 await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('heading',{name:'Pacientes',exact:true}).waitFor();
 if(mail==='dentista'&&await page.getByRole('button',{name:'Facturación y pagos',exact:true}).count())throw Error('Menú de facturación visible al dentista');
 if(mail==='recepcion'&&await page.getByRole('button',{name:'Usuarios',exact:true}).count())throw Error('Menú de usuarios visible a recepción');
 if(env==='development'&&mail==='admin'){
 await page.getByRole('button',{name:'Resumen',exact:true}).click();await page.screenshot({path:'.local/qa/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.local/qa/dashboard-mobile.png',fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth))throw Error('Desbordamiento horizontal en móvil');
 }
 report.push(`${env} / ${mail}: login y permisos de navegación correctos`);await context.close();
 }
 }
 const sampleName='PacienteNavegador'+Date.now();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4101');
 await page.getByLabel('Correo electrónico').fill('admin@dentalgest.local');await page.getByLabel('Contraseña',{exact:true}).fill('Admin.Dental2026!');await page.getByRole('button',{name:'Iniciar sesión'}).click();await page.getByRole('heading',{name:/Hola,/}).waitFor();
 await page.getByRole('button',{name:'Pacientes',exact:true}).click();await page.getByRole('button',{name:'Nuevo paciente',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Nombres',{exact:true}).fill(sampleName);await dialog.getByLabel('Apellidos',{exact:true}).fill('Demostración');await dialog.getByLabel('Fecha de nacimiento').fill('1990-05-10');await dialog.getByLabel('Teléfono').fill('55551234');await dialog.getByLabel('Correo electrónico',{exact:true}).fill('navegador@example.com');await dialog.getByLabel('Dirección').fill('Ciudad de Guatemala');await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Atención clínica',exact:true}).click();await page.getByRole('button',{name:'Registrar procedimiento',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Paciente',{exact:true}).selectOption({label:sampleName+' Demostración'});await dialog.getByLabel('Dentista',{exact:true}).selectOption({index:1});await dialog.getByLabel('Tratamiento realizado').selectOption({index:1});await dialog.getByLabel('Detalles del procedimiento').fill('Registro ficticio creado desde la interfaz del navegador.');await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Facturación y pagos',exact:true}).click();await page.getByRole('button',{name:'Nueva factura',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Paciente',{exact:true}).selectOption({label:sampleName+' Demostración'});await dialog.locator('input[type=checkbox]').first().check();await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});
 let row=page.getByRole('row').filter({hasText:sampleName});await row.getByRole('button',{name:'Abonar',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Importe a pagar (Q)').fill('100');await dialog.getByRole('button',{name:'Guardar',exact:true}).click();await dialog.waitFor({state:'hidden'});await row.getByText('Pago parcial',{exact:true}).waitFor();
 await row.getByRole('button',{name:'Ver / imprimir'}).click();await page.getByRole('dialog',{name:'Factura',exact:true}).waitFor();await page.screenshot({path:'.local/qa/factura.png',fullPage:true});await page.getByRole('button',{name:'Cerrar factura'}).click();
 report.push('Interfaz: paciente -> procedimiento -> factura -> abono parcial -> comprobante: correcto');
 if(errors.length)throw Error('Errores de JavaScript: '+errors.join('; '));
 await fs.writeFile('docs/VERIFICACION-NAVEGADOR.md','# Verificación en Microsoft Edge\n\n'+report.map(r=>'- '+r).join('\n')+'\n\nCapturas: `.local/qa/`. Sin errores JavaScript detectados.\n');console.log(report.join('\n'));
}finally{await browser.close();}
