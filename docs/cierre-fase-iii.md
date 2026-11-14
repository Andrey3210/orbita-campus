# Evidencias de las fases I a III

## Diseño y especificación

El archivo conserva los [wireframes originales](https://www.figma.com/design/NEfkdhD8dOUyIiAtHrAVWZ?node-id=0-1) y contiene el [recorrido editable de la aplicación actual](https://www.figma.com/design/NEfkdhD8dOUyIiAtHrAVWZ?node-id=37-3393), con pantallas para escritorio y móvil.

| Historia | Tareas de interfaz | Tareas de API y datos | Verificación |
| --- | --- | --- | --- |
| Identidad institucional | Formularios de alta, acceso y recuperación | Validar dominio, guardar hash, emitir enlace y JWT | Dominio externo, verificación, expiración y revocación |
| Registrar una solicitud | Capturar categoría, asunto, descripción, ubicación y evidencia | Validar datos, guardar solicitud y registrar el evento inicial | Alta válida y campos inválidos |
| Evaluar y asignar | Editar prioridad y seleccionar técnico | Comprobar estado, versión y disponibilidad del responsable | Asignación válida y rechazo por rol |
| Atender y cerrar | Mostrar acciones del rol e historial | Persistir transiciones, comentarios y resolución | Recorrido de los seis estados |
| Consultar indicadores | Mostrar filtros, etapas y gráficos | Aplicar el alcance de cada cuenta | Filtro recordado y métricas por rol |
| Administrar catálogos | Mostrar usuarios, roles, áreas, prioridades y estados | Controlar acceso y validar cambios | Acceso admin y rechazo a otros roles |

## Ambientes, Git y despliegue

| Ambiente | Configuración | Evidencia |
| --- | --- | --- |
| Desarrollo | Vite, API Spring Boot y MySQL mediante Docker Compose | [Instrucciones](../README.md#ejecutar-con-mysql) |
| Pruebas | GitHub Actions inicia una base MySQL aislada y ejecuta pruebas HTTP y de JavaScript | [Integración y pruebas](https://github.com/Andrey3210/orbita-campus/actions/workflows/integracion.yml) |
| Publicación | GitHub Pages, API en Railway y MySQL persistente en red privada | [Portal](https://andrey3210.github.io/orbita-campus/) · [API](https://orbita-campus-production.up.railway.app/actuator/health) |

Los cambios se preparan en ramas como `entrega/cierre-fase-3`, pasan por una revisión mediante pull request y se integran a `main`. Las etiquetas de versión generan un JAR, una imagen en GHCR y una versión candidata. El flujo de Pages comprueba la salud de la API antes de publicar la interfaz.

La interfaz guarda en una cookie la última categoría filtrada. La cookie contiene un identificador de catálogo, dura 30 días, usa `SameSite=Lax` y agrega `Secure` en HTTPS. La sesión JWT se maneja por separado en `sessionStorage` y se envía en `Authorization`.

## API Gateway y alternativas

Caddy recibe las peticiones de la API y de salud, reenvía las rutas autorizadas a Spring Boot por loopback y limita el cuerpo de las peticiones a 64 KB. Railway termina HTTPS. Spring Security valida autenticación, permisos, origen y límites de intentos. MySQL permanece en la red privada. El [contrato OpenAPI](openapi.yaml) describe recursos, métodos, parámetros y códigos de respuesta. [Configuración del gateway](../backend/Caddyfile) · [Directiva de límite de cuerpo](https://caddyserver.com/docs/caddyfile/directives/request_body)

| Tecnología | Aplicación al proyecto |
| --- | --- |
| REST | Contrato actual de la interfaz para operar sobre solicitudes, usuarios y catálogos con HTTP y JSON. [OpenAPI](openapi.yaml) |
| GraphQL | Permitiría consultar una selección de campos de categorías, áreas e indicadores en una llamada. [Documentación](https://graphql.org/learn/) |
| gRPC | Sería una opción para comunicación interna tipada entre servicios si la API se divide. [Documentación](https://grpc.io/docs/what-is-grpc/introduction/) |
| Webhooks | Permitirían notificar a otra aplicación cuando se asigna o resuelve una solicitud. Un consumidor necesitaría verificar la firma y tolerar reintentos. [Documentación](https://docs.github.com/en/webhooks/about-webhooks) |

## Controles de seguridad y pruebas

| Control inspirado en OWASP | Implementación | Evidencia |
| --- | --- | --- |
| Autenticación | Correo de la UNMSM, enlace de un solo uso, contraseña con BCrypt y límite de intentos | Pruebas de dominio, verificación y recuperación |
| Autorización | Comprobación en servidor del rol, propietario y responsable de la solicitud | Rechazos 401, 403 y 404 en las pruebas HTTP |
| Sesión | JWT de 30 minutos, validación del emisor y revocación por versión de cuenta | Cierre, cambio de contraseña y reasignación de rol |
| Entradas | DTO con validaciones, parámetros SQL enlazados y evidencias HTTPS | Pruebas de campos y enlaces inválidos |
| Secretos | Configuración mediante variables de entorno y credenciales de correo únicamente en el servicio | `.env.example` contiene nombres de variables y valores de ejemplo |
| Conexión web | HTTPS, CORS limitado al origen configurado y gateway delante de Spring Boot | Preflight permitido para Pages, rechazo de un origen ajeno y verificación del contenedor |

Referencias para los controles. [OWASP ASVS](https://asvs.owasp.org/) · [Gestión de sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
