package pe.orbitacampus;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile({"datos-evaluacion", "historial-grupo7"})
@Order
class DatosEvaluacion implements ApplicationRunner {
    record Cuenta(String nombre, String correo, String clave, Reglas.Rol rol) {}
    record Caso(String titulo, String categoria, String lugar, String descripcion, String revision, String solucion) {}
    private record Perfil(long id, Reglas.Rol rol) {}
    private record Autores(long estudiante, long tecnico, long supervisor, long administrador) {}

    private static final List<Caso> CASOS = List.of(
        new Caso("Falla de proyección en aula de cómputo", "Soporte informático", "Pabellón de Sistemas, aula 203",
            "El equipo pierde la señal durante la exposición. La falla se reproduce con dos laptops.",
            "Confirmar la falla con otro cable y revisar la configuración de entrada.", "Se reemplazó el cable y se verificó la proyección."),
        new Caso("Luminaria intermitente en pasillo", "Mantenimiento", "Pabellón de aulas, segundo piso",
            "Dos luminarias parpadean durante el turno nocturno y reducen la visibilidad.",
            "Programar una revisión eléctrica fuera del horario de clases.", "Se sustituyó el módulo defectuoso y se probó el circuito."),
        new Caso("Reserva de laboratorio para práctica", "Reserva de ambientes", "Laboratorio 2",
            "Se solicita un laboratorio para una práctica de dos horas con veinte participantes.",
            "Comprobar el aforo y que el horario solicitado esté disponible.", "Se confirmó el horario y se registró la entrega del ambiente."),
        new Caso("Consulta sobre constancia académica", "Trámite administrativo", "Mesa de partes de la facultad",
            "Se solicita orientación sobre los requisitos y plazos para obtener una constancia académica.",
            "Revisar qué trámite corresponde y validar los requisitos vigentes.", "Se enviaron al solicitante los requisitos y el canal de atención."),
        new Caso("Conexión Wi-Fi inestable", "Soporte informático", "Biblioteca, sala de estudio",
            "La conexión se interrumpe cuando la sala está ocupada y obliga a iniciar sesión repetidamente.",
            "Medir cobertura y revisar los registros del punto de acceso.", "Se ajustó el canal y se validó la conexión con varios equipos."),
        new Caso("Banco suelto en área común", "Mantenimiento", "Patio central, acceso norte",
            "Un banco se mueve al sentarse. Se solicita revisar los anclajes y señalizar el área.",
            "Coordinar la revisión de los anclajes y aislar el banco durante el trabajo.", "Se fijaron los anclajes y se retiró la señalización.")
    );
    private static final List<String> PRIORIDADES = List.of("MEDIA", "ALTA", "URGENTE", "BAJA");
    private static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static final List<Integer> DIAS_HISTORIAL = List.of(0, 1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 19, 22, 26, 30, 34, 39, 45);
    private final JdbcClient db;
    private final ObjectMapper json;
    private final PasswordEncoder claves;
    private final String manifiesto;
    private final Environment entorno;

    DatosEvaluacion(JdbcClient db, ObjectMapper json, PasswordEncoder claves, Environment entorno,
                    @Value("${EVALUACION_CUENTAS:}") String manifiesto) {
        this.db = db;
        this.json = json;
        this.claves = claves;
        this.entorno = entorno;
        this.manifiesto = manifiesto;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        if (entorno.matchesProfiles("datos-evaluacion")) cargarEvaluacion();
        if (entorno.matchesProfiles("historial-grupo7")) cargarHistorial();
    }

    private void cargarEvaluacion() throws Exception {
        var usuarios = json.readValue(manifiesto, new TypeReference<List<Cuenta>>() {});
        if (usuarios.size() != 12 || usuarios.stream().map(Cuenta::correo).distinct().count() != 12
                || usuarios.stream().map(Cuenta::clave).distinct().count() != 12) {
            throw new IllegalArgumentException("Configura las doce cuentas de evaluación con claves distintas.");
        }
        var perfiles = new ArrayList<Perfil>();
        for (Cuenta usuario : usuarios) perfiles.add(provisionar(usuario));
        var estudiantes = porRol(perfiles, Reglas.Rol.ESTUDIANTE, 6);
        var tecnicos = porRol(perfiles, Reglas.Rol.TECNICO, 3);
        var supervisores = porRol(perfiles, Reglas.Rol.SUPERVISOR, 2);
        porRol(perfiles, Reglas.Rol.ADMIN, 1);
        Instant ahora = Instant.now();
        int indice = 0;
        for (Reglas.Estado estado : Reglas.Estado.values()) {
            for (int variante = 0; variante < 4; variante++) {
                var caso = CASOS.get((estado.ordinal() + variante) % CASOS.size());
                long estudiante = estudiantes.get(indice % estudiantes.size()).id();
                long tecnico = tecnicos.get((estado.ordinal() + variante) % tecnicos.size()).id();
                long supervisor = supervisores.get(variante % supervisores.size()).id();
                Instant creada = ahora.minus(5L + (indice * 13L) % 150, ChronoUnit.HOURS);
                String titulo = "[G7-%02d] %s".formatted(++indice, caso.titulo());
                cargar(caso, estado, variante, titulo, new Autores(estudiante, tecnico, supervisor, supervisor),
                        creada, 3L + variante);
            }
        }
    }

    private void cargarHistorial() {
        var autores = new Autores(cuentaExistente(Reglas.Rol.ESTUDIANTE), cuentaExistente(Reglas.Rol.TECNICO),
                cuentaExistente(Reglas.Rol.SUPERVISOR), cuentaExistente(Reglas.Rol.ADMIN));
        Instant ahora = Instant.now();
        var hoy = ahora.atZone(LIMA).toLocalDate();
        var estados = Reglas.Estado.values();
        for (int i = 0; i < DIAS_HISTORIAL.size(); i++) {
            var estado = estados[(i + i / estados.length) % estados.length];
            var caso = CASOS.get((i + 2 * (i / estados.length)) % CASOS.size());
            int variante = i % PRIORIDADES.size();
            String titulo = "[HIST-G7-%02d] %s".formatted(i + 1, caso.titulo());
            Instant creada = i == 0 ? ahora : hoy.minusDays(DIAS_HISTORIAL.get(i))
                    .atTime(8 + i % 5, 15).atZone(LIMA).toInstant();
            var responsables = i % 2 == 0 ? autores
                    : new Autores(autores.estudiante(), autores.tecnico(), autores.supervisor(), autores.supervisor());
            cargar(caso, estado, variante, titulo, responsables, creada, 2L + i % 9);
        }
    }

    private long cuentaExistente(Reglas.Rol rol) {
        return db.sql("""
                SELECT id FROM usuarios WHERE correo=:correo AND rol=:rol AND activo=TRUE AND verificado=TRUE FOR UPDATE
                """).param("correo", CuentasPrueba.direccion(rol)).param("rol", rol.name()).query(Long.class).optional()
                .orElseThrow(() -> new IllegalStateException("Falta una cuenta de evaluación activa para " + rol + "."));
    }

    private Perfil provisionar(Cuenta usuario) {
        String correo = Reglas.correo(usuario.correo());
        if (!correo.startsWith("orbita.campus.g7.lab.") || !usuario.clave().matches("G7-[a-f0-9]{36}")) {
            throw new IllegalArgumentException("Cuenta de evaluación inválida.");
        }
        var previo = db.sql("SELECT id,rol,activo,verificado FROM usuarios WHERE correo=:correo")
                .param("correo", correo).query((rs,n) -> {
                    if (!rs.getBoolean("activo") || !rs.getBoolean("verificado") || !rs.getString("rol").equals(usuario.rol().name())) {
                        throw new IllegalStateException("El perfil de evaluación existente requiere revisión.");
                    }
                    return rs.getLong("id");
                }).optional();
        if (previo.isPresent()) return new Perfil(previo.get(), usuario.rol());
        var id = new GeneratedKeyHolder();
        db.sql("""
                INSERT INTO usuarios(nombre,correo,clave,rol,verificado) VALUES (:nombre,:correo,:clave,:rol,TRUE)
                """).param("nombre", Reglas.texto(usuario.nombre(), 2, 100, "El nombre"))
                .param("correo", correo).param("clave", claves.encode(usuario.clave())).param("rol", usuario.rol().name()).update(id);
        return new Perfil(Objects.requireNonNull(id.getKey()).longValue(), usuario.rol());
    }

    private List<Perfil> porRol(List<Perfil> perfiles, Reglas.Rol rol, int cantidad) {
        var resultado = perfiles.stream().filter(p -> p.rol() == rol).toList();
        if (resultado.size() != cantidad) throw new IllegalArgumentException("Distribución inválida de cuentas de evaluación.");
        return resultado;
    }

    private void cargar(Caso caso, Reglas.Estado estado, int variante, String titulo, Autores autores,
                        Instant creada, long horasDeResolucion) {
        long estudiante = autores.estudiante();
        long tecnico = autores.tecnico();
        long supervisor = autores.supervisor();
        long gestor = autores.administrador();
        var anterior = db.sql("SELECT id FROM solicitudes WHERE usuario_id=:usuario AND titulo=:titulo")
                .param("usuario", estudiante).param("titulo", titulo).query(Long.class).optional();
        if (anterior.isPresent()) return;
        String prioridad = PRIORIDADES.get(variante);
        long categoria = db.sql("SELECT id FROM categorias WHERE nombre=:nombre AND activo=TRUE")
                .param("nombre", caso.categoria()).query(Long.class).single();
        int horas = db.sql("SELECT horas FROM prioridades WHERE clave=:clave").param("clave", prioridad).query(Integer.class).single();
        Instant resuelta = estado.terminada() ? creada.plus(horasDeResolucion, ChronoUnit.HOURS) : null;
        var key = new GeneratedKeyHolder();
        db.sql("""
                INSERT INTO solicitudes(usuario_id,categoria_id,responsable_id,titulo,descripcion,ubicacion,prioridad,estado,creada,vence,resuelta)
                VALUES(:usuario,:categoria,:responsable,:titulo,:descripcion,:lugar,:prioridad,:estado,:creada,:vence,:resuelta)
                """).param("usuario", estudiante).param("categoria", categoria)
                .param("responsable", estado.ordinal() >= 2 ? tecnico : null)
                .param("titulo", titulo).param("descripcion", caso.descripcion()).param("lugar", caso.lugar())
                .param("prioridad", prioridad).param("estado", estado.name()).param("creada", Timestamp.from(creada))
                .param("vence", Timestamp.from(creada.plus(horas, ChronoUnit.HOURS)))
                .param("resuelta", resuelta == null ? null : Timestamp.from(resuelta)).update(key);
        long id = Objects.requireNonNull(key.getKey()).longValue();
        evento(id, estudiante, "ESTADO", "Se registró la solicitud.", creada);
        evento(id, estudiante, "COMENTARIO", caso.descripcion(),
                estado == Reglas.Estado.REGISTRADA ? creada : creada.plusSeconds(300));
        if (estado.ordinal() >= 1) {
            evento(id, supervisor, "ESTADO", "Estado: EVALUACION.", creada.plusSeconds(1200));
            evento(id, supervisor, "COMENTARIO", caso.revision(), creada.plusSeconds(1500));
            if (!prioridad.equals("MEDIA")) evento(id, gestor, "PRIORIDAD", "Prioridad: " + prioridad + ".", creada.plusSeconds(1800));
        }
        if (estado.ordinal() >= 2) {
            evento(id, supervisor, "ESTADO", "Estado: ASIGNADA.", creada.plusSeconds(2400));
            evento(id, supervisor, "ASIGNACION", "Se asignó la solicitud al técnico de turno.", creada.plusSeconds(2700));
        }
        if (estado.ordinal() >= 3) evento(id, tecnico, "ESTADO", "Estado: ATENCION.", creada.plusSeconds(3600));
        if (resuelta != null) evento(id, tecnico, "ESTADO", "Estado: RESUELTA. " + caso.solucion(), resuelta);
        if (estado == Reglas.Estado.CERRADA) evento(id, gestor, "ESTADO", "Estado: CERRADA. El área responsable confirmó la atención.", resuelta.plusSeconds(600));
    }

    private void evento(long id, long autor, String tipo, String texto, Instant fecha) {
        db.sql("""
                INSERT INTO actividad(solicitud_id,autor_id,tipo,mensaje,fecha) VALUES(:id,:autor,:tipo,:mensaje,:fecha)
                """).param("id", id).param("autor", autor).param("tipo", tipo)
                .param("mensaje", texto).param("fecha", Timestamp.from(fecha)).update();
    }
}
