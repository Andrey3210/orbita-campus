package pe.orbitacampus;

import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import io.micrometer.tracing.Tracer;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Configuration
class Observabilidad {
    private static final Logger HTTP = LoggerFactory.getLogger("campus.http");

    @Bean
    FilterRegistrationBean<OncePerRequestFilter> registroHttp(Tracer trazador) {
        var filtro = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
                    throws ServletException, IOException {
                res.setHeader("X-Request-Id", UUID.randomUUID().toString());
                long inicio = System.nanoTime();
                int estado = 500;
                try (var contexto = MDC.putCloseable("solicitudId", res.getHeader("X-Request-Id"))) {
                    try {
                        chain.doFilter(req, res);
                        estado = res.getStatus();
                    } finally {
                        var ruta = req.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
                        var span = trazador.currentSpan();
                        var evento = estado >= 500 ? HTTP.atError() : estado == 429 ? HTTP.atWarn() : HTTP.atInfo();
                        evento = evento.addKeyValue("http.request.method", req.getMethod())
                                .addKeyValue("http.route", ruta == null ? "sin-ruta" : ruta.toString())
                                .addKeyValue("http.response.status_code", estado)
                                .addKeyValue("duracionMs", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - inicio));
                        if (span != null) {
                            evento = evento.addKeyValue("trace.id", span.context().traceId())
                                    .addKeyValue("span.id", span.context().spanId());
                        }
                        evento.log("Petición HTTP");
                    }
                }
            }
        };
        var registro = new FilterRegistrationBean<OncePerRequestFilter>(filtro);
        // La observación de Spring Boot abre su span antes de este filtro.
        registro.setOrder(Ordered.HIGHEST_PRECEDENCE + 2);
        return registro;
    }
}
