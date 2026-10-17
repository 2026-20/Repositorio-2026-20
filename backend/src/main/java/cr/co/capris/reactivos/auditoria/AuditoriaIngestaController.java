package cr.co.capris.reactivos.auditoria;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

/**
 * Entrada servidor-a-servidor para el (futuro) servidor puente FTP -- ver
 * AuditoriaIngestaApiKeyFilter para la autenticacion (no es un usuario con
 * JWT). El cuerpo de cada peticion es el XML tal cual, sin envolver en
 * JSON -- se lee directo como InputStream en vez de bufferearlo primero
 * en memoria (algunos de estos archivos pasan de 800KB).
 *
 * X-Nombre-Archivo manda el nombre real del archivo tal como lo entrega
 * el FTP. Para movimientos-pendientes y lotes-movimiento es obligatorio
 * que calce con el patron de IdentificadorVisita (bodega+fecha+hora+
 * secuencia) -- si no calza, falla con 400 (ver GlobalExceptionHandler,
 * IllegalArgumentException). Para los demas es solo una etiqueta para los
 * logs, cualquier texto sirve.
 *
 * estados-visita acepta ademas un parametro opcional asignarAUsuario, solo
 * para pruebas manuales/demos (ver javadoc del metodo y del simulador en
 * ftp-gateway) -- el flujo real del FTP nunca lo manda.
 */
@RestController
@RequestMapping("/api/auditoria/ingesta")
public class AuditoriaIngestaController {

	private static final String HEADER_NOMBRE_ARCHIVO = "X-Nombre-Archivo";

	private final AuditoriaIngestaService ingestaService;

	public AuditoriaIngestaController(AuditoriaIngestaService ingestaService) {
		this.ingestaService = ingestaService;
	}

	@PostMapping("/bodegas")
	public ResultadoIngesta bodegas(HttpServletRequest request, @RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo)
			throws IOException {
		return ingestaService.ingestarBodegas(request.getInputStream(), nombreArchivo);
	}

	// asignarAUsuario: solo para pruebas manuales/demos via el simulador de
	// ingesta (ftp-gateway) -- ver javadoc de
	// AuditoriaIngestaService.ingestarEstadosVisita.
	@PostMapping("/estados-visita")
	public ResultadoIngesta estadosVisita(
			HttpServletRequest request,
			@RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo,
			@RequestParam(required = false) String asignarAUsuario) throws IOException {
		return ingestaService.ingestarEstadosVisita(request.getInputStream(), nombreArchivo, asignarAUsuario);
	}

	@PostMapping("/detalle-bodega")
	public ResultadoIngesta detalleBodega(
			HttpServletRequest request, @RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo) throws IOException {
		return ingestaService.ingestarDetalleBodega(request.getInputStream(), nombreArchivo);
	}

	@PostMapping("/lote-bodega")
	public ResultadoIngesta loteBodega(
			HttpServletRequest request, @RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo) throws IOException {
		return ingestaService.ingestarLoteBodega(request.getInputStream(), nombreArchivo);
	}

	@PostMapping("/movimientos-pendientes")
	public ResultadoIngesta movimientosPendientes(
			HttpServletRequest request, @RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo) throws IOException {
		return ingestaService.ingestarMovimientosPendientes(request.getInputStream(), nombreArchivo);
	}

	@PostMapping("/lotes-movimiento")
	public ResultadoIngesta lotesMovimiento(
			HttpServletRequest request, @RequestHeader(HEADER_NOMBRE_ARCHIVO) String nombreArchivo) throws IOException {
		return ingestaService.ingestarLotesMovimiento(request.getInputStream(), nombreArchivo);
	}
}
