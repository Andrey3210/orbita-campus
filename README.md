# Órbita Campus

Plataforma académica para registrar y atender solicitudes de servicios de la Universidad Nacional Mayor de San Marcos. El diseño adapta el tablero, la navegación, la paleta y la mascota de [Órbita Finanzas](https://github.com/Andrey3210/orbita-finanzas).

- [Demostración en GitHub Pages](https://andrey3210.github.io/orbita-campus/)
- [Segundo entregable](docs/segundo-entregable.md) · [Especificación y BDD](docs/especificacion.md) · [Registro de uso de IA](docs/registro-ia.md)
- [Informe del segundo entregable (PDF)](docs/Informe-segundo-entregable.pdf)
- [API OpenAPI](docs/openapi.yaml) · [Versiones](CHANGELOG.md) · [GitHub Actions](https://github.com/Andrey3210/orbita-campus/actions)

La demostración de Pages usa registros ficticios guardados en el navegador. En **Cuenta** puedes elegir cualquiera de los cuatro perfiles y ensayar el flujo completo. La API real exige correos verificados y controla los roles en el servidor. Evita ingresar datos personales en la demo.

## Ejecutar con MySQL

1. Copia `.env.example` a `.env`. Configura contraseñas de base de datos, un secreto JWT aleatorio de al menos 32 bytes y, si necesitas aprovisionar la primera cuenta administrativa, su correo institucional y contraseña.
2. Para altas reales, configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` y `VERIFICATION_LINK`. El último apunta al frontend, por ejemplo `https://tu-frontend/#cuenta`. El sistema envía un enlace de un solo uso antes de habilitar el acceso.
3. Desde la raíz ejecuta `docker compose up --build -d`. La API queda en `http://localhost:8080` y la base de datos conserva sus datos en un volumen.
4. En otra terminal ejecuta `cd frontend`, `npm ci` y `npm run dev`. Abre `http://localhost:5173`. El servidor de desarrollo reenvía `/api` a Spring Boot.

Si ya tienes MySQL, también puedes crear una base vacía, exportar `DB_URL`, `DB_USER`, `DB_PASSWORD` y las variables de seguridad del ejemplo. Luego ejecuta `mvn -f backend/pom.xml spring-boot:run`.

## Recorrido de demostración

1. Como **Estudiante**, crea una solicitud con categoría, ubicación, descripción y una evidencia HTTPS opcional.
2. Cambia a **Supervisor** desde Cuenta. Abre la solicitud, pásala a evaluación y luego asígnala a Sofía Demo.
3. Cambia a **Técnico**. Abre la solicitud asignada, comienza la atención, añade un comentario y resuélvela.
4. Vuelve a **Supervisor** para cerrarla. Revisa seguimiento, historial e indicadores.
5. Como **Administrador**, revisa usuarios, roles, categorías, áreas, plazos y etiquetas de estado.

## Seguridad y validaciones

El correo debe tener el formato de `ejemplo@unmsm.edu.pe`. La API rechaza dominios externos, subdominios, formatos incorrectos y cuentas que aún no verificaron el buzón. Las contraseñas se guardan con BCrypt. El JWT vence a los 30 minutos y el servidor verifica el estado, rol y versión de sesión actuales. Un cambio de rol, una desactivación o el cierre de sesión invalidan los JWT anteriores.

El acceso limita intentos desde una misma dirección de conexión. Si se usa un proxy para una instancia compartida, aplica también límites en el proxy y configura el registro de direcciones según la infraestructura.

La API valida el tamaño de los campos, las categorías activas, el protocolo HTTPS de las evidencias, las transiciones por rol y los técnicos disponibles. La versión de cada solicitud permite detectar ediciones concurrentes. Las consultas parametrizadas y las claves foráneas protegen la integridad. Los logs registran ID de solicitud HTTP, método, duración y código de respuesta.

## Integración y despliegue

- `npm test` comprueba formato institucional, transiciones e indicadores.
- `mvn -f backend/pom.xml verify` prueba la API por HTTP con una base aislada. Configura `TEST_DB_URL`, `TEST_DB_USER` y `TEST_DB_PASSWORD` para ejecutar los mismos casos con MySQL.
- Las ramas y pull requests pasan pruebas de frontend y backend. El pipeline comprueba MySQL y la construcción del contenedor. Los pushes a `main` publican Pages. Las etiquetas `v*` publican una versión y una imagen en GHCR.
- Para conectar Pages a una API desplegada por HTTPS, agrega su URL sin `/api` como variable de repositorio `VITE_API_URL` y vuelve a ejecutar el workflow de Pages. Configura el origen `https://andrey3210.github.io` en `APP_ORIGINS`, además de un MySQL persistente y SMTP.
- `/actuator/health` indica si la API y MySQL están disponibles. `/actuator/info` muestra la versión. `/actuator/metrics` exige una sesión administradora vigente.
