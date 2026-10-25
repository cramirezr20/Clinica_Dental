# Usuarios de prueba

Cuentas creadas en development, test, staging y production LOCAL. Las bases son independientes; editar un usuario en un ambiente no modifica los demás.

| Rol | Correo para login | Contraseña |
| --- | --- | --- |
| Administrador | admin@dentalgest.local | Admin.Dental2026! |
| Recepción | recepcion@dentalgest.local | Recepcion.Dental2026! |
| Dentista | dentista@dentalgest.local | Dentista.Dental2026! |

| Ambiente | URL |
| --- | --- |
| Desarrollo | http://127.0.0.1:4100 |
| Pruebas | http://127.0.0.1:4101 |
| Preproducción | http://127.0.0.1:4102 |
| Producción local | http://127.0.0.1:4103 |

Administrador: acceso a todos los módulos; asigna un dentista al registrar atención.
Recepción: pacientes, agenda, catálogo de consulta, facturación, pagos y recordatorios. Sin acceso a notas clínicas ni administración de usuarios.
Dentista: consulta pacientes e historial clínico, consulta catálogo, gestiona su agenda y registra procedimientos. Sin acceso a facturación, pagos, usuarios o auditoría.

Usuarios exclusivos de demostración. Cambiar contraseñas o desactivar las cuentas antes de usar datos reales. No hay usuario paciente: recibe recordatorios, no ingresa al sistema.
