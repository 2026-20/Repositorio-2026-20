## Qué hicimos

<!-- Resumen breve de los cambios. Si el PR toca varias cosas sin relación, probablemente debería ser varios PR. -->

## Por qué lo hicimos

<!-- Qué HU cumple o qué problema resuelve. Si no hay una HU detrás (ej. tooling, CI), decilo explícitamente. -->

## Cómo lo probamos

<!-- Marcá lo que aplique a este PR y borrá lo que no. Testcontainers y Playwright no siempre corren en local -- si no los corriste, decilo y confiá en CI, no lo marques sin haberlo corrido. -->

- [ ] Backend — `mvn test` (unitarias: JUnit + Mockito + AssertJ)
- [ ] Backend — `mvn verify` (+ integración con Testcontainers, requiere Docker) — **obligatorio si el PR toca `usuario/` o `seguridad/`, o agrega una migración**
- [ ] Frontend — `npm test` (unitarias/componente)
- [ ] Frontend — `npm run test:browser` — si el PR toca almacenamiento local (OPFS)
- [ ] Frontend — `npm run test:e2e`
- [ ] Probado manualmente en el navegador/app (describir el escenario abajo)

Comandos o pasos manuales adicionales que corrí:

```
```

## Issue relacionado

Closes #NUMERO

## Checklist técnico

- [ ] El código compila (`mvn compile` / `npm run build`) sin warnings nuevos.
- [ ] Las pruebas pasan en local **y** en el check de CI del PR (no asumir que porque pasó en mi máquina va a pasar en CI).
- [ ] Si agregué una migración Flyway, es un archivo **nuevo** (`V{n}__descripcion.sql`) — nunca edité un `V1`/`V2`/`V3`... que ya estaba mergeado.
- [ ] Actualicé `README.md` o `.github/ESTRUCTURA.md` si el cambio afecta cómo se levanta el proyecto o la organización del código.
- [ ] Los mensajes visibles para el usuario final de la app están en **español** (idioma del producto — el personal de campo de CAPRIS/CCSS es hispanohablante).
- [ ] Puedo explicar cada cambio de este diff si me preguntan por qué está ahí.

## Checklist de seguridad y datos sensibles

<!-- El sistema maneja inventario e insumos médicos de la CCSS; esta sección no es opcional en PRs que tocan usuarios, autenticación o datos de bodegas/contratos. -->

- [ ] No hay contraseñas, tokens, claves ni credenciales reales en el diff (revisar también mensajes de commit y datos de prueba/semilla).
- [ ] Si el cambio toca una consulta a la base de datos, sigue filtrando por empresa a nivel de query (aislamiento multiempresa, HU-023) — nunca solo a nivel de presentación en el frontend.
- [ ] Si el cambio recibe input del usuario hacia la base de datos, usa consultas parametrizadas/JPA (nunca concatenación de SQL).
- [ ] Si el cambio agrega un endpoint nuevo que expone datos sensibles: hoy `SecurityConfig` deja todo abierto a propósito (`permitAll`, ver el `TODO` en ese archivo) mientras se decide qué rutas deben exigir el JWT (que ya se emite y se lee, ver `auth/`) — señalar aquí si este endpoint va a necesitar quedar protegido.
- [ ] Si el cambio escribe en `bitacora_seguridad`, sigue siendo de solo inserción (nadie debería poder editar o borrar un registro de auditoría).
- [ ] Si el cambio afecta el comportamiento sin conexión, lo pensé explícitamente: ¿qué pasa si el usuario está offline en este flujo?

## Notas para quien revisa

<!-- Ej: "esto lo probé solo con Chromium, falta probar en Windows"; "el algoritmo de bloqueo asume reloj del servidor, no del cliente"; "quedó pendiente X a propósito, se hace en otro PR". Si no hay nada que aclarar, dejar vacío o borrar la sección. -->
