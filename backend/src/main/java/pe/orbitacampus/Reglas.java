package pe.orbitacampus;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class Reglas {
    static final String CORREO = "(?i)^[a-z0-9_+%-]+(?:\\.[a-z0-9_+%-]+)*@unmsm\\.edu\\.pe$";
    private static final Pattern INSTITUCIONAL = Pattern.compile(CORREO);

    enum Rol { ESTUDIANTE, TECNICO, SUPERVISOR, ADMIN }

    enum Estado {
        REGISTRADA, EVALUACION, ASIGNADA, ATENCION, RESUELTA, CERRADA;

        boolean terminada() { return this == RESUELTA || this == CERRADA; }

        boolean permite(Estado destino, Rol rol) {
            if (rol == Rol.ADMIN || rol == Rol.SUPERVISOR) {
                return switch (this) {
                    case REGISTRADA -> destino == EVALUACION;
                    case EVALUACION -> destino == ASIGNADA;
                    case RESUELTA -> destino == CERRADA;
                    default -> false;
                };
            }
            return rol == Rol.TECNICO && (this == ASIGNADA && destino == ATENCION
                    || this == ATENCION && destino == RESUELTA);
        }
    }

    static String correo(String valor) {
        String normal = valor == null ? "" : valor.strip().toLowerCase(Locale.ROOT);
        if (!INSTITUCIONAL.matcher(normal).matches() || normal.indexOf('@') > 64) {
            throw error(HttpStatus.BAD_REQUEST, "Usa un correo válido de San Marcos, como ejemplo@unmsm.edu.pe.");
        }
        return normal;
    }

    static String texto(String valor, int minimo, int maximo, String campo) {
        String limpio = valor == null ? "" : valor.strip();
        if (limpio.length() < minimo || limpio.length() > maximo
                || limpio.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) {
            throw error(HttpStatus.BAD_REQUEST, campo + " debe tener entre " + minimo + " y " + maximo + " caracteres válidos.");
        }
        return limpio;
    }

    static String evidencia(String valor) {
        if (valor == null || valor.isBlank()) return null;
        String enlace = texto(valor, 10, 500, "La evidencia");
        try {
            URI url = URI.create(enlace);
            if ("https".equalsIgnoreCase(url.getScheme()) && url.getHost() != null && url.getUserInfo() == null) return enlace;
        } catch (IllegalArgumentException ignored) {
            // La respuesta es la misma para URLs inválidas y esquemas no admitidos.
        }
        throw error(HttpStatus.BAD_REQUEST, "La evidencia debe ser un enlace HTTPS válido.");
    }

    static ResponseStatusException error(HttpStatus estado, String detalle) {
        return new ResponseStatusException(estado, detalle);
    }
}
