-- HU-007: corregir un conteo ya registrado, mientras no este transmitido al
-- ERP. Default FALSE en ambas -- ningun conteo existente fue corregido
-- todavia, y la transmision al ERP (HU-040/041) no existe aun en este
-- prototipo, asi que transmitido siempre queda en false por ahora.
ALTER TABLE auditoria_conteo_fisico
    ADD COLUMN corregido   BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN transmitido BOOLEAN NOT NULL DEFAULT FALSE;
