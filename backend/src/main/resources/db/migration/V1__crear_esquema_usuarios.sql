-- Esquema base de usuarios (HU-001, HU-023, HU-042 a HU-048).
-- EMPRESA y ROL no existian como tablas explicitas en el modelo E-R original
-- (Figura 6 del documento de arquitectura) -- se agregan aqui porque HU-023
-- (aislamiento multiempresa) depende de poder filtrar por empresa a nivel de query.

CREATE TABLE empresa (
    id     BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE rol (
    id     BIGSERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    id                            BIGSERIAL PRIMARY KEY,
    nombre_completo               VARCHAR(150) NOT NULL,
    cedula                        VARCHAR(20)  NOT NULL UNIQUE,
    correo                        VARCHAR(150) NOT NULL UNIQUE,
    username                      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash                 VARCHAR(100) NOT NULL,
    estado                        VARCHAR(30)  NOT NULL,
    rol_id                        BIGINT       NOT NULL REFERENCES rol(id),
    empresa_id                    BIGINT       NOT NULL REFERENCES empresa(id),
    password_temporal_expira_en   TIMESTAMPTZ
);
