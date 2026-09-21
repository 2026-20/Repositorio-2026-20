package cr.co.capris.reactivos.seguridad;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/**
 * Traduce las excepciones de dominio de seguridad a un formato de error consistente.
 * Cada HU lanza la excepcion que le corresponde (ver clases en este mismo paquete);
 * este manejador solo decide el codigo HTTP y la forma de la respuesta, una sola vez
 * para toda la API en vez de que cada controlador arme su propio manejo de errores.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(CredencialesInvalidasException.class)
	public ResponseEntity<ErrorResponse> manejar(CredencialesInvalidasException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.body(ErrorResponse.de("CREDENCIALES_INVALIDAS", ex.getMessage()));
	}

	@ExceptionHandler(PasswordTemporalVencidaException.class)
	public ResponseEntity<ErrorResponse> manejar(PasswordTemporalVencidaException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.body(ErrorResponse.de("PASSWORD_TEMPORAL_VENCIDA", ex.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> manejar(MethodArgumentNotValidException ex) {
		List<String> detalles = ex.getBindingResult().getFieldErrors().stream()
				.map(FieldError::getDefaultMessage)
				.toList();
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorResponse.de("SOLICITUD_INVALIDA", "La solicitud contiene datos no válidos", detalles));
	}

	@ExceptionHandler(CuentaBloqueadaException.class)
	public ResponseEntity<ErrorResponse> manejar(CuentaBloqueadaException ex) {
		return ResponseEntity.status(HttpStatus.LOCKED)
				.body(ErrorResponse.de("CUENTA_BLOQUEADA", ex.getMessage()));
	}

	@ExceptionHandler(ContrasenaNoValidaException.class)
	public ResponseEntity<ErrorResponse> manejar(ContrasenaNoValidaException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(ErrorResponse.de("CONTRASENA_NO_VALIDA", ex.getMessage(), ex.getViolaciones()));
	}

	@ExceptionHandler(UsuarioDuplicadoException.class)
	public ResponseEntity<ErrorResponse> manejar(UsuarioDuplicadoException ex) {
		return ResponseEntity.status(HttpStatus.CONFLICT)
				.body(ErrorResponse.de("USUARIO_DUPLICADO", ex.getMessage()));
	}

	@ExceptionHandler(UsuarioNoEncontradoException.class)
	public ResponseEntity<ErrorResponse> manejar(UsuarioNoEncontradoException ex) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(ErrorResponse.de("USUARIO_NO_ENCONTRADO", ex.getMessage()));
	}

	@ExceptionHandler(SesionNoValidaException.class)
	public ResponseEntity<ErrorResponse> manejar(SesionNoValidaException ex) {
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
				.body(ErrorResponse.de("SESION_NO_VALIDA", ex.getMessage()));
	}

	//  Mensaje siempre generico -- nunca confirmar ni negar si el recurso
	// solicitado existe en otra empresa (evita filtrar informacion por enumeracion).
	@ExceptionHandler(AccesoNoAutorizadoException.class)
	public ResponseEntity<ErrorResponse> manejar(AccesoNoAutorizadoException ex) {
		return ResponseEntity.status(HttpStatus.FORBIDDEN)
				.body(ErrorResponse.de("ACCESO_NO_AUTORIZADO", ex.getMessage()));
	}
}
