package cr.co.capris.reactivos.usuario;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Solo lectura -- deja el listado de empresas listo para que HU-001 lo consuma
 * en el selector de empresa del login. Publico a proposito (sin ContextoUsuarioActual
 * ni JWT): el selector se muestra ANTES de autenticarse, igual que POST /api/auth/login.
 *
 * "Activas" hoy significa "todas las filas de empresa" -- la tabla (V1__crear_esquema_usuarios.sql)
 * no tiene columna activo/estado, a diferencia de Usuario (ver EstadoUsuario). Si se agrega esa
 * columna mas adelante, este endpoint es el que debe empezar a filtrar por ella.
 */
@RestController
@RequestMapping("/api/empresas")
public class EmpresaController {

	private final EmpresaRepository empresaRepository;

	public EmpresaController(EmpresaRepository empresaRepository) {
		this.empresaRepository = empresaRepository;
	}

	@GetMapping
	public List<EmpresaResumenDTO> listar() {
		return empresaRepository.findAll().stream()
				.map(EmpresaResumenDTO::from)
				.toList();
	}
}
