import { useCallback, useEffect, useState } from 'react'

const CLAVE_TEMA = 'capris_tema'

function leerTemaGuardado() {
    try {
        const guardado = localStorage.getItem(CLAVE_TEMA)
        return guardado === 'claro' || guardado === 'oscuro' ? guardado : null
    } catch {
        return null
    }
}

function prefiereOscuroElSistema() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function aplicarTemaEfectivo(temaEfectivo) {
    document.documentElement.setAttribute(
        'data-theme',
        temaEfectivo === 'oscuro' ? 'dark' : 'light',
    )
}

// HU-029 (#67): el criterio 3 exige que, sin preferencia guardada, la
// aplicacion siga el modo del sistema operativo -- por eso "sin eleccion
// todavia" sigue existiendo como estado interno (tema === null). Pero el
// selector de Ajustes (AC1/AC2) solo ofrece Claro/Oscuro de forma
// explicita, por decision de negocio -- "seguir al sistema" nunca se
// muestra como opcion, solo decide el valor por defecto hasta que el
// usuario elige una vez (despues de eso, siempre se recuerda esa eleccion).
export function useTheme() {
    const [tema, setTemaEstado] = useState(leerTemaGuardado)
    const [sistemaOscuro, setSistemaOscuro] = useState(prefiereOscuroElSistema)

    useEffect(() => {
        const medioConsulta = window.matchMedia?.('(prefers-color-scheme: dark)')
        if (!medioConsulta) return

        function manejarCambio(evento) {
            setSistemaOscuro(evento.matches)
        }

        medioConsulta.addEventListener('change', manejarCambio)
        return () => medioConsulta.removeEventListener('change', manejarCambio)
    }, [])

    const temaEfectivo = tema ?? (sistemaOscuro ? 'oscuro' : 'claro')

    useEffect(() => {
        aplicarTemaEfectivo(temaEfectivo)
    }, [temaEfectivo])

    const setTema = useCallback((nuevoTema) => {
        if (nuevoTema !== 'claro' && nuevoTema !== 'oscuro') return

        setTemaEstado(nuevoTema)

        try {
            localStorage.setItem(CLAVE_TEMA, nuevoTema)
        } catch {
            // Almacenamiento no disponible (modo privado, etc.) -- el tema
            // sigue funcionando para esta sesion, solo no persiste.
        }
    }, [])

    const alternarTema = useCallback(() => {
        setTema(temaEfectivo === 'oscuro' ? 'claro' : 'oscuro')
    }, [temaEfectivo, setTema])

    return { temaEfectivo, setTema, alternarTema }
}
