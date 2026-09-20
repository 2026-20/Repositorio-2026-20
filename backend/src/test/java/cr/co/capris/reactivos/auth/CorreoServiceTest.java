package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.usuario.Usuario;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CorreoServiceTest {

	private static final String REMITENTE = "no-responder@capris-reactivos.local";

	@Mock
	private JavaMailSender mailSender;

	@Mock
	private Usuario usuario;

	private CorreoService correoService;

	@BeforeEach
	void setUp() {
		correoService = new CorreoService(mailSender, REMITENTE);
	}

	@Test
	void enviaElCorreoAlDestinatarioConElUsernameYLaContrasenaTemporal() {
		when(usuario.getCorreo()).thenReturn("ana.perez@capris.co.cr");
		when(usuario.getUsername()).thenReturn("ana.perez");
		when(usuario.getNombreCompleto()).thenReturn("Ana Perez");

		correoService.enviarCredencialesIniciales(usuario, "Temp0ral!23");

		ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
		verify(mailSender).send(captor.capture());

		SimpleMailMessage mensaje = captor.getValue();
		assertThat(mensaje.getTo()).containsExactly("ana.perez@capris.co.cr");
		assertThat(mensaje.getText()).contains("ana.perez", "Temp0ral!23");
	}
}
