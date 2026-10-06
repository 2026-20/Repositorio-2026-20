import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from './useAuth'
import { SincronizacionContext } from './SincronizacionContext'
import { obtenerUltimaSincronizacion } from '../storage/datosMaestrosRepositorio.js'
import { sincronizarDatosMaestros } from '../storage/sincronizacionDatosMaestros.js'

// Un solo estado compartido para toda la app (igual que AuthContext/
// AuthProvider) -- AppLayout dispara la sincronizacion automatica
// (HU-003 criterio 1) y SincronizacionPage necesita ver ese mismo estado,
// no una copia propia. Un hook comun (useState adentro, sin contexto)
// hubiera dado cada quien su propia copia aislada -- bug real, encontrado
// probando la pantalla en un navegador de verdad.
export function SincronizacionProvider({ children }) {
    const { usuario, token } = useAuth()
    const [estado, setEstado] = useState('inactivo') // inactivo | sincronizando | listo | error
    const [error, setError] = useState(null)
    const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null)

    // "Ajustar el estado durante el render" en vez de un useEffect (patron
    // recomendado por React para resetear estado cuando cambia una prop --
    // ver react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
    // Este provider vive en la raiz (ver main.jsx) y nunca se desmonta --
    // ni al cerrar sesion ni al iniciar sesion con otro usuario en el mismo
    // dispositivo. Sin este reset, el estado/fecha de un usuario anterior
    // quedaria visible hasta que la sincronizacion del usuario nuevo
    // termine (criterio 4: los datos mostrados deben ser del usuario que
    // inicio sesion, no de quien uso el dispositivo antes).
    const [usuarioIdPrevio, setUsuarioIdPrevio] = useState(usuario?.id)
    if (usuario?.id !== usuarioIdPrevio) {
        setUsuarioIdPrevio(usuario?.id)
        setEstado('inactivo')
        setError(null)
        setUltimaSincronizacion(null)
    }

    // Carga, de una vez, la ultima sincronizacion persistida de una sesion
    // anterior de ESTE usuario -- no hay que esperar a que termine una
    // nueva para saber cuando fue la ultima vez que se completo. Si la
    // sincronizacion automatica (AppLayout) ya establecio un valor mas
    // fresco para cuando esta lectura responde, el updater funcional
    // (actual ?? cuando) no lo pisa.
    useEffect(() => {
        if (!usuario?.id) return

        let cancelado = false

        obtenerUltimaSincronizacion(usuario.id)
            .then((cuando) => {
                if (!cancelado && cuando) {
                    setUltimaSincronizacion((actual) => actual ?? cuando)
                }
            })
            .catch(() => {
                // Mejor esfuerzo: si falla, simplemente no se muestra una
                // fecha previa. No es razon para romper la pantalla ni
                // dejar una promesa rechazada sin atrapar.
            })

        return () => {
            cancelado = true
        }
    }, [usuario?.id])

    // Se usa para que, si el usuario cambia mientras una sincronizacion
    // esta en curso (ej. cierra sesion e inicia con otro antes de que
    // termine), el resultado tardio no pise el estado del usuario nuevo.
    // Se actualiza en un efecto (no durante el render) porque leer/escribir
    // un ref durante el render no esta garantizado bajo render concurrente.
    const usuarioIdActualRef = useRef(usuario?.id)
    useEffect(() => {
        usuarioIdActualRef.current = usuario?.id
    })

    const sincronizar = useCallback(async () => {
        const usuarioIdDeEstaLlamada = usuario?.id
        if (!usuarioIdDeEstaLlamada || !token) return

        setEstado('sincronizando')
        setError(null)
        try {
            const cuando = await sincronizarDatosMaestros(usuarioIdDeEstaLlamada, token)
            if (usuarioIdActualRef.current !== usuarioIdDeEstaLlamada) return
            setUltimaSincronizacion(cuando)
            setEstado('listo')
        } catch (errorCapturado) {
            if (usuarioIdActualRef.current !== usuarioIdDeEstaLlamada) return
            setError(errorCapturado)
            setEstado('error')
        }
    }, [usuario, token])

    return (
        <SincronizacionContext.Provider value={{ estado, error, ultimaSincronizacion, sincronizar }}>
            {children}
        </SincronizacionContext.Provider>
    )
}
