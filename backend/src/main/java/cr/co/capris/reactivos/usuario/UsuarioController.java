package cr.co.capris.reactivos.usuario;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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

	public UsuarioController(UsuarioRepository usuarioRepository) {
		this.usuarioRepository = usuarioRepository;
	}

	@GetMapping
	public List<UsuarioResumenDTO> listar() {
		return usuarioRepository.findAll().stream()
				.map(UsuarioResumenDTO::from)
				.toList();
	}

	@GetMapping("/{id}")
	public UsuarioResumenDTO detalle(@PathVariable Long id) {
		return usuarioRepository.findById(id)
				.map(UsuarioResumenDTO::from)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
	}
}
