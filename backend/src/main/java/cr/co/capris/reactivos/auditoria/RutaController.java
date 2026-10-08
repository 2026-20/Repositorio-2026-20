package cr.co.capris.reactivos.auditoria;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HU-037: ruta del Usuario de Campo autenticado. El usuario sale siempre
 * del JWT (ContextoUsuarioActual), nunca de un parametro del cliente.
 *
 * Sin service a proposito: todo el trabajo (cruce con Bodega, filtro CLI,
 * excluir FINALIZADA, orden) es una sola consulta -- ver
 * ResultadoVisitaRepository.findRutaPendiente. Extraer un service cuando
 * haya logica real (ej. filtro por empresa, ver SUPUESTO en Bodega.empresaId).
 *
 * SUPUESTO (HU-037 criterio 1, "descargar del ERP"): el ERP todavia no manda
 * la asignacion de rutas (ver javadoc de Bodega sobre codUsu), asi que lo
 * que se devuelve aqui es la asignacion MANUAL del Administrador (ver
 * VisitaController.asignar). Cuando llegue el dato real, este endpoint no
 * deberia cambiar -- solo como se llena asignadoAUsuarioId/fechaAsignada.
 */
@RestController
public class RutaController {

	private final ResultadoVisitaRepository resultadoVisitaRepository;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public RutaController(ResultadoVisitaRepository resultadoVisitaRepository, ContextoUsuarioActual contextoUsuarioActual) {
		this.resultadoVisitaRepository = resultadoVisitaRepository;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@GetMapping("/api/auditoria/visitas/mi-ruta")
	public List<ParadaRutaDTO> miRuta() {
		Long usuarioId = contextoUsuarioActual.getUsuarioId();
		if (usuarioId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return resultadoVisitaRepository.findRutaPendiente(usuarioId);
	}
}
