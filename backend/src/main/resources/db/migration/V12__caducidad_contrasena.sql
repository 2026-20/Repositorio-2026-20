-- HU-049: caducidad automática de la contraseña a los 30 días.
-- Las cuentas que ya existían al aplicar esta migración reciben 30 días de
-- vigencia desde la migración; las cuentas pendientes de primer ingreso
-- comienzan su vigencia cuando cambian la contraseña temporal (HU-044).

ALTER TABLE usuario
    ADD COLUMN password_expira_en TIMESTAMPTZ;

UPDATE usuario
SET password_expira_en = now() + INTERVAL '30 days'
WHERE estado IN ('ACTIVO', 'INACTIVO');