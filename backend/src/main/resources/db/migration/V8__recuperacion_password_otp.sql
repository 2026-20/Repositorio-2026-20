-- HU-046: recuperación de contraseña vía OTP por correo.
-- Amplía token_recuperacion (creada en V3) con el contador de intentos fallidos
-- de validación del OTP (criterio de aceptación 5: máximo 3 intentos, luego se
-- invalida el token). El OTP en sí NUNCA se guarda en texto plano en la columna
-- "token" -- se guarda su hash (BCrypt), igual que la contraseña del usuario.

ALTER TABLE token_recuperacion
    ADD COLUMN intentos_fallidos INT NOT NULL DEFAULT 0;

-- Consulta frecuente del flujo: "¿tiene este usuario un token de recuperación
-- activo ahora mismo?" (se busca por usuario, no por el token en sí).
CREATE INDEX idx_token_recuperacion_usuario_activo
    ON token_recuperacion (usuario_id)
    WHERE usado = false;

-- HU-046 criterio 4 (la política de contraseñas incluye "historial"): no
-- existía ninguna tabla de historial de contraseñas en el esquema. Se agrega
-- aquí como infraestructura compartida (mismo patrón que bitacora_seguridad)
-- porque HU-044 y HU-045 también van a necesitar impedir la reutilización de
-- una contraseña anterior -- coordinar con quienes implementen esas HUs antes
-- de duplicar esta tabla o la lógica que la usa (ver HistorialContrasenaService).
CREATE TABLE historial_contrasena (
    id             BIGSERIAL PRIMARY KEY,
    usuario_id     BIGINT NOT NULL REFERENCES usuario(id),
    password_hash  VARCHAR(100) NOT NULL,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_contrasena_usuario ON historial_contrasena (usuario_id);
