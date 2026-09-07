package cr.co.capris.reactivos.auth;

import cr.co.capris.reactivos.seguridad.ContextoUsuarioActual;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

/**
 * Implementacion real de ContextoUsuarioActual (ver paquete seguridad). Instancia
 * nueva por cada peticion HTTP; JwtAuthenticationFilter la rellena si el request
 * trae un JWT valido. Si no hay token (o es invalido), queda vacia -- quien la
 * consuma debe verificar null antes de usarla.
 */
@Component
@RequestScope
public class ContextoUsuarioActualImpl implements ContextoUsuarioActual {

	private Long usuarioId;
	private Long empresaId;
	private String rol;

	@Override
	public Long getUsuarioId() {
		return usuarioId;
	}

	@Override
	public Long getEmpresaId() {
		return empresaId;
	}

	@Override
	public String getRol() {
		return rol;
	}

	public void establecer(Long usuarioId, Long empresaId, String rol) {
		this.usuarioId = usuarioId;
		this.empresaId = empresaId;
		this.rol = rol;
	}
}
