# Segundo entregable · Órbita Campus

Versión candidata **v0.3.0-rc.2** para el Taller de Construcción de Software Web de la UNMSM.

[Descargar informe PDF desde Pages](https://andrey3210.github.io/orbita-campus/Informe-segundo-entregable.pdf)

| Fase | Evidencia |
| --- | --- |
| 1. Análisis y prototipo | [Especificación, historias, BDD y arquitectura](especificacion.md) |
| 2. MVP full-stack | React, API Spring Boot, esquema MySQL, roles y flujo de atención verificable |
| 3. Seguridad y DevOps | JWT, correo institucional, autorización, Docker, API OpenAPI, pruebas HTTP y flujos de integración y despliegue |

La portada en [GitHub Pages](https://andrey3210.github.io/orbita-campus/) presenta el acceso institucional y ofrece una demostración con cuatro perfiles ficticios. La ejecución integrada necesita el backend y MySQL. El [README](../README.md#ejecutar-con-mysql) documenta la configuración y los pasos para el evaluador.

La entrega de correo se comprueba en la prueba de integración con un emisor simulado. Para recibir mensajes en buzones reales hay que configurar SMTP. Para uso integrado en Internet hay que desplegar la API y su base por separado y configurar `VITE_API_URL` en Pages.

La API usa validaciones en servidor, control por recurso, contraseñas con BCrypt, sesiones con JWT y revocación por versión. Los usuarios pueden recuperar o cambiar su contraseña y las sesiones anteriores se invalidan. El [contrato OpenAPI](openapi.yaml) documenta rutas y respuestas. [GitHub Actions](https://github.com/Andrey3210/orbita-campus/actions) conserva las ejecuciones.
