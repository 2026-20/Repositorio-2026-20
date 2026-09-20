package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;


/**
 * Logica compartida entre HU-044 (cambio obligatorio en primer ingreso) y HU-045
 * (cambio voluntario): validar politica de contraseña, guardar el hash y registrar
 * en la bitacora. Se centraliza aqui para que ninguna de las dos reimplemente lo mismo.
 *
 * ValidadorPoliticaContrasena (HU-042) todavia no tiene implementacion real -- se
 * inyecta como Optional a proposito para no bloquear HU-044/045 mientras esa HU avanza
 * en paralelo. Mientras no exista un bean real, la validacion de complejidad se omite.
 */
@Service
public class CambioContrasenaService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final BitacoraSeguridadService bitacoraSeguridadService;
    private final Optional<ValidadorPoliticaContrasena> validadorPoliticaContrasena;


    public CambioContrasenaService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            BitacoraSeguridadService bitacoraSeguridadService,
            Optional<ValidadorPoliticaContrasena> validadorPoliticaContrasena) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.bitacoraSeguridadService = bitacoraSeguridadService;
        this.validadorPoliticaContrasena = validadorPoliticaContrasena;
    }

    /** HU-044: pasa el usuario a ACTIVO y limpia la clave temporal. */
    // faltaria por ver la logica de la contraseña temporal
    public void cambiarEnPrimerIngreso(Usuario usuario, String contrasenaNueva) {
        validarPolitica(contrasenaNueva);
        usuario.setPasswordHash(passwordEncoder.encode(contrasenaNueva));
        usuario.setEstado(EstadoUsuario.ACTIVO);
        usuario.setPasswordTemporalExpiraEn(null);
        usuarioRepository.save(usuario);

        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
                TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio obligatorio de primer ingreso (HU-044)");
    }

    /** HU-045: exige y valida la contraseña actual antes de aplicar la nueva. */
    public void cambiarVoluntariamente(Usuario usuario, String contrasenaActual, String contrasenaNueva) {
        if (!passwordEncoder.matches(contrasenaActual, usuario.getPasswordHash())) {
            throw new CredencialesInvalidasException("La contraseña actual no es correcta");
        }
        if(passwordEncoder.matches(contrasenaNueva, usuario.getPasswordHash())) {
            throw new ContrasenaNoValidaException(List.of("La contraseña nueva no puede ser igual a la actual"));
        }
        validarPolitica(contrasenaNueva);
        usuario.setPasswordHash(passwordEncoder.encode(contrasenaNueva));
        usuarioRepository.save(usuario);

        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
                TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio voluntario de contraseña (HU-045)");
    }

    private void validarPolitica(String contrasenaNueva) {
        // TODO (HU-042): en cuanto exista un bean real de ValidadorPoliticaContrasena,
        // este metodo empieza a validar solo; no hay que tocar nada mas aqui.
        validadorPoliticaContrasena.ifPresent(validador -> {
            List<String> violaciones = validador.validar(contrasenaNueva);
            if (!violaciones.isEmpty()) {
                throw new ContrasenaNoValidaException(violaciones);
            }
        });
    }
}
