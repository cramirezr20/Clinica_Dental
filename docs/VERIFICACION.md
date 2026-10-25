# Verificación técnica

- Compilación React/Vite: correcta.
- Integración con PostgreSQL: 13 pruebas aprobadas, 0 fallos.
- Incluye carreras simultáneas de reservas y pagos, idempotencia, doble facturación, privacidad y conservación del historial.
- Usuarios: tres roles verificados en los cuatro ambientes locales.
- Navegador Microsoft Edge: recorrido de paciente, procedimiento, factura, pago parcial y comprobante aprobado. Ver VERIFICACION-NAVEGADOR.md.
- Vista de escritorio y móvil de 390 px comprobadas, sin desbordamiento horizontal en el panel.
- UML: 14 fuentes PlantUML y 14 gráficos SVG generados; visor HTML local.
- Respaldo: pg_dump custom generado y listado con pg_restore. No se ha ejecutado un simulacro completo de restauración.
- Dependencias: npm audit sin vulnerabilidades reportadas al finalizar la instalación.
- Los accesos INICIAR/INICIAR-TODOS/DETENER operan sobre los procesos y el PostgreSQL propios del proyecto.

No comprobado: envío SMTP real, SMS (no implementado), prueba de carga, disponibilidad de hosting, certificación fiscal o cumplimiento completo de accesibilidad.
