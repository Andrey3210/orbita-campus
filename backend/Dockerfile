FROM maven:3.9-eclipse-temurin-17 AS compilacion
WORKDIR /src
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src src
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=compilacion /src/target/orbita-campus-*.jar /app/campus.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/campus.jar"]
