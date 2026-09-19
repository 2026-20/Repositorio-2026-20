CREATE TABLE token_sesion_revocado (
                                       jti         VARCHAR(36) PRIMARY KEY,
                                       usuario_id  BIGINT NOT NULL REFERENCES usuario(id),
                                       revocado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
                                       expira_en   TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_token_sesion_revocado_expira_en
    ON token_sesion_revocado(expira_en);