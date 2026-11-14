package pe.orbitacampus;

import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@Validated
class Api {
    record RegistroSolicitud(@NotBlank @Size(max=120) String titulo, @NotBlank @Size(max=2000) String descripcion,
            @NotBlank @Size(max=150) String ubicacion, @NotNull @Positive Long categoriaId, @Size(max=500) String evidencia) {}
    record Cambio(@NotNull Reglas.Estado estado, @Pattern(regexp="[A-Z_]{2,18}") String prioridad,
                  @Positive Long responsableId, @NotNull @PositiveOrZero Integer version) {}
    record Comentario(@NotBlank @Size(max=1000) String mensaje) {}
    record Usuario(@NotNull Reglas.Rol rol, @NotNull Boolean activo) {}
    record Categoria(@NotBlank @Size(max=80) String nombre, @NotNull @Positive Long areaId, @NotNull Boolean activo) {}
    record Nombre(@NotBlank @Size(max=80) String nombre) {}
    record Prioridad(@NotBlank @Size(max=32) String nombre, @Min(1) @Max(720) @NotNull Integer horas) {}

    private final ServicioCuentas cuentas;
    private final ServicioSolicitudes solicitudes;
    private final Catalogos catalogos;

    Api(ServicioCuentas cuentas, ServicioSolicitudes solicitudes, Catalogos catalogos) {
        this.cuentas=cuentas; this.solicitudes=solicitudes; this.catalogos=catalogos;
    }

    private ServicioCuentas.Perfil exigir(Jwt jwt, Reglas.Rol... roles) {
        var perfil=cuentas.actual(jwt);
        if (!List.of(roles).contains(perfil.rol())) throw Reglas.error(HttpStatus.FORBIDDEN,"Tu rol no permite esta acción.");
        return perfil;
    }

    @GetMapping("/catalogos")
    Map<String,Object> catalogos(@AuthenticationPrincipal Jwt jwt) {
        cuentas.actual(jwt);
        return Map.of("categorias",catalogos.categorias(false),"prioridades",catalogos.prioridades(),"estados",catalogos.estados());
    }

    @GetMapping("/solicitudes")
    List<ServicioSolicitudes.Solicitud> solicitudes(@AuthenticationPrincipal Jwt jwt) {
        return solicitudes.listar(cuentas.actual(jwt));
    }

    @PostMapping("/solicitudes") @ResponseStatus(HttpStatus.CREATED)
    ServicioSolicitudes.Detalle crear(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody RegistroSolicitud datos) {
        return solicitudes.crear(exigir(jwt,Reglas.Rol.ESTUDIANTE),datos);
    }

    @GetMapping("/solicitudes/{id}")
    ServicioSolicitudes.Detalle detalle(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive long id) {
        return solicitudes.detalle(cuentas.actual(jwt),id);
    }

    @PutMapping("/solicitudes/{id}")
    ServicioSolicitudes.Detalle actualizar(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive long id,
                                            @Valid @RequestBody Cambio datos) {
        return solicitudes.actualizar(exigir(jwt,Reglas.Rol.TECNICO,Reglas.Rol.SUPERVISOR,Reglas.Rol.ADMIN),id,datos);
    }

    @PostMapping("/solicitudes/{id}/comentarios") @ResponseStatus(HttpStatus.CREATED)
    ServicioSolicitudes.Detalle comentar(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive long id,
                                          @Valid @RequestBody Comentario datos) {
        return solicitudes.comentar(cuentas.actual(jwt),id,datos.mensaje);
    }

    @DeleteMapping("/solicitudes/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void retirar(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive long id) {
        solicitudes.retirar(exigir(jwt,Reglas.Rol.ESTUDIANTE),id);
    }

    @GetMapping("/tecnicos")
    List<Map<String,Object>> tecnicos(@AuthenticationPrincipal Jwt jwt) {
        exigir(jwt,Reglas.Rol.SUPERVISOR,Reglas.Rol.ADMIN);
        return cuentas.tecnicos();
    }

    @GetMapping("/admin")
    Map<String,Object> admin(@AuthenticationPrincipal Jwt jwt) {
        exigir(jwt,Reglas.Rol.ADMIN);
        return Map.of("usuarios",cuentas.usuarios(),"areas",catalogos.areas(),"categorias",catalogos.categorias(true),
                "prioridades",catalogos.prioridades(),"estados",catalogos.estados(),"roles",Reglas.Rol.values());
    }

    @PutMapping("/admin/usuarios/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void usuario(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive long id,@Valid @RequestBody Usuario datos) {
        cuentas.cambiarUsuario(exigir(jwt,Reglas.Rol.ADMIN),id,datos.rol,datos.activo);
    }

    @PostMapping("/admin/categorias") @ResponseStatus(HttpStatus.CREATED)
    void categoriaNueva(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Categoria datos) {
        categoria(jwt,null,datos);
    }

    @PutMapping("/admin/categorias/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void categoria(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive Long id,@Valid @RequestBody Categoria datos) {
        exigir(jwt,Reglas.Rol.ADMIN);
        catalogos.guardarCategoria(id,datos.nombre,datos.areaId,datos.activo);
    }

    @PostMapping("/admin/areas") @ResponseStatus(HttpStatus.CREATED)
    void areaNueva(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Nombre datos) { area(jwt,null,datos); }

    @PutMapping("/admin/areas/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void area(@AuthenticationPrincipal Jwt jwt,@PathVariable @Positive Long id,@Valid @RequestBody Nombre datos) {
        exigir(jwt,Reglas.Rol.ADMIN);
        catalogos.guardarArea(id,datos.nombre);
    }

    @PutMapping("/admin/prioridades/{clave}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void prioridad(@AuthenticationPrincipal Jwt jwt,@PathVariable @Pattern(regexp="[A-Z_]{2,18}") String clave,
                   @Valid @RequestBody Prioridad datos) {
        exigir(jwt,Reglas.Rol.ADMIN);
        catalogos.guardarPrioridad(clave,datos.nombre,datos.horas);
    }

    @PutMapping("/admin/estados/{clave}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void estado(@AuthenticationPrincipal Jwt jwt,@PathVariable Reglas.Estado clave,@Valid @RequestBody Nombre datos) {
        exigir(jwt,Reglas.Rol.ADMIN);
        catalogos.guardarEstado(clave.name(),datos.nombre);
    }
}

@RestControllerAdvice
class Errores {
    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String,String>> negocio(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("mensaje",error.getReason()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String,String>> campos(MethodArgumentNotValidException error) {
        var campo=error.getBindingResult().getFieldError();
        String mensaje=campo==null ? "Revisa los datos enviados." : "Revisa el campo «"+campo.getField()+"».";
        return ResponseEntity.badRequest().body(Map.of("mensaje",mensaje));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class,jakarta.validation.ConstraintViolationException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String,String>> invalido(Exception error) {
        return ResponseEntity.badRequest().body(Map.of("mensaje","El formato o los valores enviados no son válidos."));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Map<String,String>> duplicado(DuplicateKeyException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("mensaje","El nombre o código ya existe."));
    }
}
