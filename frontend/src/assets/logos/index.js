import caprisMedicaLogo from './capris-medica-logo.png'
import diagnostikaLogo from './diagnostika-logo.png'

// Llave por nombre, no por id -- el id autoincremental de empresa NO es estable entre
// entornos (depende de cuanto haya avanzado la secuencia en cada base antes de que su
// fila se inserte), pero empresa.nombre es UNIQUE NOT NULL desde V1 y es el mismo texto
// en cualquier entorno. Confirmado con datos reales: en la base local, "Diagnostika"
// quedo con id 34 (no 2) porque la secuencia ya venia avanzada.
export const LOGOS_POR_EMPRESA = {
    'CAPRIS Médica': caprisMedicaLogo,
    'Diagnostika': diagnostikaLogo,
}
