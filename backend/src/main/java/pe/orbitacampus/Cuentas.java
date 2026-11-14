package pe.orbitacampus;

import static pe.orbitacampus.Reglas.error;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@Service
class ServicioCuentas {
    record Perfil(long id, String nombre, String correo, Reglas.Rol rol, boolean activo, boolean verificado) {}
    private record Cuenta(Perfil perfil, String clave, int version) {}
    record Sesion(String token, Perfil perfil) {}

    private final JdbcClient db;
    private final PasswordEncoder claves;
    private final JwtEncoder jwt;
    private final JavaMailSender correo;
    private final String origenCorreo;
    private final String enlace;
    private final String claveInvalida;
    private final SecureRandom azar = new SecureRandom();

    ServicioCuentas(JdbcClient db, PasswordEncoder claves, JwtEncoder jwt, JavaMailSender correo,
                    @Value("${campus.mail-from}") String origenCorreo,
                    @Value("${campus.verification-link}") String enlace) {
        this.db = db;
        this.claves = claves;
        this.jwt = jwt;
        this.correo = correo;
        this.origenCorreo = origenCorreo;
        this.enlace = enlace;
        this.claveInvalida = claves.encode(Base64.getUrlEncoder().encodeToString(azar.generateSeed(32)));
    }

    private Perfil leerPerfil(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Perfil(rs.getLong("id"), rs.getString("nombre"), rs.getString("correo"),
                Reglas.Rol.valueOf(rs.getString("rol")), rs.getBoolean("activo"), rs.getBoolean("verificado"));
    }

    private Cuenta leerCuenta(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new Cuenta(leerPerfil(rs), rs.getString("clave"), rs.getInt("version_sesion"));
    }

    private Cuenta porCorreo(String direccion) {
        return db.sql("SELECT * FROM usuarios WHERE correo = :correo").param("correo", direccion)
                .query((rs, n) -> leerCuenta(rs)).optional().orElse(null);
    }

    Perfil actual(Jwt token) {
        Cuenta cuenta = db.sql("SELECT * FROM usuarios WHERE id = :id").param("id", Long.parseLong(token.getSubject()))
                .query((rs, n) -> leerCuenta(rs)).optional().orElse(null);
        if (cuenta == null || !cuenta.perfil.activo || !cuenta.perfil.verificado
                || !cuenta.perfil.rol.name().equals(token.getClaimAsString("rol"))
                || !(token.getClaim("sesion") instanceof Number version) || version.intValue() != cuenta.version) {
            throw error(HttpStatus.UNAUTHORIZED, "La sesión ya no está activa.");
        }
        return cuenta.perfil;
    }

    Sesion iniciar(String direccion, String clave) {
        Cuenta cuenta = porCorreo(Reglas.correo(direccion));
        boolean coincide = clave.getBytes(StandardCharsets.UTF_8).length <= 72
                && claves.matches(clave, cuenta == null ? claveInvalida : cuenta.clave);
        if (!coincide || cuenta == null || !cuenta.perfil.activo) {
            throw error(HttpStatus.UNAUTHORIZED, "Correo o contraseña incorrectos.");
        }
        if (!cuenta.perfil.verificado) throw error(HttpStatus.FORBIDDEN, "Confirma tu correo institucional antes de entrar.");
        return new Sesion(Seguridad.token(jwt, cuenta.perfil.id, cuenta.perfil.rol, cuenta.version), cuenta.perfil);
    }

    @Transactional
    public void registrar(String nombre, String direccion, String clave) {
        String normal = Reglas.correo(direccion);
        validarClave(clave);
        String nombreValido = Reglas.texto(nombre, 2, 100, "El nombre");
        if (porCorreo(normal) != null) return;
        try {
            db.sql("INSERT INTO usuarios (nombre, correo, clave, rol) VALUES (:nombre,:correo,:clave,'ESTUDIANTE')")
                    .param("nombre", nombreValido).param("correo", normal).param("clave", claves.encode(clave)).update();
        } catch (DuplicateKeyException duplicada) {
            return;
        }
        reenviar(normal);
    }

    @Transactional
    public void reenviar(String correoInstitucional) {
        String normal = Reglas.correo(correoInstitucional);
        if (origenCorreo.isBlank()) throw error(HttpStatus.SERVICE_UNAVAILABLE, "El envío de verificación todavía no está configurado.");
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(azar.generateSeed(32));
        Instant ahora = Instant.now();
        int cambios = db.sql("""
                UPDATE usuarios SET token_hash=:hash, token_vence=:vence
                WHERE correo=:correo AND activo=TRUE AND verificado=FALSE
                AND (token_vence IS NULL OR token_vence <= :limite)
                """).param("hash", huella(token)).param("vence", java.sql.Timestamp.from(ahora.plusSeconds(1800)))
                .param("correo", normal).param("limite", java.sql.Timestamp.from(ahora.plusSeconds(1740))).update();
        if (cambios == 0) return;
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(origenCorreo);
        mensaje.setTo(normal);
        mensaje.setSubject("Verifica tu cuenta de Órbita Campus");
        mensaje.setText("Confirma tu correo institucional en los próximos 30 minutos: " + enlace + "?verificar=" + token);
        try {
            correo.send(mensaje);
        } catch (MailException fallo) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo enviar la verificación. Vuelve a intentarlo más tarde.");
        }
    }

    void verificar(String valor) {
        int filas = db.sql("""
                UPDATE usuarios SET verificado=TRUE, token_hash=NULL, token_vence=NULL
                WHERE token_hash=:hash AND token_vence > :ahora AND activo=TRUE AND verificado=FALSE
                """).param("hash", huella(valor)).param("ahora", java.sql.Timestamp.from(Instant.now())).update();
        if (filas != 1) throw error(HttpStatus.BAD_REQUEST, "El enlace es inválido o venció. Solicita uno nuevo.");
    }

    void salir(Perfil quien) {
        db.sql("UPDATE usuarios SET version_sesion=version_sesion+1 WHERE id=:id").param("id", quien.id).update();
    }

    List<Perfil> usuarios() {
        return db.sql("SELECT * FROM usuarios ORDER BY nombre, id").query((rs, n) -> leerPerfil(rs)).list();
    }

    List<Map<String, Object>> tecnicos() {
        return db.sql("SELECT id, nombre FROM usuarios WHERE rol='TECNICO' AND activo=TRUE AND verificado=TRUE ORDER BY nombre")
                .query((rs, n) -> Map.<String, Object>of("id", rs.getLong("id"), "nombre", rs.getString("nombre"))).list();
    }

    @Transactional
    public void cambiarUsuario(Perfil admin, long id, Reglas.Rol rol, boolean activo) {
        if (id == admin.id) throw error(HttpStatus.BAD_REQUEST, "Tu cuenta administradora no se puede modificar aquí.");
        Perfil perfil = db.sql("SELECT * FROM usuarios WHERE id=:id FOR UPDATE").param("id", id)
                .query((rs, n) -> leerPerfil(rs)).optional()
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND, "El usuario no existe."));
        if (perfil.rol == Reglas.Rol.TECNICO && (rol != Reglas.Rol.TECNICO || !activo)) {
            long pendientes = db.sql("SELECT COUNT(*) FROM solicitudes WHERE responsable_id=:id AND estado IN ('ASIGNADA','ATENCION')")
                    .param("id", id).query(Long.class).single();
            if (pendientes > 0) throw error(HttpStatus.CONFLICT, "Reasigna las solicitudes activas de este técnico primero.");
        }
        db.sql("UPDATE usuarios SET rol=:rol,activo=:activo,version_sesion=version_sesion+1 WHERE id=:id")
                .param("rol", rol.name()).param("activo", activo).param("id", id).update();
    }

    @Bean
    ApplicationRunner administrador(@Value("${campus.admin-email}") String direccion,
                                   @Value("${campus.admin-password}") String clave) {
        return args -> {
            if (direccion.isBlank() && clave.isBlank()) return;
            String normal = Reglas.correo(direccion);
            validarClave(clave);
            if (porCorreo(normal) != null) return;
            db.sql("INSERT INTO usuarios(nombre,correo,clave,rol,verificado) VALUES ('Administración',:correo,:clave,'ADMIN',TRUE)")
                    .param("correo", normal).param("clave", claves.encode(clave)).update();
        };
    }

    private static void validarClave(String clave) {
        if (clave.length() < 12 || clave.getBytes(StandardCharsets.UTF_8).length > 72
                || clave.codePoints().noneMatch(Character::isLetter) || clave.codePoints().noneMatch(Character::isDigit)) {
            throw error(HttpStatus.BAD_REQUEST, "Usa al menos 12 caracteres con letras y números y hasta 72 bytes.");
        }
    }

    private static String huella(String valor) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(valor.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException imposible) {
            throw new IllegalStateException(imposible);
        }
    }
}

@RestController
@RequestMapping("/api/auth")
class Cuentas {
    record Registro(@NotBlank @Size(max=100) String nombre, @NotBlank @Size(max=180) String correo,
                    @NotBlank @Size(max=72) String clave) {}
    record Credenciales(@NotBlank @Size(max=180) String correo, @NotBlank @Size(max=72) String clave) {}
    record Envio(@NotBlank @Size(max=180) String correo) {}
    record Confirmacion(@NotBlank @jakarta.validation.constraints.Pattern(regexp="[A-Za-z0-9_-]{43}") String token) {}

    private final ServicioCuentas servicio;
    Cuentas(ServicioCuentas servicio) { this.servicio = servicio; }

    @PostMapping("/registro") @ResponseStatus(HttpStatus.ACCEPTED)
    void registrar(@Valid @RequestBody Registro body) { servicio.registrar(body.nombre, body.correo, body.clave); }

    @PostMapping("/login")
    ServicioCuentas.Sesion login(@Valid @RequestBody Credenciales body) { return servicio.iniciar(body.correo, body.clave); }

    @PostMapping("/reenviar") @ResponseStatus(HttpStatus.ACCEPTED)
    void reenviar(@Valid @RequestBody Envio body) { servicio.reenviar(body.correo); }

    @PostMapping("/verificar") @ResponseStatus(HttpStatus.NO_CONTENT)
    void verificar(@Valid @RequestBody Confirmacion body) { servicio.verificar(body.token); }

    @GetMapping("/perfil")
    ServicioCuentas.Perfil perfil(@AuthenticationPrincipal Jwt token) { return servicio.actual(token); }

    @PostMapping("/salir") @ResponseStatus(HttpStatus.NO_CONTENT)
    void salir(@AuthenticationPrincipal Jwt token) { servicio.salir(servicio.actual(token)); }
}
