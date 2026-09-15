package cr.co.capris.reactivos.usuario;

import cr.co.capris.reactivos.seguridad.AccesoNoAutorizadoException;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.SesionNoValidaException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Solo lectura por ahora -- habilita la conexion front/back para el trabajo en
 * pantallas de usuarios (pages/Admin/Users). El alta real (HU-047, con envio de OTP
 * por correo) y la baja logica (HU-048) se agregan cuando se aborden esas HUs.
 */
@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {

	private final UsuarioRepository usuarioRepository;
	private final ContextoUsuarioActual contextoUsuarioActual;

	public UsuarioController(UsuarioRepository usuarioRepository, ContextoUsuarioActual contextoUsuarioActual) {
		this.usuarioRepository = usuarioRepository;
		this.contextoUsuarioActual = contextoUsuarioActual;
	}

	@GetMapping
	public List<UsuarioResumenDTO> listar() {
		Long empresaId = exigirEmpresaId();
		return usuarioRepository.findAllByEmpresaId(empresaId).stream()
				.map(UsuarioResumenDTO::from)
				.toList();
	}

	@GetMapping("/{id}")
	public UsuarioResumenDTO detalle(@PathVariable Long id) {
		Long empresaId = exigirEmpresaId();
		// Mismo error sin importar si el id no existe o existe en otra empresa -- nunca
		// distinguir los dos casos, para no filtrar cuales ids son validos en otras empresas.
		return usuarioRepository.findByIdAndEmpresaId(id, empresaId)
				.map(UsuarioResumenDTO::from)
				.orElseThrow(() -> new AccesoNoAutorizadoException("No autorizado"));
	}

	private Long exigirEmpresaId() {
		Long empresaId = contextoUsuarioActual.getEmpresaId();
		if (empresaId == null) {
			throw new SesionNoValidaException("No hay sesion activa");
		}
		return empresaId;
	}
}
