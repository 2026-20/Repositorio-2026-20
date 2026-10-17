# Alternativa visual de Conteo (rama experimental)

Esta rama (`sprint3-conteo-widgets`) es una prueba de diseño para la
sesión de pruebas de usabilidad, partiendo de `sprint3-prototipo-local`.
**No es la versión de producción** — la versión validada sigue intacta en
`sprint3-prototipo-local` (y en el worktree `/home/izuku/Inge/sprint3-prototipo-local`),
sin tocar.

## Qué cambia

Solo la presentación de `ConteoPage` (y, en menor medida, `MiRutaPage`
para mantener el mismo lenguaje visual). La lógica de negocio, las
validaciones, el almacenamiento local y las llamadas a los repositorios
son las mismas — lo que cambia es cómo se presentan:

- **Lista única de artículos** con su estado (Pendiente / Contado /
  Faltante / Sobrante) en la misma tarjeta, en vez de un `<select>` +
  dos listas de resumen separadas.
- **Tiles de resumen tocables** (Todos/Contados/Pendientes/Con
  diferencia) que a la vez muestran la cifra y filtran la lista.
- **Hoja inferior ("bottom sheet")** con un stepper numérico (+/-) para
  registrar o corregir un conteo, en vez de un formulario siempre visible
  en la página.
- Lotes como píldoras tocables en vez de un `<select>`.

## Qué NO cambia

Las HU que sustentan esta pantalla (HU-005 a HU-008, HU-021, HU-025 a
HU-028, HU-030, HU-032, HU-038) siguen cumpliéndose funcionalmente — se
verificó con una batería de pruebas adaptada a la nueva interfaz, no solo
visualmente. Lo que **no** se buscó mantener es la conformidad literal con
el estándar visual del equipo (`IS-011`): esta rama es, a propósito, una
exploración por fuera de esos tokens específicos donde hacía falta para
lograr el look "widget".

## Si se descarta

Si después de las pruebas se decide no seguir por este camino, basta con
no fusionar esta rama — `sprint3-prototipo-local` nunca se tocó.
