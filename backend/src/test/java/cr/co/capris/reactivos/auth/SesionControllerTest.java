package cr.co.capris.reactivos.auth;

import io.jsonwebtoken.Claims;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;

import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** HU-002: cerrar sesion revoca el JWT actual (bitacora de tokens revocados). */
@ExtendWith(MockitoExtension.class)
class SesionControllerTest {

    private static final String TOKEN = "eyJhbGciOiJIUzI1NiJ9.cuerpo.firma";

    @Mock
    private JwtService jwtService;

    @Mock
    private TokenSesionRevocadoService tokenSesionRevocadoService;

    @Mock
    private Claims claims;

    private SesionController controller;

    @BeforeEach
    void setUp() {
        controller = new SesionController(jwtService, tokenSesionRevocadoService);
    }

    @Test
    void logoutExtraeElTokenDelHeaderAuthorizationYLoValida() {
        when(jwtService.validarYObtenerClaims(TOKEN)).thenReturn(claims);

        controller.logout("Bearer " + TOKEN);

        verify(jwtService).validarYObtenerClaims(TOKEN);
    }

    @Test
    void logoutRevocaLosClaimsValidadosDelToken() {
        when(jwtService.validarYObtenerClaims(TOKEN)).thenReturn(claims);

        controller.logout("Bearer " + TOKEN);

        verify(tokenSesionRevocadoService).revocar(claims);
    }
}
