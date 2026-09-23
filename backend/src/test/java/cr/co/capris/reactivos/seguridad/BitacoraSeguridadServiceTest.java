package cr.co.capris.reactivos.seguridad;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

/**
 * Punto unico de escritura a la bitacora de seguridad (usado por HU-043, HU-047,
 * HU-048, entre otras). Se verifica que arme y guarde el registro con los datos
 * recibidos y una fecha real (no null).
 */
@ExtendWith(MockitoExtension.class)
class BitacoraSeguridadServiceTest {

    @Mock
    private BitacoraSeguridadRepository bitacoraSeguridadRepository;

    private BitacoraSeguridadService service;

    @BeforeEach
    void setUp() {
        service = new BitacoraSeguridadService(bitacoraSeguridadRepository);
    }

    @Test
    void registrarGuardaUnEventoConLosDatosRecibidosYUnaFecha() {
        OffsetDateTime antes = OffsetDateTime.now();

        service.registrar("wmolina", 10L, TipoEventoSeguridad.USUARIO_CREADO, "Usuario creado con rol Administrador");

        ArgumentCaptor<BitacoraSeguridad> captor = ArgumentCaptor.forClass(BitacoraSeguridad.class);
        verify(bitacoraSeguridadRepository).save(captor.capture());

        BitacoraSeguridad registrado = captor.getValue();
        assertThat(registrado.getUsername()).isEqualTo("wmolina");
        assertThat(registrado.getUsuarioId()).isEqualTo(10L);
        assertThat(registrado.getTipoEvento()).isEqualTo(TipoEventoSeguridad.USUARIO_CREADO);
        assertThat(registrado.getDetalle()).isEqualTo("Usuario creado con rol Administrador");
        assertThat(registrado.getFecha()).isNotNull().isAfterOrEqualTo(antes);
    }

    @Test
    void registrarAceptaUsuarioIdNuloCuandoElUsuarioNoExiste() {
        service.registrar("noexiste", null, TipoEventoSeguridad.LOGIN_FALLIDO, "usuarioNoRegistrado=true");

        ArgumentCaptor<BitacoraSeguridad> captor = ArgumentCaptor.forClass(BitacoraSeguridad.class);
        verify(bitacoraSeguridadRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuarioId()).isNull();
    }
}
