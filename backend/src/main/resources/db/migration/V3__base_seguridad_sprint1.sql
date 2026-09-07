-- Base compartida para las HUs de seguridad del Sprint 1 (HU-001, 002, 023, 042 a 048).
-- Esta migracion NO implementa ninguna HU especifica: solo deja el esquema listo para
-- que cada persona conecte su logica sin competir por los mismos campos ni tablas.

-- HU-043 (bloqueo por intentos fallidos)
ALTER TABLE usuario
    ADD COLUMN intentos_fallidos INT NOT NULL DEFAULT 0,
    ADD COLUMN bloqueado_hasta TIMESTAMPTZ;

-- HU-046 (recuperacion de contraseña olvidada): tabla aparte, no mezclar con usuario,
-- para que un token usado/vencido no ensucie la tabla principal.
CREATE TABLE token_recuperacion (
    id         BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    token      VARCHAR(100) NOT NULL UNIQUE,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en  TIMESTAMPTZ NOT NULL,
    usado      BOOLEAN NOT NULL DEFAULT false
);

-- Bitacora de seguridad (referenciada explicitamente por HU-043, HU-047 y HU-048).
-- username se guarda ademas de usuario_id porque un intento de login fallido puede
-- venir de un username que ni siquiera existe en el sistema.
CREATE TABLE bitacora_seguridad (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50) NOT NULL,
    usuario_id  BIGINT REFERENCES usuario(id),
    tipo_evento VARCHAR(50) NOT NULL,
    detalle     TEXT,
    fecha       TIMESTAMPTZ NOT NULL DEFAULT now()
);
