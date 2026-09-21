import { useEffect, useState } from 'react'

// Los fondos animados (GradientWaves) se ocultan con prefers-reduced-motion,
// igual que el resto de las animaciones del proyecto (D04 -- motion).
export function usePrefiereMenosMovimiento() {
    const [prefiere, setPrefiere] = useState(
        () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    )

    useEffect(() => {
        const medioConsulta = window.matchMedia?.('(prefers-reduced-motion: reduce)')
        if (!medioConsulta) return undefined

        function manejarCambio(evento) {
            setPrefiere(evento.matches)
        }

        medioConsulta.addEventListener('change', manejarCambio)
        return () => medioConsulta.removeEventListener('change', manejarCambio)
    }, [])

    return prefiere
}