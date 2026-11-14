# Manual técnico · Órbita Campus

## Componentes y despliegue

El frontend React se compila con Vite y se publica en GitHub Pages. Caddy recibe el tráfico de la API y lo reenvía por loopback a Spring Boot con un máximo de 64 KB por petición de API. Spring Security autoriza la operación y los servicios aplican reglas de negocio y transacciones. MySQL conserva usuarios, catálogo, solicitudes e historial mediante claves foráneas y un volumen privado. Brevo envía los mensajes de cuenta.

- **Local.** Copia [el archivo de ejemplo](../.env.example) a `.env`, genera un secreto JWT aleatorio de 32 bytes o más y contraseñas de MySQL independientes. Ejecuta `docker compose up --build -d`. Desde `frontend`, ejecuta `npm ci` y `npm run dev`. [Instalación y perfiles](../README.md#ejecutar-con-mysql)
- **CI.** `mvn -B -f backend/pom.xml -Pseguridad verify spotbugs:spotbugs` prueba la API y genera el informe SAST. El workflow crea una base MySQL temporal, construye el contenedor, genera claves efímeras y ejecuta Playwright, DAST, carga y estrés. [Workflow](../.github/workflows/integracion.yml)
- **Publicación.** La etiqueta anotada `v1.0.0` empaqueta el JAR y publica la imagen `ghcr.io/andrey3210/orbita-campus:v1.0.0`. Selecciona la imagen en el servicio existente de Railway y verifica `/actuator/health` y `/actuator/info`. Conserva el servicio MySQL, sus referencias y el volumen. Pages se actualiza al integrar cambios a `main`.

## Configuración

| Ajuste | Uso |
| --- | --- |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Conexión privada a MySQL. |
| `JWT_SECRET` | Firma de sesión. Cambiarlo invalida las sesiones existentes. |
| `APP_ORIGINS` | Orígenes exactos del frontend. |
| `VERIFICATION_LINK`, `MAIL_FROM`, `BREVO_API_KEY` | Enlace público de cuenta y correo transaccional. |
| `TRACE_SAMPLE_RATE` | Probabilidad de muestreo de trazas entre 0 y 1. El valor predeterminado es 0.1. |
| `VITE_API_URL` | Variable de GitHub Pages y del workflow de disponibilidad. |

Las credenciales se guardan como variables del ambiente. Las actualizaciones de estado usan una versión de fila y transacciones para preservar el historial ante cambios simultáneos. La API usa DTO, servicios por dominio, consultas SQL parametrizadas y catálogos compartidos.

## Operación e incidentes

1. Abre **Monitoreo de Órbita Campus** en Actions. Se programa dos veces por hora y permite ejecución manual. El job registra tiempos, intenta tres veces y genera una anotación de error si el servicio sigue inaccesible. GitHub puede enviar los avisos programados al responsable del workflow según sus preferencias de notificación. [Notificaciones](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs)
2. Si falla la API, revisa `/actuator/health`, el estado de MySQL y el historial de despliegues. Consulta `/actuator/metrics/http.server.requests` con JWT de administrador. La respuesta agrega conteo y tiempo y se puede filtrar por etiquetas de método, ruta y estado.
3. Busca en los logs de Railway el valor de `X-Request-Id` mostrado por el usuario. Correlaciónalo con `trace.id` y `span.id`. Los eventos HTTP usan rutas de plantilla, sin cuerpos, cabeceras de autorización, contraseñas ni parámetros de consulta.
4. Si el problema coincide con el último despliegue, selecciona la versión anterior desde Railway y verifica salud, versión y un caso de lectura. Antes de modificar el esquema o restaurar el volumen, documenta el alcance del incidente y conserva una copia según el procedimiento del entorno.
5. Si el problema es de correo, revisa en Brevo la entrega y en la API las respuestas 503. Nunca pegues los enlaces de activación en un informe público.

## Reproducir las pruebas de rendimiento

Apunta `API_PRUEBAS` a un gateway de loopback sobre una base de evaluación, configura `QA_ADMIN_EMAIL` y `QA_ADMIN_PASSWORD` de ese ambiente y ejecuta `node calidad/carga.mjs`. Se hacen lecturas concurrentes de catálogo, lista de solicitudes y salud. Se mide p50, p95, p99, solicitudes por segundo y porcentaje de error. La carga normal y la recuperación exigen p95 ≤ 750 ms y errores ≤ 1 %. El umbral evalúa el escenario definido, con el volumen de datos que tenga el ambiente.

[Contrato OpenAPI](openapi.yaml) · [Monitorización de Railway](https://docs.railway.com/observability) · [Trazas de Spring Boot](https://docs.spring.io/spring-boot/3.5/reference/actuator/tracing.html)
