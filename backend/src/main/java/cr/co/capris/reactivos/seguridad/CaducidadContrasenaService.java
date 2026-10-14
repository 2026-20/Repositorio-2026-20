package cr.co.capris.reactivos.seguridad;

import cr.co.capris.reactivos.usuario.Usuario;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.OffsetDateTime;

/**
 * HU-049: calcula y renueva la vigencia fija de 30 dias de la contraseña.
 */
@Service
public class CaducidadContrasenaService {

    public static final int DIAS_VIGENCIA = 30;

    private final Clock clock;

    public CaducidadContrasenaService() {this(Clock.systemUTC());}

    CaducidadContrasenaService(Clock clock) {this.clock = clock;}

    public boolean estaVencida(Usuario usuario) {
        OffsetDateTime expiraEn = usuario.getPasswordExpiraEn();
        return expiraEn != null && !expiraEn.isAfter(OffsetDateTime.now(clock));
    }

    public void reiniciarVigencia(Usuario usuario) {
        usuario.setPasswordExpiraEn(OffsetDateTime.now(clock).plusDays(DIAS_VIGENCIA));
    }
}
