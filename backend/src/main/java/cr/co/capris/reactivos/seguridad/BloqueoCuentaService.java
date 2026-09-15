package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import cr.co.capris.reactivos.usuario.UsuarioRepository;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.OffsetDateTime;

@Service
public class BloqueoCuentaService {

    public static final int MAX_INTENTOS_FALLIDOS = 4;
    public static final int MINUTOS_BLOQUEO = 7;
    public static final String MENSAJE_BLOQUEO = "Cuenta bloqueada temporalmente por 7 minutos tras múltiples intentos fallidos";
    private final UsuarioRepository usuarioRepository;
    private final BitacoraSeguridadService bitacoraSeguridadService;
    private final Clock clock;

    @Autowired
    public BloqueoCuentaService(UsuarioRepository usuarioRepository, BitacoraSeguridadService bitacoraSeguridadService) {
        this(usuarioRepository, bitacoraSeguridadService, Clock.systemUTC());
    }

    BloqueoCuentaService(UsuarioRepository usuarioRepository, BitacoraSeguridadService bitacoraSeguridadService, Clock clock) {
        this.usuarioRepository = usuarioRepository;
        this.bitacoraSeguridadService = bitacoraSeguridadService;
        this.clock = clock;
    }

    public void verificarBloqueo(Usuario usuario) {

        OffsetDateTime bloqueadoHasta = usuario.getBloqueadoHasta();

        if (bloqueadoHasta == null) {
            return;
        }

        OffsetDateTime ahora = OffsetDateTime.now(clock);

        if (bloqueadoHasta.isAfter(ahora)) {
            throw new CuentaBloqueadaException(MENSAJE_BLOQUEO, bloqueadoHasta);
        }

        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);

        usuarioRepository.save(usuario);
    }


    public void registrarIntentoFallido(Usuario usuario, String identificadorCliente) {
        int numeroIntento = usuario.getIntentosFallidos() + 1;

        boolean bloqueoActivado = numeroIntento >= MAX_INTENTOS_FALLIDOS;

        OffsetDateTime bloqueadoHasta = null;

        usuario.setIntentosFallidos(numeroIntento);

        if (bloqueoActivado) {
            bloqueadoHasta = OffsetDateTime.now(clock).plusMinutes(MINUTOS_BLOQUEO);
            usuario.setBloqueadoHasta(bloqueadoHasta);
        }

        usuarioRepository.save(usuario);

        String detalle = "numeroIntento=%d; identificadorCliente=%s; bloqueoActivado=%s"
                        .formatted(numeroIntento, identificadorCliente, bloqueoActivado);

        bitacoraSeguridadService.registrar(usuario.getUsername(), usuario.getId(), TipoEventoSeguridad.LOGIN_FALLIDO, detalle);

        if (bloqueoActivado) {

            bitacoraSeguridadService.registrar(
                    usuario.getUsername(),
                    usuario.getId(),
                    TipoEventoSeguridad.CUENTA_BLOQUEADA,
                    "Bloqueo automático hasta %s; identificadorCliente=%s"
                            .formatted(bloqueadoHasta, identificadorCliente));

            throw new CuentaBloqueadaException(MENSAJE_BLOQUEO, bloqueadoHasta);
        }
    }

    public void reiniciarIntentosTrasLoginExitoso(Usuario usuario) {

        if (usuario.getIntentosFallidos() == 0 && usuario.getBloqueadoHasta() == null) {
            return;
        }

        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);

        usuarioRepository.save(usuario);
    }

    public void desbloquearManualmente(Usuario usuario, Long administradorId) {

        usuario.setIntentosFallidos(0);
        usuario.setBloqueadoHasta(null);

        usuarioRepository.save(usuario);

        bitacoraSeguridadService.registrar(
                usuario.getUsername(),
                usuario.getId(),
                TipoEventoSeguridad.CUENTA_DESBLOQUEADA,
                "Desbloqueo manual realizado por administrador id=%s".formatted(administradorId));
    }
}