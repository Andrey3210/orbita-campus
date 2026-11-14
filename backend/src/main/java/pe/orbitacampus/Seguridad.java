package pe.orbitacampus;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
@EnableMethodSecurity
class Seguridad {
    private static final String EMISOR = "orbita-campus";

    @Bean
    SecretKeySpec claveJwt(@Value("${campus.jwt-secret}") String valor) {
        byte[] clave = valor.getBytes(StandardCharsets.UTF_8);
        if (clave.length < 32) throw new IllegalStateException("Configura JWT_SECRET con al menos 32 bytes aleatorios.");
        return new SecretKeySpec(clave, "HmacSHA256");
    }

    @Bean JwtEncoder firmador(SecretKeySpec clave) { return new NimbusJwtEncoder(new ImmutableSecret<>(clave)); }

    @Bean
    JwtDecoder verificador(SecretKeySpec clave) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(EMISOR));
        return decoder;
    }

    static String token(JwtEncoder encoder, long id, Reglas.Rol rol, int version) {
        Instant ahora = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(EMISOR).subject(Long.toString(id))
                .issuedAt(ahora).expiresAt(ahora.plusSeconds(1800)).claim("rol", rol.name())
                .claim("sesion", version).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, ServicioCuentas cuentas, UrlBasedCorsConfigurationSource origenes) throws Exception {
        JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
        roles.setAuthoritiesClaimName("rol");
        roles.setAuthorityPrefix("ROLE_");
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(roles);
        return http.cors(cors -> cors.configurationSource(origenes))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.contentSecurityPolicy(c -> c.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/actuator/health", "/actuator/info", "/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/registro", "/api/auth/login",
                                "/api/auth/verificar", "/api/auth/reenviar", "/api/auth/recuperar", "/api/auth/restablecer").permitAll()
                        .requestMatchers("/actuator/metrics", "/actuator/metrics/**").access((autenticacion, contexto) -> {
                            if (autenticacion.get() instanceof JwtAuthenticationToken jwt) {
                                try {
                                    return new AuthorizationDecision(cuentas.actual(jwt.getToken()).rol() == Reglas.Rol.ADMIN);
                                } catch (org.springframework.web.server.ResponseStatusException sesionInvalida) {
                                    return new AuthorizationDecision(false);
                                }
                            }
                            return new AuthorizationDecision(false);
                        })
                        .anyRequest().authenticated())
                .oauth2ResourceServer(r -> r.jwt(j -> j.jwtAuthenticationConverter(converter))).build();
    }

    @Bean
    UrlBasedCorsConfigurationSource cors(@Value("${campus.origins}") String origenes) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(Arrays.stream(origenes.split(",")).map(String::strip).filter(s -> !s.isEmpty()).toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("X-Request-Id"));
        UrlBasedCorsConfigurationSource origen = new UrlBasedCorsConfigurationSource();
        origen.registerCorsConfiguration("/**", config);
        return origen;
    }

    @Bean
    FilterRegistrationBean<OncePerRequestFilter> limitarAcceso() {
        record Ventana(long vence, int intentos) {}
        var ventanas = new ConcurrentHashMap<String, Ventana>();
        var rutas = Set.of("/api/auth/login", "/api/auth/registro", "/api/auth/reenviar", "/api/auth/verificar",
                "/api/auth/recuperar", "/api/auth/restablecer", "/api/auth/clave");
        var filtro = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                String ruta = req.getRequestURI();
                if (rutas.contains(ruta) && "POST".equals(req.getMethod())) {
                    long ahora = System.currentTimeMillis();
                    ventanas.entrySet().removeIf(e -> e.getValue().vence() <= ahora);
                    int maximo = ruta.endsWith("/login") ? 20 : 10;
                    String clave = req.getRemoteAddr() + "|" + ruta;
                    Ventana ventana = ventanas.compute(clave, (k, anterior) -> anterior == null || anterior.vence() <= ahora
                            ? new Ventana(ahora + 60_000, 1)
                            : new Ventana(anterior.vence(), Math.min(maximo + 1, anterior.intentos() + 1)));
                    if (ventana.intentos() > maximo) {
                        res.setStatus(429);
                        res.setHeader("Retry-After", Long.toString((ventana.vence() - ahora + 999) / 1000));
                        res.setContentType("application/json");
                        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
                        res.getWriter().write("{\"mensaje\":\"Demasiados intentos. Intenta en un minuto.\"}");
                        return;
                    }
                }
                chain.doFilter(req, res);
            }
        };
        var registro = new FilterRegistrationBean<OncePerRequestFilter>(filtro);
        registro.setOrder(org.springframework.boot.autoconfigure.security.SecurityProperties.DEFAULT_FILTER_ORDER + 1);
        return registro;
    }
}
