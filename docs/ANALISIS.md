# Análisis de Sistemas 2 · DentalGest

## 1. Descripción general

Aplicación web para administrar pacientes, agenda, tratamientos, procedimientos, facturas y pagos de un consultorio dental. La información se conserva en PostgreSQL. React presenta la interfaz y Express centraliza permisos, validación y transacciones. Alcance académico local, con cuatro bases independientes por ambiente.

## 2. Actores y permisos

| Actor | Responsabilidades |
| --- | --- |
| Administrador | Todos los módulos, catálogo, usuarios y auditoría. Registra procedimientos a nombre de un dentista. |
| Recepción | Datos personales de pacientes, citas, consulta de catálogo, facturas, abonos y recordatorios; sin notas clínicas. |
| Dentista | Pacientes, historial clínico compartido, agenda propia y registro de procedimientos. |
| Paciente | Recibe recordatorios autorizados; no tiene login en este alcance. |
| Proveedor SMTP | Recibe solicitudes de envío de correo cuando se configura. |

## 3. Requerimientos funcionales y trazabilidad

| ID | Requerimiento | Implementación / aceptación |
| --- | --- | --- |
| RF01 | Inicio y cierre de sesión | Login con bcrypt y JWT de 8 horas; cierre elimina token de sessionStorage. |
| RF02 | Control por rol | API verifica usuario activo y rol; menús ajustados al perfil. |
| RF03 | Administración de usuarios | Usuarios: crear, editar, cambiar contraseña y desactivar. |
| RF04 | Registro de pacientes | Nombres, apellidos, nacimiento, teléfono, dirección, correo y consentimiento. |
| RF05 | Editar pacientes | Formulario y PUT /api/patients/:id, con auditoría. |
| RF06 | Eliminar pacientes | Eliminación física sin referencias; desactivación con historial. Reactivación disponible. |
| RF07 | Buscar pacientes | Búsqueda por identificador, nombre, apellidos o correo. |
| RF08 | Consultar historial | Botón Historial: citas y procedimientos con fecha y dentista. Notas protegidas por rol. |
| RF09 | Programar citas | Paciente, dentista, tratamiento, fecha y hora. Duración desde catálogo. |
| RF10 | Evitar superposiciones | Restricciones EXCLUDE de PostgreSQL para paciente y dentista. |
| RF11 | Reprogramar citas | Valida disponibilidad y cancela recordatorios pendientes anteriores. |
| RF12 | Cancelar citas | Conserva registro y motivo. Cancela recordatorios pendientes. |
| RF13 | Gestionar estados de cita | Programada, confirmada, atendida, cancelada o no asistió. |
| RF14 | Consultar agenda | Filtros por fecha, dentista, estado y texto. |
| RF15 | Recordatorios por correo | Programación 24 horas antes; proceso automático cada minuto. SMTP configurable y simulación local explícita. |
| RF16 | Catálogo de tratamientos | Nombre, descripción, precio y duración; edición y desactivación por administrador. |
| RF17 | Registrar tratamientos realizados | Procedimientos con paciente, dentista, fecha, detalle, precio histórico y cita opcional. |
| RF18 | Generar factura | Selecciona uno o varios procedimientos del mismo paciente y conserva conceptos e importes. |
| RF19 | Registrar pagos | Importe, fecha, método, referencia, usuario e identificador de idempotencia. |
| RF20 | Pagos parciales | Abonos sucesivos y cálculo de saldo, sin sobrepago concurrente. |
| RF21 | Consultar facturación | Totales, pagos, saldo y estado calculado por factura. |
| RF22 | Imprimir documentos | Factura y comprobantes imprimibles; PDF mediante el navegador. |
| RF23 | Anular facturas | Administrador, motivo obligatorio y sin pagos registrados; libera procedimientos. |
| RF24 | Auditoría | Registro de login y operaciones de escritura; últimas 300 entradas visibles al administrador. |
| RF25 | Ambientes y cuentas de prueba | Cuatro bases y tres roles por ambiente; scripts idempotentes de preparación. |

## 4. Requerimientos no funcionales

| ID | Categoría | Requisito y estado |
| --- | --- | --- |
| RNF01 | Integridad | Claves primarias/foráneas, CHECK, índices únicos, EXCLUDE y transacciones implementados. |
| RNF02 | Seguridad de contraseñas | Hash bcrypt con costo 12; contraseñas no se devuelven en la API. |
| RNF03 | Autorización | Verificación en servidor en cada solicitud protegida; usuario inactivo pierde acceso. |
| RNF04 | Validación | Validaciones Zod, consultas parametrizadas y límite de JSON de 100 KB. |
| RNF05 | Protección del login | Límite de 30 solicitudes por IP cada 15 minutos. |
| RNF06 | Privacidad | Recepción recibe notes=null. Solo personal clínico consulta detalles. |
| RNF07 | Adaptabilidad | Interfaz para escritorio y móvil; comprobación de ancho a 390 px. |
| RNF08 | Accesibilidad | Etiquetas explícitas, botones identificados, foco visible y avisos de error. No se ha certificado conformidad completa de accesibilidad. |
| RNF09 | Concurrencia | Reservas y pagos simultáneos comprobados con integración PostgreSQL. |
| RNF10 | Aislamiento | Bases separadas y secretos JWT distintos por ambiente. |
| RNF11 | Recuperación | Script pg_dump y respaldo local generado y listado; política diaria y recuperación completa por configurar y validar. |
| RNF12 | Mantenibilidad | Código fuente, dependencias fijadas en package-lock, módulos, documentación y pruebas repetibles. |
| RNF13 | Compatibilidad | Verificado con Microsoft Edge; React/Vite generan recursos para navegadores modernos. Otros navegadores pendientes de verificación. |
| RNF14 | Transporte seguro | Local: HTTP en loopback. Para Internet: HTTPS obligatorio mediante proxy o plataforma de despliegue. |
| RNF15 | Rendimiento | Objetivo propuesto: 95 % de consultas bajo 2 s con 20 usuarios simultáneos. No medido con prueba de carga. |
| RNF16 | Disponibilidad | Objetivo propuesto: 99,5 % mensual. Depende del hosting; no certificado por esta instalación. |
| RNF17 | Recuperación operativa | Objetivos propuestos RPO 24 h y RTO 4 h. Requieren tareas de respaldo y simulacro de restauración. |
| RNF18 | Notificaciones | Tres intentos con reintento a 15 minutos. SMTP requiere proveedor real; la simulación se identifica como simulated. |

## 5. Reglas de negocio

1. Todas las operaciones requieren sesión, salvo login, página de acceso y health.
2. Los roles administrativos no obtienen permiso clínico por manipular formularios: se verifican en API.
3. Una cita requiere paciente, dentista y tratamiento activos, y fecha futura.
4. Las citas vigentes no pueden superponerse para un mismo paciente o dentista. Intervalos [inicio, fin): una cita puede comenzar cuando termina otra.
5. Una cita cerrada no se modifica ni reabre en este alcance.
6. Una cita atendida requiere al menos un procedimiento asociado. La atención y la ausencia no se registran antes del inicio.
7. El procedimiento conserva el precio del catálogo vigente al registrarse y no se modifica retrospectivamente.
8. Los importes se guardan como centavos enteros, hasta 1 000 000 por concepto; los pagos deben ser positivos.
9. Un procedimiento pertenece como máximo a una factura vigente. Una factura no mezcla pacientes.
10. El total y el saldo se calculan a partir de líneas y pagos. No se almacenan saldos que puedan desincronizarse.
11. Los pagos bloquean la factura dentro de una transacción y usan claves idempotentes. No se permite superar el saldo.
12. Una factura con pagos no se anula. No se implementan devoluciones ni notas de crédito fiscales.
13. Los pacientes con historial se desactivan. Las citas vigentes deben cancelarse o gestionarse por separado.
14. Los recordatorios requieren consentimiento. Reprogramaciones y cancelaciones invalidan pendientes anteriores.
15. Solo el administrador gestiona catálogo y usuarios; no puede desactivarse a sí mismo.
16. Un dentista con citas pendientes no puede desactivarse ni perder su rol sin gestionarlas antes.
17. Todos los datos iniciales de pacientes son ficticios.

## 6. Modelo relacional

| Tabla | Clave / relaciones | Propósito |
| --- | --- | --- |
| users | PK id; email único | Cuentas, roles y hash. |
| patients | PK id | Datos personales y consentimiento. |
| treatments | PK id | Catálogo, duración y precio actual. |
| appointments | PK id; FK patient_id, dentist_id, treatment_id | Agenda y estados; exclusiones por rango temporal. |
| procedures | PK id; FK patient_id, dentist_id, treatment_id, appointment_id nullable | Atención y precio aplicado. |
| invoices | PK id; FK patient_id | Cabecera y anulación. |
| invoice_items | PK id; FK invoice_id, procedure_id | Descripción e importe históricos. Índice único parcial para procedimientos no liberados. |
| payments | PK id; FK invoice_id, user_id; idempotency_key único | Abonos. |
| notifications | PK id; FK appointment_id | Estado, programación, intentos y resultado. |
| audit_log | PK id; FK user_id nullable | Historial de operaciones, incluidas las automáticas. |

Fechas: date para nacimiento y timestamptz para eventos. Relaciones de historial conservadas mediante claves foráneas sin borrado en cascada en la operación normal. El esquema ejecutable es server/schema.sql.

## 7. UML

Se entregan los 14 tipos de UML en docs/uml, tanto fuentes PlantUML como gráficos SVG. Abrir docs/uml/index.html para visualizarlos o imprimirlos:

1. Casos de uso.
2. Clases.
3. Objetos.
4. Actividades.
5. Máquina de estados.
6. Secuencia.
7. Comunicación.
8. Resumen de interacción.
9. Tiempo.
10. Componentes.
11. Despliegue.
12. Paquetes.
13. Estructura compuesta.
14. Perfil.

El diagrama de perfil es una extensión conceptual para documentar datos sensibles y operaciones auditables; no representa un módulo adicional de ejecución. El resumen de interacción describe la composición del recorrido principal. El diagrama de tiempo ilustra el caso de correo enviado; en modo local ese resultado se registra como simulado.

## 8. Casos de uso principales

### CU01 Programar cita
Actor: recepción, administrador o dentista (agenda propia). Precondiciones: sesión válida y entidades activas. Flujo: elegir paciente, tratamiento, dentista y horario; validar; insertar cita; programar recordatorio si hay consentimiento; registrar auditoría. Alternativa: conflicto de horario devuelve 409 y no guarda una reserva parcial. Postcondición: cita y recordatorio se conservan en una transacción.

### CU02 Registrar atención
Actor: dentista o administrador. Precondiciones: paciente y tratamiento activos. Flujo: seleccionar datos, fecha y notas; validar cita opcional; copiar precio del catálogo; guardar procedimiento y auditoría. Alternativas: fecha futura o cita incompatible devuelve 400. Postcondición: procedimiento consultable en historial y disponible para facturación.

### CU03 Emitir factura
Actor: recepción o administrador. Flujo: seleccionar paciente y procedimientos no facturados; bloquear procedimientos; crear cabecera y líneas históricas; auditar. Alternativa: un procedimiento ya facturado devuelve 409 y revierte toda la operación. Postcondición: factura vigente con total calculable.

### CU04 Registrar abono
Actor: recepción o administrador. Flujo: capturar importe, método y referencia; bloquear factura; comprobar clave idempotente; calcular saldo; validar importe; insertar pago y auditoría. Alternativas: repetición de la misma clave devuelve el pago existente; sobrepago o factura anulada se rechazan. Postcondición: nuevo saldo consistente.

## 9. Pruebas y límites

Las pruebas en tests/api.test.js verifican autenticación, permisos, validación de paciente, concurrencia de citas, recordatorios al reprogramar/cancelar, precio histórico, privacidad clínica, doble facturación, idempotencia y concurrencia de pagos, desactivación con historial y protección del administrador.

La verificación de navegador se documenta en VERIFICACION-NAVEGADOR.md. No se ha verificado envío a un proveedor SMTP real ni realizado una prueba de carga o una certificación fiscal. Los requisitos que dependen de infraestructura se distinguen como objetivos, no como resultados ya obtenidos.
