package pe.orbitacampus;

import static pe.orbitacampus.Reglas.error;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
class CorreoCuentas {
    private final JavaMailSender smtp;
    private final RestClient brevo;
    private final String remitente;

    CorreoCuentas(JavaMailSender smtp, RestClient.Builder cliente,
                  @Value("${campus.mail-from}") String remitente,
                  @Value("${campus.brevo-api-key}") String claveBrevo) {
        this.smtp = smtp;
        this.remitente = remitente.strip();
        if (claveBrevo.isBlank()) {
            brevo = null;
        } else {
            var http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();
            var fabrica = new JdkClientHttpRequestFactory(http);
            fabrica.setReadTimeout(Duration.ofSeconds(6));
            brevo = cliente.baseUrl("https://api.brevo.com").requestFactory(fabrica)
                    .defaultHeader("api-key", claveBrevo).build();
        }
    }

    void validarConfiguracion() {
        if (remitente.isBlank()) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE, "El envío de correo todavía no está configurado.");
        }
    }

    void enviar(String destino, String asunto, String texto) {
        try {
            if (brevo == null) {
                SimpleMailMessage mensaje = new SimpleMailMessage();
                mensaje.setFrom(remitente);
                mensaje.setTo(destino);
                mensaje.setSubject(asunto);
                mensaje.setText(texto);
                smtp.send(mensaje);
            } else {
                brevo.post().uri("/v3/smtp/email").contentType(MediaType.APPLICATION_JSON).body(Map.of(
                        "sender", Map.of("email", remitente, "name", "Órbita Campus"),
                        "to", List.of(Map.of("email", destino)),
                        "subject", asunto,
                        "textContent", texto)).retrieve().toBodilessEntity();
            }
        } catch (MailException | RestClientException fallo) {
            throw error(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo enviar el correo. Vuelve a intentarlo más tarde.");
        }
    }
}
