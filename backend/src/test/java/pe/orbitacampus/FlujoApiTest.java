package pe.orbitacampus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.server.ResponseStatusException;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
        "spring.datasource.url=jdbc:h2:mem:campus;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "campus.jwt-secret=clave-aislada-para-test-con-mas-de-treinta-y-dos-bytes",
        "campus.admin-email=admin.pruebas@unmsm.edu.pe", "campus.admin-password=PasswordPruebas1",
        "campus.mail-from=test@example.invalid", "campus.verification-link=https://example.invalid/#cuenta"
})
class FlujoApiTest {
    private static final String CLAVE = "PasswordPruebas1";
    @Autowired TestRestTemplate http;
    @Autowired ObjectMapper json;
    @Autowired JdbcClient db;
    @MockitoBean JavaMailSender mail;

    @DynamicPropertySource
    static void mysqlOpcional(DynamicPropertyRegistry registro) {
        String url = System.getenv("TEST_DB_URL");
        if (url == null || url.isBlank()) return;
        registro.add("spring.datasource.url", () -> url);
        registro.add("spring.datasource.username", () -> System.getenv("TEST_DB_USER"));
        registro.add("spring.datasource.password", () -> System.getenv("TEST_DB_PASSWORD"));
    }

    @Test void validaDominiosYEnlaces() {
        assertThat(Reglas.correo(" Ejemplo@UNMSM.edu.pe ")).isEqualTo("ejemplo@unmsm.edu.pe");
        for (String correo : List.of("ejemplo", "a..b@unmsm.edu.pe", "x@unmsm.edu.pe.evil.test", "x@gmail.com", "@unmsm.edu.pe")) {
            assertThatThrownBy(() -> Reglas.correo(correo)).isInstanceOf(ResponseStatusException.class);
        }
        for (String url : List.of("javascript:alert(1)", "http://example.com/foto", "https://a:b@example.com")) {
            assertThatThrownBy(() -> Reglas.evidencia(url)).isInstanceOf(ResponseStatusException.class);
        }
    }

    @Test void verificaCorreoYRecorreAtencionConPermisos() throws Exception {
        assertThat(llamar("GET","/solicitudes",null,null).getStatusCode().value()).isEqualTo(401);
        assertThat(llamar("POST","/auth/login",null,Map.of("correo","x@gmail.com","clave",CLAVE)).getStatusCode().value()).isEqualTo(400);
        String sufijo = "." + java.util.UUID.randomUUID().toString().substring(0,8) + "@unmsm.edu.pe";
        String alumno = registrar("estudiante.pruebas" + sufijo);
        String otro = registrar("otro.pruebas" + sufijo);
        String tecnico = registrar("tecnico.pruebas" + sufijo);
        String admin = login("admin.pruebas@unmsm.edu.pe");
        long idTecnico = idPerfil(tecnico);
        correcto("PUT","/admin/usuarios/"+idTecnico,admin,Map.of("rol","TECNICO","activo",true),204);
        correcto("GET","/auth/perfil",tecnico,null,401);
        tecnico=login("tecnico.pruebas" + sufijo);
        var categoria = cuerpo(correcto("GET","/catalogos",alumno,null,200)).path("categorias").get(0).path("id").asLong();
        var campos=Map.of("titulo","Proyector sin señal","descripcion","No se puede usar el proyector del aula.",
                "ubicacion","Aula 301","categoriaId",categoria);
        correcto("POST","/solicitudes",alumno,Map.of("titulo","Asunto válido","categoriaId",categoria),400);
        correcto("POST","/solicitudes",alumno,Map.of("titulo","Asunto válido","descripcion","Una descripción que pasa",
                "ubicacion","Aula 301","categoriaId",categoria,"evidencia","javascript:alert(1)"),400);
        var respuesta=correcto("POST","/solicitudes",alumno,campos,201);
        assertThat(respuesta.getHeaders().getFirst("X-Request-Id")).isNotBlank();
        long id=cuerpo(respuesta).path("solicitud").path("id").asLong();
        String ruta="/solicitudes/"+id;
        correcto("GET",ruta,otro,null,404);
        correcto("GET",ruta,tecnico,null,404);
        correcto("GET","/admin",alumno,null,403);
        correcto("PUT","/admin/prioridades/MEDIA",admin,Map.of("nombre","Media","horas",721),400);
        correcto("PUT",ruta,alumno,Map.of("estado","EVALUACION","version",0),403);
        correcto("PUT",ruta,admin,Map.of("estado","EVALUACION","version",0),200);
        correcto("PUT",ruta,admin,Map.of("estado","ASIGNADA","version",1),400);
        correcto("PUT",ruta,admin,Map.of("estado","ASIGNADA","version",1,"responsableId",idTecnico),200);
        correcto("PUT",ruta,tecnico,Map.of("estado","ATENCION","version",1),409);
        correcto("PUT",ruta,tecnico,Map.of("estado","ATENCION","version",2),200);
        correcto("POST",ruta+"/comentarios",tecnico,Map.of("mensaje","Se cambió el cable."),201);
        correcto("PUT",ruta,tecnico,Map.of("estado","RESUELTA","version",4),200);
        var fin=cuerpo(correcto("PUT",ruta,admin,Map.of("estado","CERRADA","version",5),200));
        assertThat(fin.path("solicitud").path("estado").asText()).isEqualTo("CERRADA");
        assertThat(fin.path("actividad").size()).isGreaterThanOrEqualTo(7);
        assertThat(db.sql("SELECT COUNT(*) FROM solicitudes WHERE id=:id").param("id",id).query(Long.class).single()).isEqualTo(1);
        correcto("DELETE",ruta,alumno,null,409);
        correcto("POST","/auth/salir",admin,null,204);
        correcto("GET","/admin",admin,null,401);
    }

    @Test void reservaLasCuentasDelGrupoParaElAprovisionamiento() {
        String reservado = "orbita.campus.g7.admin@unmsm.edu.pe";
        correcto("POST", "/auth/registro", null,
                Map.of("nombre", "Persona de prueba", "correo", reservado, "clave", CLAVE), 202);
        correcto("POST", "/auth/reenviar", null, Map.of("correo", reservado), 202);
        correcto("POST", "/auth/recuperar", null, Map.of("correo", reservado), 202);
        assertThat(db.sql("SELECT COUNT(*) FROM usuarios WHERE correo=:correo").param("correo", reservado)
                .query(Long.class).single()).isZero();
    }

    private String registrar(String correo) throws Exception {
        correcto("POST","/auth/registro",null,Map.of("nombre","Persona de prueba","correo",correo,"clave",CLAVE),202);
        correcto("POST","/auth/login",null,Map.of("correo",correo,"clave",CLAVE),403);
        String token = tokenCorreo(correo, "verificar");
        correcto("POST","/auth/verificar",null,Map.of("token",token,"clave",CLAVE),204);
        correcto("POST","/auth/verificar",null,Map.of("token",token,"clave",CLAVE),400);
        return login(correo);
    }

    @Test void restableceYCambiaClaveRevocandoSesiones() throws Exception {
        String correo = "recuperacion." + java.util.UUID.randomUUID().toString().substring(0,8) + "@unmsm.edu.pe";
        String sesion = registrar(correo);
        correcto("POST","/auth/recuperar",null,Map.of("correo","externo@example.com"),400);
        correcto("POST","/auth/recuperar",null,Map.of("correo","inexistente."+correo),202);
        correcto("POST","/auth/recuperar",null,Map.of("correo",correo),202);
        String token = tokenCorreo(correo, "restablecer");
        String nueva = "NuevaClavePruebas23";
        correcto("POST","/auth/restablecer",null,Map.of("token",token,"clave","corta"),400);
        correcto("POST","/auth/restablecer",null,Map.of("token",token,"clave",nueva),204);
        correcto("POST","/auth/restablecer",null,Map.of("token",token,"clave",CLAVE),400);
        correcto("GET","/auth/perfil",sesion,null,401);
        correcto("POST","/auth/login",null,Map.of("correo",correo,"clave",CLAVE),401);
        String posterior = cuerpo(correcto("POST","/auth/login",null,Map.of("correo",correo,"clave",nueva),200)).path("token").asText();
        correcto("POST","/auth/clave",null,Map.of("anterior",nueva,"clave",CLAVE),401);
        correcto("POST","/auth/clave",posterior,Map.of("anterior",CLAVE,"clave","OtraClaveSegura2"),400);
        correcto("POST","/auth/clave",posterior,Map.of("anterior",nueva,"clave",CLAVE),204);
        correcto("GET","/auth/perfil",posterior,null,401);
        assertThat(login(correo)).isNotBlank();
    }

    private String tokenCorreo(String correo, String parametro) {
        var mensajes=ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mail,atLeastOnce()).send(mensajes.capture());
        String consulta = "?" + parametro + "=";
        String enlace = mensajes.getAllValues().stream().filter(m -> m.getTo()[0].equals(correo))
                .flatMap(m -> m.getText().lines()).filter(linea -> linea.startsWith("https://") && linea.contains(consulta))
                .findFirst().orElseThrow();
        String fragmento = URI.create(enlace).getFragment();
        return fragmento.substring(fragmento.indexOf(consulta) + consulta.length());
    }

    private String login(String correo) throws Exception {
        return cuerpo(correcto("POST","/auth/login",null,Map.of("correo",correo,"clave",CLAVE),200)).path("token").asText();
    }

    private long idPerfil(String token) throws Exception {
        return cuerpo(correcto("GET","/auth/perfil",token,null,200)).path("id").asLong();
    }

    private JsonNode cuerpo(ResponseEntity<String> respuesta) throws Exception { return json.readTree(respuesta.getBody()); }

    private ResponseEntity<String> correcto(String metodo,String ruta,String token,Object datos,int status) {
        var respuesta=llamar(metodo,ruta,token,datos);
        assertThat(respuesta.getStatusCode().value()).as("%s %s %s",metodo,ruta,respuesta.getBody()).isEqualTo(status);
        return respuesta;
    }

    private ResponseEntity<String> llamar(String metodo,String ruta,String token,Object datos) {
        HttpHeaders cabeceras=new HttpHeaders();
        cabeceras.setContentType(new MediaType(MediaType.APPLICATION_JSON,StandardCharsets.UTF_8));
        if (token!=null) cabeceras.setBearerAuth(token);
        return http.exchange("/api"+ruta,HttpMethod.valueOf(metodo),new HttpEntity<>(datos,cabeceras),String.class);
    }
}
