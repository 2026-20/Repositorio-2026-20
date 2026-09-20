package cr.co.capris.reactivos.auth;
import cr.co.capris.reactivos.seguridad.CambioContrasenaService;
import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import cr.co.capris.reactivos.seguridad.UsuarioNoEncontradoException;
import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * HU-044 y HU-045. Ambos endpoints requieren JWT valido -- incluso HU-044, porque el
 * login minimo de HU-001 ya emite token para cuentas PENDIENTE_PRIMER_INGRESO.
 * La logica compartida vive en CambioContrasenaService; este controlador solo resuelve
 * el usuario a partir del contexto y decide que flujo aplica segun su estado.
 */

@RestController
@RequestMapping("/api/auth")
public class CambioContrasenaController {

    private final UsuarioRepository usuarioRepository;
    private final ContextoUsuarioActual contextoUsuarioActual;
    private final CambioContrasenaService cambioContrasenaService;

    public CambioContrasenaController(
            UsuarioRepository usuarioRepository,
            ContextoUsuarioActual contextoUsuarioActual,
            CambioContrasenaService cambioContrasenaService) {
        this.usuarioRepository = usuarioRepository;
        this.contextoUsuarioActual = contextoUsuarioActual;
        this.cambioContrasenaService = cambioContrasenaService;
    }

    /** HU-044: solo valido mientras el usuario sigue PENDIENTE_PRIMER_INGRESO. */
    @PostMapping("/primer-ingreso/cambiar-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarEnPrimerIngreso(@RequestBody CambioPasswordPrimerIngresoRequest request) {
        Usuario usuario = usuarioActual();

        if (usuario.getEstado() != EstadoUsuario.PENDIENTE_PRIMER_INGRESO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "El usuario ya completó el cambio de contraseña de primer ingreso");
        }

        cambioContrasenaService.cambiarEnPrimerIngreso(usuario, request.contrasenaNueva());
    }

    /** HU-045: exige la contraseña actual; solo para usuarios ACTIVO. */
    @PostMapping("/cambiar-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cambiarVoluntariamente(@RequestBody CambioPasswordVoluntarioRequest request) {
        Usuario usuario = usuarioActual();

        if (usuario.getEstado() != EstadoUsuario.ACTIVO) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Solo un usuario activo puede cambiar su contraseña voluntariamente");
        }

        cambioContrasenaService.cambiarVoluntariamente(usuario, request.contrasenaActual(), request.contrasenaNueva());
    }

    private Usuario usuarioActual() {
        Long usuarioId = contextoUsuarioActual.getUsuarioId();
        if (usuarioId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Se requiere un token válido");
        }
        return usuarioRepository.findById(usuarioId).orElseThrow(() -> new UsuarioNoEncontradoException("Usuario no encontrado"));
    }
}
