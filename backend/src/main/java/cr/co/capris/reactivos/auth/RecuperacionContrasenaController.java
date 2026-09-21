package cr.co.capris.reactivos.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * HU-046. Tres pasos, tres endpoints -- cada uno le entrega al frontend
 * exactamente lo que necesita para la siguiente pantalla (ver criterio 4:
 * "sesión temporal restringida cuya única función sea acceder a la pantalla
 * de la nueva contraseña").
 *
 * El chequeo de conectividad del criterio 1 ("Funcionalidad no disponible sin
 * conexión a red") es responsabilidad del FRONTEND -- si el dispositivo está
 * offline, la petición HTTP ni siquiera puede salir a buscar este backend, así
 * que no hay nada que hacer de este lado. Ver frontend/src/hooks/useConectividad.js
 * y frontend/src/services/recuperacionService.js.
 */
@RestController
@RequestMapping("/api/auth/recuperacion")
public class RecuperacionContrasenaController {

	private static final String MENSAJE_GENERICO_SOLICITUD =
			"Si el correo corresponde a una cuenta registrada, vas a recibir un mensaje con instrucciones.";

	private final RecuperacionContrasenaService recuperacionContrasenaService;

	public RecuperacionContrasenaController(RecuperacionContrasenaService recuperacionContrasenaService) {
		this.recuperacionContrasenaService = recuperacionContrasenaService;
	}

	@PostMapping("/solicitar")
	public ResponseEntity<MensajeResponse> solicitar(@RequestBody SolicitarRecuperacionRequest request) {
		recuperacionContrasenaService.solicitar(request.correo());
		// Criterio 2: SIEMPRE el mismo mensaje, exista o no la cuenta.
		return ResponseEntity.ok(new MensajeResponse(MENSAJE_GENERICO_SOLICITUD));
	}

	@PostMapping("/validar-otp")
	public ResponseEntity<ValidarOtpResponse> validarOtp(@RequestBody ValidarOtpRequest request) {
		String tokenSesionTemporal = recuperacionContrasenaService.validarOtp(request.correo(), request.otp());
		return ResponseEntity.ok(new ValidarOtpResponse(tokenSesionTemporal));
	}

	@PostMapping("/nueva-contrasena")
	public ResponseEntity<MensajeResponse> nuevaContrasena(@RequestBody NuevaContrasenaRequest request) {
		recuperacionContrasenaService.establecerNuevaContrasena(
				request.tokenSesionTemporal(), request.nuevaContrasena());
		return ResponseEntity.status(HttpStatus.OK)
				.body(new MensajeResponse("Contraseña actualizada. Ya podés iniciar sesión con la nueva."));
	}
}
