-- HU-050 (notificacion de vencimiento proximo de contraseña): registro de
-- que ya se envio un aviso (5/3/1 dias) para una vigencia de contraseña
-- especifica -- evita reenviarlo (criterio 5).
--
-- password_expira_en queda guardado junto al aviso (no solo el usuario y el
-- tipo) a proposito: es el "snapshot" de la vigencia para la que se mando
-- ese aviso. Si el usuario cambia su contraseña, CaducidadContrasenaService
-- le asigna un password_expira_en nuevo (ver HU-049) y los avisos de la
-- vigencia anterior quedan irrelevantes sin que haya que limpiarlos --
-- la vigencia nueva es libre de generar sus propios avisos 5/3/1 cuando
-- corresponda, porque la combinacion (usuario, tipo, password_expira_en)
-- nunca existio antes.
CREATE TABLE aviso_caducidad_contrasena_enviado (
    id                 BIGSERIAL PRIMARY KEY,
    usuario_id         BIGINT NOT NULL REFERENCES usuario(id),
    tipo_aviso         VARCHAR(20) NOT NULL,
    password_expira_en TIMESTAMPTZ NOT NULL,
    enviado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, tipo_aviso, password_expira_en)
);
