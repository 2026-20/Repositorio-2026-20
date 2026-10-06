package cr.co.capris.reactivos.auditoria;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class AuditoriaIngestaApiKeyFilterTest {

    private static final String CLAVE_CORRECTA = "la-clave-de-verdad";

    private final AuditoriaIngestaApiKeyFilter filtro = new AuditoriaIngestaApiKeyFilter(CLAVE_CORRECTA);

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletRequest requestA(String ruta) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", ruta);
        request.setRequestURI(ruta);
        return request;
    }

    @Test
    void conLaClaveCorrectaEnUnaRutaDeIngestaDejaUnaAutenticacionSistema() throws Exception {
        MockHttpServletRequest request = requestA("/api/auditoria/ingesta/bodegas");
        request.addHeader(AuditoriaIngestaApiKeyFilter.HEADER_API_KEY, CLAVE_CORRECTA);
        HttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filtro.doFilter(request, response, chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                .extracting(Object::toString)
                .containsExactly("ROLE_SISTEMA_INGESTA");
        verify(chain).doFilter(request, response);
    }

    @Test
    void conUnaClaveIncorrectaNoDejaNingunaAutenticacion() throws Exception {
        MockHttpServletRequest request = requestA("/api/auditoria/ingesta/bodegas");
        request.addHeader(AuditoriaIngestaApiKeyFilter.HEADER_API_KEY, "cualquier-otra-cosa");
        FilterChain chain = mock(FilterChain.class);

        filtro.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void sinElHeaderNoDejaNingunaAutenticacion() throws Exception {
        MockHttpServletRequest request = requestA("/api/auditoria/ingesta/bodegas");
        FilterChain chain = mock(FilterChain.class);

        filtro.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void laClaveCorrectaEnUnaRutaQueNoEsDeIngestaNoHaceNada() throws Exception {
        MockHttpServletRequest request = requestA("/api/usuarios");
        request.addHeader(AuditoriaIngestaApiKeyFilter.HEADER_API_KEY, CLAVE_CORRECTA);
        FilterChain chain = mock(FilterChain.class);

        filtro.doFilter(request, new MockHttpServletResponse(), chain);

        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }
}
