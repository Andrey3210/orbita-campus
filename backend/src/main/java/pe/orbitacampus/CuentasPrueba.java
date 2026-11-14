package pe.orbitacampus;

import java.util.EnumMap;
import java.util.Locale;
import java.util.Set;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("pruebas-locales")
class CuentasPrueba implements ApplicationRunner {
    private final Environment entorno;
    private final ServicioCuentas cuentas;

    CuentasPrueba(Environment entorno, ServicioCuentas cuentas) {
        this.entorno = entorno;
        this.cuentas = cuentas;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!Set.of("127.0.0.1", "::1").contains(entorno.getProperty("server.address", ""))) {
            throw new IllegalStateException("Usa las cuentas de prueba en un servidor local.");
        }
        var claves = new EnumMap<Reglas.Rol, String>(Reglas.Rol.class);
        for (var rol : Reglas.Rol.values()) {
            claves.put(rol, entorno.getRequiredProperty("PRUEBA_" + rol.name() + "_PASSWORD"));
        }
        if (Set.copyOf(claves.values()).size() != claves.size()) {
            throw new IllegalStateException("Configura una contraseña distinta para cada cuenta de prueba.");
        }
        claves.forEach((rol, clave) -> {
            String correo = "orbita.campus.g7." + rol.name().toLowerCase(Locale.ROOT) + "@unmsm.edu.pe";
            cuentas.provisionarPrueba(rol, correo, clave);
        });
    }
}
