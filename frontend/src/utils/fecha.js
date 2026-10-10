// "YYYY-MM-DD" en hora local del dispositivo -- el mismo formato en que el
// backend manda/compara fechas (LocalDate), asi que se pueden comparar como
// texto. toISOString() no sirve: daria la fecha en UTC.
// Compartido entre MiRutaPage (HU-037) y JornadaProvider (HU-038): ambos
// necesitan saber si algo guardado localmente corresponde al dia de hoy.
export function hoyLocal() {
    const ahora = new Date()
    const mes = String(ahora.getMonth() + 1).padStart(2, '0')
    const dia = String(ahora.getDate()).padStart(2, '0')
    return `${ahora.getFullYear()}-${mes}-${dia}`
}
