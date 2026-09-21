package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.EstadoUsuario;
import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Logica compartida entre HU-044 (cambio obligatorio en primer ingreso) y HU-045
 * (cambio voluntario): validar politica de contraseña, guardar el hash y registrar
 * en la bitacora. Se centraliza aqui para que ninguna de las dos reimplemente lo mismo.
 *
 * Deliberadamente sin @Transactional: cuando un intento fallido dispara el bloqueo de la
 * cuenta, BloqueoCuentaService lanza CuentaBloqueadaException despues de guardar el
 * contador; una transaccion aqui revertiria ese guardado y el bloqueo nunca se aplicaria.
 */
@Service
public class CambioContrasenaService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final BitacoraSeguridadService bitacoraSeguridadService;
    private final ValidadorPoliticaContrasena validadorPoliticaContrasena;
    private final BloqueoCuentaService bloqueoCuentaService;

    public CambioContrasenaService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            BitacoraSeguridadService bitacoraSeguridadService,
            ValidadorPoliticaContrasena validadorPoliticaContrasena,
            BloqueoCuentaService bloqueoCuentaService) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.bitacoraSeguridadService = bitacoraSeguridadService;
        this.validadorPoliticaContrasena = validadorPoliticaContrasena;
        this.bloqueoCuentaService = bloqueoCuentaService;
    }

    /** HU-044: pasa el usuario a ACTIVO y limpia la clave temporal. */
    public void cambiarEnPrimerIngreso(Usuario usuario, String contrasenaNueva) {
        validarPolitica(contrasenaNueva);
        usuario.setPasswordHash(passwordEncoder.encode(contrasenaNueva));
        usuario.setEstado(EstadoUsuario.ACTIVO);
        usuario.setPasswordTemporalExpiraEn(null);
        usuarioRepository.save(usuario);

        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
                TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio obligatorio de primer ingreso (HU-044)");
    }

    /**
     * HU-045: exige y valida la contraseña actual antes de aplicar la nueva. Una contraseña
     * actual incorrecta cuenta para el bloqueo de cuenta (HU-043) igual que en el login, y
     * todo fallo queda en la bitacora.
     */
    public void cambiarVoluntariamente(Usuario usuario, String contrasenaActual, String contrasenaNueva,
            String identificadorCliente) {
        bloqueoCuentaService.verificarBloqueo(usuario);

        if (!passwordEncoder.matches(contrasenaActual, usuario.getPasswordHash())) {
            // Registra el fallo en la bitacora y, al llegar al maximo de intentos, bloquea
            // la cuenta y lanza CuentaBloqueadaException (que gana sobre la de abajo).
            bloqueoCuentaService.registrarIntentoFallido(
                    usuario, identificadorCliente, TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO);
            throw new CredencialesInvalidasException("La contraseña actual no es correcta");
        }

        // La contraseña actual ya quedo demostrada: los intentos fallidos previos dejan de
        // contar como consecutivos, igual que tras un login exitoso.
        bloqueoCuentaService.reiniciarIntentosTrasLoginExitoso(usuario);

        if (passwordEncoder.matches(contrasenaNueva, usuario.getPasswordHash())) {
            registrarFallo(usuario, "La contraseña nueva es igual a la actual");
            throw new ContrasenaNoValidaException(List.of("La contraseña nueva no puede ser igual a la actual"));
        }

        try {
            validarPolitica(contrasenaNueva);
        } catch (ContrasenaNoValidaException ex) {
            registrarFallo(usuario, "La contraseña nueva no cumple la política: " + String.join("; ", ex.getViolaciones()));
            throw ex;
        }

        usuario.setPasswordHash(passwordEncoder.encode(contrasenaNueva));
        usuarioRepository.save(usuario);

        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
                TipoEventoSeguridad.CONTRASENA_CAMBIADA, "Cambio voluntario de contraseña (HU-045)");
    }

    private void validarPolitica(String contrasenaNueva) {
        List<String> violaciones = validadorPoliticaContrasena.validar(contrasenaNueva);
        if (!violaciones.isEmpty()) {
            throw new ContrasenaNoValidaException(violaciones);
        }
    }

    private void registrarFallo(Usuario usuario, String detalle) {
        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(),
                TipoEventoSeguridad.CAMBIO_CONTRASENA_FALLIDO, "Cambio voluntario de contraseña (HU-045): " + detalle);
    }
}
