FROM maven:3.9-eclipse-temurin-17 AS compilacion
WORKDIR /src
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src src
RUN mvn -B -ntp -DskipTests package

FROM caddy:2.10-alpine AS gateway

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=compilacion /src/target/orbita-campus-*.jar /app/campus.jar
COPY --from=gateway /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile iniciar.sh /app/
RUN sed -i 's/\r$//' /app/iniciar.sh
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/bin/sh","/app/iniciar.sh"]
