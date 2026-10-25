# Manual de usuario

## 1. Entrar

Ejecutar INICIAR.cmd. Ingresar correo y contraseña de USUARIOS-DE-PRUEBA.md. El indicador superior identifica el ambiente. Cerrar sesión desde la barra lateral al terminar.

## 2. Pacientes

Recepción o administrador: abrir Pacientes > Nuevo paciente. Completar todos los datos y marcar consentimiento solo si el paciente autoriza recordatorios. Usar Buscar para localizar registros. El lápiz permite editar. El icono de archivo elimina pacientes sin referencias o desactiva aquellos con historial. Se puede reactivar un paciente desactivado.

Historial muestra citas y tratamientos realizados. Las notas clínicas solo están disponibles al administrador y dentista. El dentista visualiza las citas de su propia agenda, y los procedimientos del historial clínico compartido.

## 3. Agenda

Abrir Agenda > Nueva cita. Seleccionar paciente, dentista, tratamiento y hora futura. La duración se calcula desde el catálogo. Si existe superposición, elegir otro horario. Un dentista solo gestiona su agenda.

Se puede confirmar, reprogramar o cancelar indicando motivo. Después de la hora inicial aparecen las opciones de atención y ausencia. Para finalizar como Atendida debe existir al menos un procedimiento asociado. Las citas cerradas conservan su historial y no se reabren.

## 4. Tratamientos y atención

Administrador: Tratamientos > Nuevo tratamiento. Definir descripción, precio y duración. Editar para cambiar valores o desactivar un servicio.

Dentista o administrador: Atención clínica > Registrar procedimiento. Seleccionar paciente, tratamiento, fecha y describir el procedimiento. Puede asociarse una cita que coincida con el paciente y dentista, vigente y cuya hora ya comenzó. El administrador debe seleccionar un dentista. La fecha de realización no puede ser futura. El sistema conserva el precio aplicado aunque el catálogo cambie después.

## 5. Facturación y pagos

Recepción o administrador: Facturación y pagos > Nueva factura. Elegir paciente y marcar uno o varios procedimientos pendientes. Guardar. No se factura dos veces un mismo procedimiento en documentos vigentes.

Abonar permite registrar un importe completo o parcial y su método de pago. No superar el saldo. Cada operación actualiza el total pagado y el saldo. Ver / imprimir muestra factura y recibos; el botón Imprimir / PDF utiliza el diálogo del navegador.

El administrador puede anular una factura sin pagos indicando motivo. Sus procedimientos quedan disponibles para una nueva factura. Una factura con pagos no se anula desde este alcance.

## 6. Recordatorios

Se programan 24 horas antes de la cita o inmediatamente si falta menos tiempo. Solo se generan con consentimiento. Reprogramar cancela pendientes anteriores; cancelar la cita cancela los recordatorios pendientes. La revisión automática ocurre cada minuto mientras el servidor está funcionando.

El modo inicial es simulado. El listado muestra estado, intentos y mensaje. Para correo real configurar SMTP según README.md. El botón Procesar pendientes procesa solo recordatorios cuya fecha programada ya llegó; no adelanta los futuros.

## 7. Usuarios y auditoría

Administrador: Usuarios permite crear cuentas, cambiar roles, actualizar contraseña y desactivar. No puedes quitar tu propio acceso administrativo. Antes de desactivar un dentista o cambiar su rol, cancelar o reasignar sus citas pendientes.

Auditoría muestra las últimas 300 operaciones y quién las realizó. No se puede modificar desde la interfaz.

## 8. Demostración sugerida

1. Ingresar como recepción y registrar un paciente.
2. Programar una cita; intentar otra al mismo horario para mostrar el control de conflictos.
3. Reprogramar y cancelar la cita, revisando recordatorios.
4. Ingresar como dentista y registrar un procedimiento sin cita asociada con fecha actual.
5. Ingresar como recepción, emitir factura y abonar parte del total.
6. Consultar el saldo y luego pagar el resto.
7. Imprimir la factura y sus recibos.
8. Ingresar como administrador y revisar auditoría.

Usar datos ficticios. Para demostrar atención asociada a cita, preparar una cita y esperar su hora de inicio; no se permite finalizar citas futuras.
