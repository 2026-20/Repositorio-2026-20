package cr.co.capris.reactivos.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "token_sesion_revocado")
public class TokenSesionRevocado {

    @Id
    @Column(name = "jti", nullable = false, length = 36)
    private String jti;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "revocado_en", nullable = false)
    private OffsetDateTime revocadoEn;

    @Column(name = "expira_en", nullable = false)
    private OffsetDateTime expiraEn;

    protected TokenSesionRevocado() {
    }

    public TokenSesionRevocado(
            String jti,
            Long usuarioId,
            OffsetDateTime revocadoEn,
            OffsetDateTime expiraEn
    ) {
        this.jti = jti;
        this.usuarioId = usuarioId;
        this.revocadoEn = revocadoEn;
        this.expiraEn = expiraEn;
    }

    public String getJti() {
        return jti;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public OffsetDateTime getRevocadoEn() {
        return revocadoEn;
    }

    public OffsetDateTime getExpiraEn() {
        return expiraEn;
    }
}