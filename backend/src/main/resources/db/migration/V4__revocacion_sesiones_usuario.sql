-- HU-048 (baja logica y revocacion de accesos): mecanismo para invalidar los JWT
-- ya emitidos de un usuario sin mantener una lista de tokens individuales. El JWT
-- sigue siendo stateless -- JwtAuthenticationFilter compara la fecha de emision del
-- token contra esta columna en cada peticion.
ALTER TABLE usuario
    ADD COLUMN sesiones_invalidadas_desde TIMESTAMPTZ;
