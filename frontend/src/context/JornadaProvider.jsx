import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from './useAuth'
import { JornadaContext } from './JornadaContext'
import { iniciarJornada, obtenerEstadoJornada } from '../services/auditoriaService'
import { hoyLocal } from '../utils/fecha.js'

function claveAlmacenamiento(usuarioId) {
    return `capris_jornada_${usuarioId}`
}

// Mejor esfuerzo: sin red, con el almacenamiento bloqueado (modo privado) o
// con un valor corrupto de una version anterior, simplemente no hay nada
// que recuperar -- no es razon para romper la pantalla (mismo criterio que
// datosMaestrosRepositorio.obtenerUltimaSincronizacion).
function leerCache(usuarioId) {
    if (!usuarioId) return null

    try {
        const guardado = localStorage.getItem(claveAlmacenamiento(usuarioId))
        if (!guardado) return null

        const { fecha, iniciadaEn } = JSON.parse(guardado)
        return fecha === hoyLocal() ? iniciadaEn : null
    } catch {
        return null
    }
}

function guardarCache(usuarioId, iniciadaEn) {
    try {
        localStorage.setItem(claveAlmacenamiento(usuarioId), JSON.stringify({ fecha: hoyLocal(), iniciadaEn }))
    } catch {
        // Almacenamiento lleno o bloqueado -- la sesion sigue funcionando,
        // solo sin respaldo local para la proxima vez que se abra la app.
    }
}

/**
 * HU-038: confirmacion de inicio de jornada. Un solo estado compartido para
 * toda la app (mismo patron que Auth/SincronizacionProvider) -- MiRutaPage
 * (donde se confirma), el encabezado (donde se muestra) y, a futuro, las
 * pantallas de conteo (que deben bloquearse sin jornada confirmada)
 * necesitan ver el mismo valor, no una copia propia cada uno.
 *
 * El estado se guarda en localStorage (no sessionStorage, a diferencia de
 * AuthProvider) porque esto es offline-first: si el Usuario de Campo
 * confirma su jornada con conexion y luego cierra y reabre la app ya sin
 * red ese mismo dia, debe seguir viendo "jornada iniciada", no perderlo al
 * reiniciar el proceso de la PWA.
 */
export function JornadaProvider({ children }) {
    const { usuario, token } = useAuth()

    const [iniciadaEn, setIniciadaEn] = useState(() => leerCache(usuario?.id))
    const [cargando, setCargando] = useState(true)
    const [confirmando, setConfirmando] = useState(false)
    const [error, setError] = useState(null)

    // Reset al cambiar de usuario en el mismo dispositivo (ver
    // SincronizacionProvider: mismo motivo, este provider tampoco se
    // desmonta entre sesiones).
    const [usuarioIdPrevio, setUsuarioIdPrevio] = useState(usuario?.id)
    if (usuario?.id !== usuarioIdPrevio) {
        setUsuarioIdPrevio(usuario?.id)
        setIniciadaEn(leerCache(usuario?.id))
        setCargando(true)
        setConfirmando(false)
        setError(null)
    }

    // Para que una respuesta tardia de un usuario anterior no pise el
    // estado del usuario nuevo si cambia de sesion mientras la consulta
    // esta en curso.
    const usuarioIdActualRef = useRef(usuario?.id)
    useEffect(() => {
        usuarioIdActualRef.current = usuario?.id
    })

    // Al entrar a la app (o cambiar de usuario) se consulta la verdad del
    // backend -- lo que trajo leerCache() es solo lo que se muestra mientras
    // esta consulta esta en curso, o si no hay red.
    useEffect(() => {
        if (!usuario?.id || !token) {
            setCargando(false)
            return
        }

        let cancelado = false

        obtenerEstadoJornada(token)
            .then((respuesta) => {
                if (cancelado || usuarioIdActualRef.current !== usuario.id) return

                const valorVigente = respuesta.iniciada ? respuesta.iniciadaEn : null
                setIniciadaEn(valorVigente)
                guardarCache(usuario.id, valorVigente)
            })
            .catch(() => {
                // Sin red o sesion vencida: se queda con lo que ya habia en
                // cache -- "mejor esfuerzo", igual que el resto de lecturas
                // de estado al entrar a la app.
            })
            .finally(() => {
                if (!cancelado) setCargando(false)
            })

        return () => {
            cancelado = true
        }
    }, [usuario?.id, token])

    const confirmarInicio = useCallback(async () => {
        if (!usuario?.id || !token) return

        setConfirmando(true)
        setError(null)
        try {
            const respuesta = await iniciarJornada(token)
            setIniciadaEn(respuesta.iniciadaEn)
            guardarCache(usuario.id, respuesta.iniciadaEn)
        } catch (errorCapturado) {
            setError(errorCapturado)
        } finally {
            setConfirmando(false)
        }
    }, [usuario, token])

    return (
        <JornadaContext.Provider
            value={{
                iniciada: Boolean(iniciadaEn),
                iniciadaEn,
                cargando,
                confirmando,
                error,
                confirmarInicio,
            }}
        >
            {children}
        </JornadaContext.Provider>
    )
}
