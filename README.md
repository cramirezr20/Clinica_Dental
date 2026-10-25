# DentalGest

Aplicación académica de gestión de consultorio dental. React + Vite en la interfaz, Express en el servidor y PostgreSQL 18 para persistencia real.

## Abrir la aplicación

1. Ejecutar `INICIAR.cmd` con doble clic.
2. Abrir http://127.0.0.1:4100.
3. Ingresar con uno de los usuarios de `USUARIOS-DE-PRUEBA.md`.

`INICIAR-TODOS.cmd` levanta los cuatro ambientes. `DETENER.cmd` detiene los procesos del proyecto y su instancia PostgreSQL. No modifica el servicio PostgreSQL instalado previamente en el equipo.

| Ambiente | Dirección | Base de datos |
| --- | --- | --- |
| Desarrollo | http://127.0.0.1:4100 | dentalgest_development |
| Pruebas | http://127.0.0.1:4101 | dentalgest_test |
| Preproducción | http://127.0.0.1:4102 | dentalgest_staging |
| Producción local | http://127.0.0.1:4103 | dentalgest_production |

Los cuatro son ambientes LOCALES independientes. No están publicados en Internet. Comparten el código y el compilado de React, pero utilizan bases y secretos JWT diferentes. La instancia del proyecto escucha únicamente en 127.0.0.1:55432 y tiene autenticación SCRAM.

## Funciones

- Login y permisos de administrador, recepción y dentista, comprobados en el servidor.
- Registro, edición, búsqueda, eliminación o desactivación y reactivación de pacientes.
- Historial de citas y tratamientos; recepción no recibe notas clínicas.
- Agenda con filtros por fecha, dentista y estado. Creación, reprogramación, confirmación, cancelación, ausencia y finalización.
- Restricciones PostgreSQL impiden superponer citas del mismo paciente o dentista, incluso con solicitudes simultáneas.
- Catálogo de tratamientos, precios, duración y disponibilidad.
- Registro clínico con precio histórico y asociación opcional a cita.
- Facturas de varios procedimientos, control de doble facturación, anulación sin pagos y documentos imprimibles/PDF desde el navegador.
- Pagos completos/parciales, método, referencia, recibos, saldo e idempotencia.
- Recordatorios automáticos 24 horas antes, con consentimiento y reintentos; modo simulado local y adaptador de correo SMTP real.
- Administración de usuarios y auditoría de operaciones.

La moneda de demostración es GTQ (quetzales). Los importes se guardan como centavos enteros. Las fechas de agenda se muestran con zona America/Guatemala. Al escribir una fecha se usa la hora local del equipo; mantener Windows en la zona del consultorio.

## Instalación y comandos

Requisitos de esta instalación: Node.js 22.16+, PostgreSQL 18 instalado en `C:\Program Files\PostgreSQL\18\bin`. Java solo se necesita para regenerar los gráficos UML.

```powershell
cd C:\Users\CR\Desktop\DentalGest
npm ci
npm run db:setup
npm run build
npm run start:dev
```

`npm run db:setup` crea las bases faltantes y aplica el esquema de forma idempotente. Con ALLOW_DEMO_SEED=true inserta cuentas y datos ficticios faltantes. No restablece contraseñas ni sobrescribe usuarios existentes.

Para editar con recarga automática:

```powershell
npm run dev
```

Interfaz de desarrollo: http://127.0.0.1:5180; API: http://127.0.0.1:4100. Antes de `npm run dev`, detener el servidor development con `scripts/stop.ps1` para no duplicar el puerto. Después de cambiar React, ejecutar `npm run build` para actualizar las pantallas servidas por los accesos CMD.

```powershell
npm test
node tests/browser.mjs
node scripts/backup.js development
```

Las pruebas de integración vacían SOLO las tablas funcionales de dentalgest_test, conservando usuarios. No ejecutarlas con el ambiente de pruebas en uso. La prueba de navegador usa Microsoft Edge instalado y agrega datos ficticios en test. Cada ejecución de navegador genera un nombre único para sus pacientes ficticios.

## Configuración

Archivos `.env.development`, `.env.test`, `.env.staging` y `.env.production`, excluidos por `.gitignore`. `.env.example` contiene un ejemplo sin credenciales reales. Los archivos actuales ya contienen credenciales aleatorias para la instancia local. No compartir `.env.*`, `.local/` ni una copia íntegra de esta carpeta fuera de un contexto controlado.

Para otra computadora, instalar PostgreSQL, crear las bases o permitir su creación al usuario de configuración, ajustar DATABASE_URL y generar un JWT_SECRET independiente por ambiente. El usuario de configuración debe poder crear la extensión btree_gist; la instalación local utiliza su propietario de cluster. Para un despliegue real separar el usuario de migraciones del usuario de ejecución con permisos mínimos.

### Correo real

Configurar en el `.env` correspondiente:

```dotenv
NOTIFICATION_MODE=smtp
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_USER=tu-usuario
SMTP_PASS=tu-clave
SMTP_FROM=Consultorio <citas@tu-dominio.com>
```

Reiniciar el ambiente. El servidor revisa pendientes cada minuto. También se pueden procesar desde Recordatorios. Sin credenciales SMTP, el modo `log` registra el contenido como `simulated`; no envía correos ni SMS. La alternativa correo satisface la opción correo o SMS del enunciado; no se incluye proveedor SMS. El SMTP debe configurarse y comprobarse antes de usar recordatorios reales. Ante una desconexión después de que SMTP acepte un correo puede haber reenvío; el Message-ID es estable, pero no se garantiza entrega exactamente una vez con SMTP.

### Respaldo y recuperación

`node scripts/backup.js production` genera un archivo custom de pg_dump en `.local/backups/`. Programar este comando en el Programador de tareas para respaldos diarios; la programación no se instala automáticamente. Guardar copias cifradas fuera del equipo.

Para restaurar, detener el ambiente, crear una base vacía y ejecutar `pg_restore -h 127.0.0.1 -p 55432 -U dentalgest_owner -d NOMBRE_BASE ARCHIVO.dump`. Obtener la contraseña del DATABASE_URL local sin publicarla. Verificar el respaldo restaurándolo en una base temporal antes de depender de él. No restaurar sobre una base con información sin un plan de recuperación.

## Estructura

- `client/`: interfaz React y estilos adaptables.
- `server/index.js`: rutas, autenticación, permisos y reglas de negocio.
- `server/schema.sql`: tablas, índices y restricciones relacionales.
- `server/db.js`: pool y transacciones con un mismo cliente.
- `server/reminders.js`: recordatorios simulados y SMTP.
- `scripts/`: preparación de bases, arranque, parada, respaldo y UML.
- `tests/`: pruebas de integración y recorrido de navegador.
- `docs/ANALISIS.md`: requerimientos, reglas y trazabilidad.
- `docs/MANUAL-USUARIO.md`: guía para la demostración.
- `docs/uml/index.html`: visor local de los 14 diagramas SVG; fuentes `.puml` editables.
- `.local/`: datos PostgreSQL, herramientas, capturas y respaldos, no versionables.
- `logs/`: registros de los ambientes y de PostgreSQL.

## Límites para uso real

Esta entrega es una aplicación académica funcional local. La factura es un documento administrativo; no es un documento tributario autorizado. Los pagos se registran, pero no se cargan tarjetas ni se conectan bancos. Las cuentas demo se incluyen en producción LOCAL por solicitud; desactivarlas o cambiar sus contraseñas antes de un despliegue real y poner ALLOW_DEMO_SEED=false. Un despliegue en Internet requiere HTTPS, secretos propios, permisos mínimos, respaldos programados, política de datos y validación de requisitos fiscales. Los objetivos de carga y disponibilidad del análisis no constituyen una certificación del sistema.

## Referencias técnicas

- https://vite.dev/guide/
- https://node-postgres.com/features/transactions
- https://www.postgresql.org/docs/current/app-initdb.html
