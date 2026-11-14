package pe.orbitacampus;

import java.net.URI;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class Reglas {
    private static final String DOMINIO = "@unmsm.edu.pe";

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
        String limpio = valor == null ? "" : valor.strip();
        String normal = limpio.toLowerCase(Locale.ROOT);
        if (limpio.length() <= DOMINIO.length() || limpio.length() > 64 + DOMINIO.length()
                || limpio.chars().anyMatch(c -> c > 127) || !normal.endsWith(DOMINIO)
                || !parteLocalValida(normal.substring(0, normal.length() - DOMINIO.length()))) {
            throw error(HttpStatus.BAD_REQUEST, "Usa un correo válido de San Marcos, como ejemplo@unmsm.edu.pe.");
        }
        return normal;
    }

    private static boolean parteLocalValida(String local) {
        if (local.startsWith(".") || local.endsWith(".") || local.contains("..")) return false;
        return local.chars().allMatch(c -> c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || "._+%-".indexOf(c) >= 0);
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
