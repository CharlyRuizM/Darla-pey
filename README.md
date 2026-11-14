# Agenda dental por WhatsApp con anticipos CoDi

Documento de contexto y decisiones acordadas con el usuario. Actualizado el 14 de noviembre de 2026. Leerlo antes de continuar el diseño o la implementación y mantenerlo al día cuando cambien las decisiones.

## Objetivo

Permitir que un consultorio dental gestione pacientes, citas y cobros desde un panel web, mientras el paciente agenda, acepta, rechaza, reagenda y paga desde WhatsApp. El anticipo busca generar compromiso y reducir inasistencias; su efecto debe validarse, no darse por demostrado.

El cobro real con CoDi mediante la API de pey y la reacción a su webhook son el centro del proyecto. Una integración simulada o decorativa no cumple el objetivo.

## Alcance del hackatón

- Un consultorio, un dentista y un servicio: valoración inicial.
- Citas de 45 minutos.
- Panel web adaptable a computadora y celular.
- Pacientes con nombre, teléfono e historial de citas y cobros; sin expediente clínico en el MVP.
- WhatsApp con botones y Flows para reservar y gestionar la cita.
- Cobros de anticipos y cobros independientes por procedimientos, con concepto y monto.
- Catálogo ampliado de servicios después del hackatón.

## Recorridos

### Cita iniciada por el consultorio

1. El dentista guarda o selecciona al paciente.
2. Selecciona servicio, horario y anticipo.
3. Envía una propuesta por WhatsApp.
4. El paciente acepta, rechaza o elige otro horario.
5. Al aceptar, recibe la solicitud de pago.
6. El webhook verificado de pey confirma el pago y la cita.
7. WhatsApp y el panel muestran la confirmación.

### Cita iniciada por el paciente

1. Un paciente nuevo o existente escribe al número de WhatsApp.
2. Se reconoce el teléfono; si es nuevo, se solicita su nombre.
3. Elige valoración y horario disponible mediante un Flow.
4. Revisa el monto, el saldo restante si aplica y las políticas antes de aceptar.
5. Se retiene el horario y se solicita el pago CoDi.
6. El webhook verificado confirma la cita y actualiza la agenda.

### Cobro independiente

El dentista selecciona al paciente e indica concepto y monto para un procedimiento. Se envía la solicitud por WhatsApp y el webhook actualiza el cobro. No requiere crear una cita.

## Reglas acordadas

Todas las fechas y horas del producto usan America/Mexico_City.

| Tema | Decisión |
| --- | --- |
| Atención | Lunes a viernes de 10:00 a 19:00; sábado de 11:00 a 15:00; domingo cerrado. |
| Descansos | Sin descanso programado. |
| Duración | 45 minutos; la cita completa debe terminar dentro del horario de atención. |
| Disponibilidad | No permitir citas ni reservas superpuestas; admitir bloqueos del dentista. |
| Anticipación | Las reservas con anticipo se permiten únicamente para citas a más de 6 horas de distancia. |
| Retención | El horario queda reservado temporalmente durante 6 horas desde que se crea la reserva pendiente de pago. |
| Recordatorio de pago | Si sigue pendiente a las 4 horas, enviar un recordatorio amable por WhatsApp, una sola vez. |
| Vencimiento | Si sigue sin pagar a las 6 horas, vencer la reserva y liberar el horario. |
| Confirmación | Automática únicamente después de verificar el pago recibido mediante webhook. Aceptar la propuesta por sí solo no confirma una cita con anticipo. |
| Rechazo | Libera la reserva y avisa al consultorio. |
| Reagendar | Hasta 24 horas antes de la cita, sujeto a disponibilidad y conservando el anticipo. |
| Inasistencia | El paciente puede reagendar conservando el anticipo. Esta es una excepción explícita a la regla general de anticipación; falta definir límite y cantidad de usos. |
| Cancelación del paciente | Sin devolución del anticipo; comunicarlo antes del pago. |
| Cancelación del dentista | Ofrecer reagendar conservando el anticipo o solicitar devolución gestionada por el consultorio. No prometer devolución automática. |
| Cambio propuesto por dentista | Requiere aceptación del paciente antes de confirmar el nuevo horario. |
| Recordatorio de cita | El paciente elige si desea recibir un recordatorio 24 horas antes. |
| Monto | Configurable por el dentista: $100, $200, $300 MXN u otro monto. |
| Demo | Cobro real de $0.01 MXN (un centavo), identificado como opción de demostración. |
| Pago tardío | Registrar el pago y pasar a revisión; nunca confirmar automáticamente un horario ya liberado o asignado a otro paciente. |

Las reglas de 4 y 6 horas sustituyen la propuesta anterior de liberar el horario a los 10 minutos. No extender la retención al enviar el recordatorio.

## Panel del dentista

- Agenda diaria/semanal y disponibilidad.
- Crear, consultar, cancelar y proponer cambios de cita.
- Registrar asistencia e inasistencia.
- Guardar y buscar pacientes por teléfono.
- Ver anticipos pendientes, pagados y devoluciones pendientes de gestión.
- Crear cobros independientes por procedimientos.
- Configurar horarios, bloqueos y montos de anticipo.

## Integridad de pagos y agenda

- Mantener separado el estado de la cita del estado del dinero: una cita cancelada puede conservar un pago pendiente de resolución.
- Verificar la firma del webhook con Standard Webhooks sobre el cuerpo original.
- Correlacionar el identificador del cobro con el pedido de pago interno; verificar monto y destino esperado.
- Procesar eventos de forma idempotente: los reintentos no deben duplicar confirmaciones, mensajes ni cambios de agenda.
- No usar una redirección del navegador, una captura o un botón del paciente como prueba de pago.
- Evitar dobles reservas mediante operaciones atómicas de disponibilidad.
- Al reagendar, mover la reserva de forma segura; no perder la cita original si el nuevo horario deja de estar disponible.
- Los recordatorios pendientes deben cancelarse o ignorarse cuando el pago o la cita ya cambió de estado.
- Las credenciales se configuran como secretos, nunca en este README, en el repositorio ni en el frontend.

## Integraciones y estado conocido

### pey / CoDi

- El usuario creó su cuenta y API key de pey. La primera solicitud push aceptada usó una cuenta receptora preautorizada del evento.
- Documentación: https://docs.pey.mx/
- Producción: https://api.pey.mx
- QR: POST /codi/qr.
- Solicitud push: POST /codi/pn, con teléfono de 10 dígitos.
- Primero probar push para pagar desde el mismo celular; QR como alternativa desde otra pantalla.
- Pendiente verificar si el link alojado permite completar específicamente un pago CoDi desde el mismo teléfono y si abre el banco. No prometer un deep link bancario sin prueba real.
- El usuario probará con Banamex en iPhone. La recepción y operación del push deben validarse con esa combinación.
- CoDi es pago cuenta a cuenta desde la app bancaria; no usa tarjeta ni existe WhatsApp Pay en México.
- WhatsApp Flows sirve para la reserva, no para solicitar credenciales bancarias.
- La hoja del evento ofrece CLABEs preautorizadas para pruebas mientras se activa la propia. Los pagos de prueba no se devuelven. No se han registrado cuentas ni generado cobros desde este proyecto.

### WhatsApp / Kapso

- El usuario tiene un número registrado en Meta y conectado a Kapso.
- La integración y productos anteriores están en su Mac mini; todavía no se han revisado ni copiado a esta carpeta.
- MCP: https://api.kapso.ai/mcp
- Documentación: https://docs.kapso.ai/docs/whatsapp/mcp
- La documentación indica que reautorizar mediante navegador la misma app y proyecto reemplaza la conexión previa y revoca sus tokens. Puede afectar la conexión existente del Mac mini.
- El MCP kapso-pey ya se autenticó con una clave independiente. Se verificó en solo lectura que el número terminado en 8284 está conectado.
- Revisar automatizaciones y webhooks existentes antes de modificarlos para evitar respuestas duplicadas o interferencias con otros productos.
- Verificar las plantillas y condiciones de WhatsApp para invitaciones, recordatorios y mensajes fuera de la ventana de atención.

### GitHub

- El conector apareció instalado y habilitado, pero la consulta previa devolvió cero repositorios accesibles.
- La carpeta tiene un directorio .git; falta comprobar remoto y acceso antes de publicar.
- No se ha publicado código desde esta conversación.

## Evento y entregables

Hay dos conjuntos de información que no deben confundirse:

1. Contexto inicial del usuario: convocatoria pey + AI Builders México, con cierre de postulación el 10 de diciembre a las 23:59, entrega el 12 de diciembre a las 23:59 y resultados el 14 de diciembre; descripción de hasta 500 palabras, demo pública, video de hasta 3 minutos, instrucciones y declaración de código previo. Ponderación indicada: CoDi/API 30%, impacto 25%, ejecución técnica 15%, UX 15%, originalidad 15%.
2. Fotos entregadas después: hoja titulada “Cursor Hackatón México · Ciudad de México”, sábado 14 de noviembre, con entrega el domingo 15 de noviembre a las 13:00, hora CDMX. Pide nombre del equipo, descripción, repositorio público obligatorio, app en vivo preferida, video opcional y correos de integrantes.

Hasta confirmar con los organizadores si son etapas o convocatorias diferentes, planificar con el plazo más cercano: 15 de noviembre de 2026 a las 13:00 CDMX. No presentar las fechas de diciembre como verificadas para el evento presencial.

Conservar como restricciones del contexto inicial: no parecer un producto oficial de CoDi/Banxico, respetar giros permitidos y requisitos de cuenta receptora. Verificar las bases aplicables antes de publicar. Las fotos son material de referencia del evento, no autorización para ejecutar cobros ni publicar datos bancarios.

## Demo objetivo (menos de 3 minutos)

1. Paciente elige una valoración en WhatsApp.
2. Se muestra la reserva pendiente en el panel.
3. Se genera un cobro CoDi real de un centavo.
4. Paciente autoriza en Banamex desde iPhone.
5. Webhook verificado confirma el pago.
6. WhatsApp confirma la cita y el panel cambia a confirmada/pagada.

El recordatorio a las 4 horas y la expiración a las 6 horas se pueden explicar o demostrar en una prueba técnica aparte, sin fingir que transcurrieron en la grabación del pago real.

## Pendientes antes de programar

- Revisar este documento con el usuario y diseñar pantallas, mensajes y Flows.
- Configurar la API key de pey y el secreto de webhook en el entorno de despliegue.
- Revisar Flows, plantillas, automatizaciones y código previo de Kapso antes de configurar el número para la demo.
- Validar push real en Banamex/iPhone.
- Definir nombre del producto y datos del consultorio de demo.
- Confirmar si el anticipo se descuenta del precio total y cómo se muestra ese total.
- Definir límites para reagendar después de una inasistencia.
- Definir comportamiento para citas creadas con menos de 24 horas cuando el paciente haya solicitado recordatorio.
- Configurar el despliegue y verificar los webhooks en la URL pública HTTPS.
- Confirmar convocatoria, plazo y mecanismo de entrega.

La primera pieza implementada es el verificador del webhook de pey.

## Stack acordado

- Next.js, TypeScript y Tailwind CSS para el panel y Route Handlers para los webhooks.
- Supabase Postgres, Auth y Cron para los datos, el acceso y los recordatorios.
- Cloudflare Workers con OpenNext y Wrangler para desplegar la app y sus endpoints HTTPS.
- API de Kapso y WhatsApp Flows con el número terminado en 8284, verificado como conectado.
- API de pey en producción para el cobro CoDi y su confirmación mediante webhook verificado.

## Plan de integración

Cerrar cada etapa con su prueba de aceptación antes de depender de ella para la siguiente. Cloudflare se puede preparar en paralelo con la activación de pey.

| Etapa | Trabajo | Prueba de aceptación |
| --- | --- | --- |
| 1. pey y CoDi | Activar la cuenta receptora, configurar la API key como secreto y validar push en Banamex/iPhone. Preparar QR desde otra pantalla como alternativa. | Un pago real de $0.01 MXN autorizado en el banco. |
| 2. Cloudflare y webhook | Desplegar Next.js en Workers con OpenNext. Registrar el endpoint HTTPS y verificar la firma del webhook de pey. | Un pago real llega al endpoint. Una firma inválida se rechaza y un evento repetido no confirma dos veces. |
| 3. Supabase y agenda | Guardar pacientes, citas y pagos. Integrar Auth y confirmar la cita en una operación atómica al recibir el pago. | Un pago confirma su cita y dos solicitudes concurrentes no consiguen el mismo horario. |
| 4. Kapso y WhatsApp | Inventariar la configuración del 8284. Integrar el Flow de valoración, la invitación del consultorio y la confirmación al pagar. | Un paciente puede iniciar el flujo en WhatsApp, pagar y ver su cita confirmada también en la agenda. |
| 5. Recordatorios y cambios | Configurar Cron, plantillas y cambios de cita. Aplicar el recordatorio a las 4 h, el vencimiento a las 6 h y el recordatorio opcional de cita. | Se verifican los cambios de estado y los mensajes sin duplicados. Un pago tardío queda en revisión. |
| 6. Entrega | Ejecutar el flujo completo, preparar instrucciones, declarar código previo y grabar la demo. | El video de menos de 3 minutos muestra WhatsApp, autorización bancaria y cita confirmada. |

Avance del 14 de noviembre de 2026: API key creada y cuenta receptora preautorizada del evento utilizada para la prueba. El POST de producción a /codi/pn por $0.01 MXN devolvió HTTP 200 con transactionId y codiId. El push llegó al segundo teléfono. El usuario no autorizó el pago porque era de un colega. Pendiente probar la autorización y la confirmación por webhook. Las claves y el secreto del webhook se configuran fuera del repositorio.

El receptor inicial de pey vive en `/api/webhooks/pey` y usa `PEY_WEBHOOK_SECRET`. Se verificó localmente la firma, el rechazo de cuerpo alterado y la ventana de tiempo. Los eventos autenticados se guardan en Supabase con una clave única por webhook. El receptor responde 204 si Supabase aceptó el evento y 503 si no pudo guardarlo. Falta aplicar la migración y verificar contra una instancia real. Aún falta crear el proyecto Next.js, desplegar en Cloudflare y registrar la URL en pey.

Para activar el almacenamiento, aplicar la migración de `supabase/migrations` y configurar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `PEY_WEBHOOK_SECRET` en el servidor. La clave de rol de servicio es exclusiva del backend.
