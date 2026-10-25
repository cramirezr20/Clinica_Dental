import fs from 'node:fs/promises';
const diagrams={
'01-casos-de-uso':`left to right direction
actor Administrador as Admin
actor Recepcion
actor Dentista
actor Paciente
actor "Proveedor de correo" as Proveedor
rectangle DentalGest {
 usecase "Autenticarse" as Login
 usecase "Gestionar usuarios" as U
 usecase "Gestionar pacientes" as P
 usecase "Consultar historial" as H
 usecase "Gestionar citas" as C
 usecase "Validar disponibilidad" as V
 usecase "Gestionar catalogo" as T
 usecase "Registrar procedimiento" as PR
 usecase "Emitir factura" as F
 usecase "Registrar pagos parciales" as PA
 usecase "Validar saldo" as S
 usecase "Enviar recordatorio" as N
}
Admin --> Login
Recepcion --> Login
Dentista --> Login
Admin --> U
Admin --> T
Admin --> P
Admin --> C
Admin --> PR
Admin --> F
Admin --> PA
Recepcion --> P
Recepcion --> C
Recepcion --> F
Recepcion --> PA
Dentista --> H
Dentista --> C
Dentista --> PR
C ..> V : <<include>>
PA ..> S : <<include>>
Proveedor -- N
Paciente -- N : recibe`,
'02-clases':`hide methods
class Usuario {
 id: integer
 name: text
 email: text
 password_hash: text
 role: admin | reception | dentist
 active: boolean
}
class Paciente {
 id: integer
 first_name: text
 last_name: text
 birth_date: date
 phone: text
 address: text
 email: text
 reminder_consent: boolean
 active: boolean
}
class Tratamiento {
 id: integer
 name: text
 description: text
 price_cents: integer
 duration_minutes: integer
 active: boolean
}
class Cita {
 id: integer
 starts_at: timestamptz
 ends_at: timestamptz
 status: text
 cancellation_reason: text
}
class Procedimiento {
 id: integer
 performed_at: timestamptz
 notes: text
 price_cents: integer
}
class Factura {
 id: integer
 created_at: timestamptz
 voided: boolean
 void_reason: text
}
class DetalleFactura {
 id: integer
 description: text
 amount_cents: integer
 released: boolean
}
class Pago {
 id: integer
 amount_cents: integer
 method: text
 reference: text
 idempotency_key: uuid
 created_at: timestamptz
}
class Notificacion {
 id: integer
 scheduled_at: timestamptz
 status: text
 attempts: integer
 sent_at: timestamptz
 body: text
}
class Auditoria {
 id: bigint
 action: text
 entity: text
 entity_id: integer
 created_at: timestamptz
}
Paciente "1" -- "0..*" Cita
Usuario "1" -- "0..*" Cita : dentista
Tratamiento "1" -- "0..*" Cita
Paciente "1" -- "0..*" Procedimiento
Usuario "1" -- "0..*" Procedimiento : realiza
Tratamiento "1" -- "0..*" Procedimiento
Cita "0..1" -- "0..*" Procedimiento
Paciente "1" -- "0..*" Factura
Factura "1" *-- "1..*" DetalleFactura
Procedimiento "1" -- "0..*" DetalleFactura
Factura "1" -- "0..*" Pago
Usuario "1" -- "0..*" Pago : registra
Cita "1" -- "0..*" Notificacion
Usuario "0..1" -- "0..*" Auditoria
note right of DetalleFactura
Solo una linea no liberada por procedimiento.
El saldo se calcula; no se almacena.
end note`,
'03-objetos':`object "ana:Paciente" as P {
 first_name = Ana
 last_name = Lopez
}
object "sofia:Usuario" as D {
 role = dentist
}
object "limpieza:Tratamiento" as T {
 price_cents = 30000
 duration_minutes = 45
}
object "cita:Cita" as C {
 status = scheduled
 starts_at = 2026-11-02 09:00 -06:00
}
P -- C
D -- C
T -- C`,
'04-actividades':`start
:Identificar paciente;
:Consultar cita;
if (Cita vigente?) then (si)
 :Realizar atencion;
 :Registrar procedimientos y precio historico;
 :Finalizar cita;
 :Seleccionar procedimientos no facturados;
 :Emitir factura;
 while (Paciente desea abonar y existe saldo?) is (si)
  :Capturar importe y metodo;
  if (Importe positivo y menor o igual al saldo?) then (si)
   :Registrar pago en transaccion;
   :Calcular saldo;
   :Emitir comprobante;
  else (no)
   :Mostrar error;
  endif
 endwhile (no)
else (no)
 :Informar estado;
endif
stop`,
'05-estados':`[*] --> Programada
Programada --> Confirmada : confirmar
Programada --> Programada : reprogramar [disponible]
Confirmada --> Programada : reprogramar [disponible]
Programada --> Cancelada : cancelar [motivo]
Confirmada --> Cancelada : cancelar [motivo]
Programada --> Atendida : finalizar [procedimiento registrado]
Confirmada --> Atendida : finalizar [procedimiento registrado]
Programada --> NoAsistio : registrar ausencia [inicio alcanzado]
Confirmada --> NoAsistio : registrar ausencia [inicio alcanzado]
Atendida --> [*]
Cancelada --> [*]
NoAsistio --> [*]`,
'06-secuencia':`actor Recepcion
boundary React
control API
 database PostgreSQL
Recepcion -> React : Registrar abono
React -> API : POST /invoices/:id/payments
API -> API : Autenticar y autorizar
API -> PostgreSQL : BEGIN
API -> PostgreSQL : SELECT factura FOR UPDATE
API -> PostgreSQL : Consultar clave idempotente
alt Pago existente con los mismos datos
 API -> PostgreSQL : COMMIT
 API --> React : Comprobante existente
else Pago nuevo
 API -> PostgreSQL : Consultar total y pagos
 alt Importe positivo y no supera saldo
  API -> PostgreSQL : INSERT pago y auditoria
  API -> PostgreSQL : COMMIT
  API --> React : Comprobante
 else Importe invalido
  API -> PostgreSQL : ROLLBACK
  API --> React : Error 400
 end
end
React --> Recepcion : Mostrar resultado`,
'07-comunicacion':`object "recepcion:Actor" as R
object "agenda:React" as UI
object "api:Express" as A
object "postgres:BaseDatos" as DB
R --> UI : 1: programar cita
UI --> A : 1.1: POST /appointments
A --> DB : 1.2: BEGIN
A --> DB : 1.3: validar referencias activas
A --> DB : 1.4: INSERT (restricciones EXCLUDE)
A --> DB : 1.5: INSERT notificacion y auditoria
A --> DB : 1.6: COMMIT
A --> UI : 1.7: cita creada o conflicto
UI --> R : 1.8: mostrar resultado`,
'08-resumen-interaccion':`start
:<<interaction>>\nAutenticar usuario;
if (Acceso autorizado?) then (si)
 :<<interaction>>\nConsultar paciente;
 :<<interaction>>\nProgramar cita;
 if (Cita cancelada?) then (si)
  :<<interaction>>\nCancelar recordatorios;
 else (no)
  :<<interaction>>\nRegistrar procedimiento;
  :<<interaction>>\nEmitir factura;
  :<<interaction>>\nRegistrar pagos;
 endif
else (no)
 :Mostrar acceso denegado;
endif
stop`,
'09-tiempo':`robust "Cita" as C
robust "Recordatorio" as R
@0
C is Programada
R is Pendiente
@1
C is Confirmada
@24
R is Procesando
@25
R is Enviado
@48
C is Atendida
@49
C is Atendida
R is Enviado
highlight 24 to 25 : envio 24 horas antes`,
'10-componentes':`component "Interfaz React" as UI
component "API Express" as API
component "Autenticacion y permisos" as Auth
component "Pacientes y citas" as P
component "Tratamientos y procedimientos" as T
component "Facturacion y pagos" as F
component "Recordatorios" as N
component "Acceso a datos pg" as PG
database PostgreSQL as DB
cloud "Servidor SMTP" as SMTP
UI --> API : HTTP / JSON
API --> Auth
API --> P
API --> T
API --> F
API --> N
P --> PG
T --> PG
F --> PG
N --> PG
PG --> DB
N --> SMTP`,
'11-despliegue':`node "Equipo Windows del usuario" {
 node "Navegador" as N
 node "Node.js" {
  artifact "React compilado / dist" as UI
  artifact "Express / API" as API
  artifact "Temporizador de recordatorios" as W
 }
 node "PostgreSQL aislado :55432" {
  database dentalgest_development as D
  database dentalgest_test as T
  database dentalgest_staging as S
  database dentalgest_production as P
 }
 folder "Respaldos locales" as B
}
cloud "SMTP externo (opcional)" as SMTP
N --> UI : HTTP loopback
N --> API : HTTP loopback
API --> D : development :4100
API --> T : test :4101
API --> S : staging :4102
API --> P : production local :4103
W --> SMTP : TLS
P --> B : pg_dump
note bottom of API
Internet: desplegar detras de HTTPS,
rotar credenciales y configurar respaldos.
end note`,
'12-paquetes':`package Presentacion as P
package Aplicacion as A
package Dominio as D
package Infraestructura as I
P ..> A
A ..> D
A ..> I
I ..> D
note bottom of A
Implementacion: server/index.js
rutas y coordinacion transaccional
end note
note bottom of D
Esquemas Zod y reglas de negocio.
Integridad en schema.sql.
end note
note bottom of I
server/db.js y reminders.js
pg, bcrypt, JWT y SMTP.
end note`,
'13-estructura-compuesta':`component "Coordinador de citas" {
 portin "API /appointments" as Entrada
 component "schedule()" as S
 component "Validacion Zod" as V
 component "transaction()" as TX
 component "Planificador recordatorio" as N
 portout "PostgreSQL" as DB
 Entrada --> V
 V --> S
 S --> TX
 S --> N
 TX --> DB
 N --> DB
}`, 
'14-perfil':`package "Perfil DentalGest" <<profile>> {
 class "Class" as C <<metaclass>>
 class "Property" as P <<metaclass>>
 class "Operation" as O <<metaclass>>
 class "EntidadPersistente" as E <<stereotype>> {
  tabla: String
 }
 class "DatoSensible" as S <<stereotype>> {
  categoria: String
 }
 class "OperacionAuditable" as A <<stereotype>> {
  evento: String
 }
 E --|> C : <<extension>>
 S --|> P : <<extension>>
 A --|> O : <<extension>>
}`
};
await fs.mkdir('docs/uml',{recursive:true});
for(const [name,body] of Object.entries(diagrams))await fs.writeFile(`docs/uml/${name}.puml`,`@startuml\n!pragma layout smetana\nskinparam backgroundColor #FFFFFF\nskinparam shadowing false\nskinparam defaultFontName Arial\nskinparam ArrowColor #315D49\nskinparam classBackgroundColor #EFF4E8\nskinparam componentBackgroundColor #EFF4E8\n${body}\n@enduml\n`);
const titles=['Casos de uso','Clases','Objetos','Actividades','Máquina de estados','Secuencia','Comunicación','Resumen de interacción','Tiempo','Componentes','Despliegue','Paquetes','Estructura compuesta','Perfil'];
await fs.writeFile('docs/uml/index.html',`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DentalGest · Diagramas UML</title><style>body{font:16px Arial;background:#f5f8f1;color:#254b38;max-width:1300px;margin:40px auto;padding:20px}section{background:white;padding:25px;margin:25px 0;border:1px solid #dce5d4;border-radius:12px;overflow:auto}img{max-width:100%;height:auto}a{color:#426b44}@media print{section{break-before:page}}</style><h1>DentalGest · Los 14 diagramas UML</h1><p>Diagramas alineados con React, Express y PostgreSQL. Fuentes editables en PlantUML.</p>${Object.keys(diagrams).map((name,i)=>`<section><h2>${i+1}. ${titles[i]}</h2><p><a href="${name}.puml">Fuente PlantUML</a></p><img src="${name}.svg" alt="${titles[i]}"></section>`).join('')}</html>`);
console.log('14 diagramas generados');
