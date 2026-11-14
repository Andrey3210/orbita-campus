# Órbita Campus

Proyecto académico para registrar y atender solicitudes de servicios universitarios de la UNMSM. Conserva la estructura de tablero y navegación de [Órbita Finanzas](https://github.com/Andrey3210/orbita-finanzas) y utiliza una paleta institucional con imágenes generadas de espacios universitarios referenciales.

- [Portal en GitHub Pages](https://andrey3210.github.io/orbita-campus/)
- [Entrega final · Fases I a IV](docs/entrega-final.md) · [Manual de usuario](docs/manual-usuario.md) · [Manual técnico](docs/manual-tecnico.md)
- [Segundo entregable](docs/segundo-entregable.md) · [Especificación y BDD](docs/especificacion.md) · [Registro de uso de IA](docs/registro-ia.md)
- [Informe del segundo entregable (PDF)](docs/Informe-segundo-entregable.pdf)
- [Evidencias de las fases I a III](docs/cierre-fase-iii.md)
- [API OpenAPI](docs/openapi.yaml) · [Versiones](CHANGELOG.md) · [GitHub Actions](https://github.com/Andrey3210/orbita-campus/actions)

El portal publicado usa la API de Railway y guarda sus cuentas y solicitudes en MySQL. [Estado de la API pública](https://orbita-campus-production.up.railway.app/actuator/health)

## Ejecutar con MySQL

1. Copia `.env.example` a `.env`. Configura contraseñas de base de datos, un secreto JWT aleatorio de al menos 32 bytes y, si necesitas aprovisionar la primera cuenta administrativa, su correo institucional y contraseña.
2. Para altas y recuperación, configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` y `VERIFICATION_LINK`. El último apunta a la ruta de cuenta del frontend, por ejemplo `https://tu-frontend/#cuenta`. El sistema envía enlaces de un solo uso que vencen en 30 minutos. La confirmación del correo solicita la contraseña elegida durante el registro.
3. Desde la raíz ejecuta `docker compose up --build -d`. La API queda en `http://localhost:8080` y la base de datos conserva sus datos en un volumen.
4. En otra terminal ejecuta `cd frontend`, `npm ci` y `npm run dev`. Abre `http://localhost:5173`. El servidor de desarrollo reenvía `/api` a Spring Boot.

Si ya tienes MySQL, también puedes crear una base vacía, exportar `DB_URL`, `DB_USER`, `DB_PASSWORD` y las variables de seguridad del ejemplo. Luego ejecuta `mvn -f backend/pom.xml spring-boot:run`.

## Recorrido de prueba

En una instalación local puedes aprovisionar una cuenta por rol con el perfil Spring `pruebas-locales`. Exporta `PRUEBA_ESTUDIANTE_PASSWORD`, `PRUEBA_TECNICO_PASSWORD`, `PRUEBA_SUPERVISOR_PASSWORD` y `PRUEBA_ADMIN_PASSWORD`, cada una con una contraseña inicial distinta. Activa el perfil con `SPRING_PROFILES_ACTIVE=pruebas-locales` y ejecuta el backend directamente con Java o Maven. El perfil usa la interfaz local y crea las cuentas `orbita.campus.g7.<rol>@unmsm.edu.pe` como verificadas para la prueba. Las contraseñas iniciales solo se aplican durante el aprovisionamiento. Guarda las contraseñas fuera del repositorio. Usa este perfil con una base local de prueba.

1. Como **Estudiante**, crea una solicitud con categoría, ubicación, descripción y una evidencia HTTPS opcional.
2. Cierra sesión e ingresa como **Supervisor**. Abre la solicitud, pásala a evaluación y asígnala al técnico de prueba.
3. Ingresa como **Técnico**. Abre la solicitud asignada, comienza la atención, añade un comentario y resuélvela.
4. Vuelve a ingresar como **Supervisor** para cerrarla. Revisa seguimiento, historial e indicadores.
5. Ingresa como **Administrador** para revisar usuarios, roles, categorías, áreas, plazos y etiquetas de estado.

## Seguridad y validaciones

El correo debe tener el formato de `ejemplo@unmsm.edu.pe`. La API rechaza dominios externos, subdominios, formatos incorrectos y cuentas que aún no verificaron el buzón. Las contraseñas se guardan con BCrypt. El JWT vence a los 30 minutos y el servidor verifica el estado, rol y versión de sesión actuales. El cambio o restablecimiento de contraseña, un cambio de rol, una desactivación y el cierre de sesión revocan los JWT anteriores. La recuperación devuelve una respuesta genérica para direcciones institucionales.

El acceso limita intentos desde una misma dirección de conexión. Si se usa un proxy para una instancia compartida, aplica también límites en el proxy y configura el registro de direcciones según la infraestructura.

La API valida el tamaño de los campos, las categorías activas, el protocolo HTTPS de las evidencias, las transiciones por rol y los técnicos disponibles. La versión de cada solicitud permite detectar ediciones concurrentes. Las consultas parametrizadas y las claves foráneas protegen la integridad. Los logs registran ID de solicitud HTTP, método, duración y código de respuesta.

## Integración y despliegue

- `npm test` comprueba formato institucional, transiciones e indicadores.
- `mvn -f backend/pom.xml verify` prueba la API por HTTP con una base aislada. Configura `TEST_DB_URL`, `TEST_DB_USER` y `TEST_DB_PASSWORD` para ejecutar los mismos casos con MySQL.
- Las ramas y pull requests pasan pruebas de frontend y backend. El pipeline comprueba MySQL y la construcción del contenedor. Los pushes a `main` publican Pages. Las etiquetas `v*` publican una versión y una imagen en GHCR.
- Para conectar Pages a una API desplegada por HTTPS, publica la imagen versionada de GHCR en un servicio de contenedores. Configura `DB_URL` con una base MySQL persistente y `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` y SMTP como variables del servicio. Usa `APP_ORIGINS=https://andrey3210.github.io` y `VERIFICATION_LINK=https://andrey3210.github.io/orbita-campus/#cuenta`.
- Comprueba `/actuator/health` en la API pública. Agrega el origen HTTPS de la API sin `/api` como variable de repositorio `VITE_API_URL`, ejecuta el workflow de Pages y verifica registro, inicio de sesión y recuperación con un buzón institucional.
- En Railway, crea MySQL con volumen y conserva su conexión en la red privada del proyecto. En el servicio de la API, configura la carpeta raíz `/backend` y el archivo de despliegue `/backend/railway.toml`. Configura `DB_URL` a partir de `MYSQLHOST`, `MYSQLPORT` y `MYSQLDATABASE` del servicio de base, y usa sus referencias para `DB_USER` y `DB_PASSWORD`.
- Para enviar verificación y recuperación por HTTPS en plataformas que bloquean SMTP, configura un remitente autorizado en Brevo y define `MAIL_FROM` y `BREVO_API_KEY` en el servicio. Las instalaciones que ya usan SMTP pueden conservar sus variables actuales.
- Para aprovisionar las cuatro cuentas del grupo en una base nueva, configura sus contraseñas iniciales como secretos del servicio y activa temporalmente `SPRING_PROFILES_ACTIVE=provisionar-grupo7`. Después de verificar el acceso por rol, retira ese perfil y las cuatro variables de contraseñas. Los perfiles se conservan en MySQL.
- `/actuator/health` indica si la API y MySQL están disponibles. `/actuator/info` muestra la versión. `/actuator/metrics` exige una sesión administradora vigente.
