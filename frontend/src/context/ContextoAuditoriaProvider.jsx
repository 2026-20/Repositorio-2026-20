import { useCallback, useState } from 'react'

import { useAuth } from './useAuth'
import { CLAVE_CONTEXTO, ContextoAuditoriaContext } from './ContextoAuditoriaContext'

// sessionStorage (igual que el token en AuthProvider): el contexto es "de la
// sesion" (HU-004 criterio 2) -- sobrevive a recargar la pagina y funciona
// sin conexion, pero no queda pegado para la proxima vez que alguien abra
// la app. Se guarda junto con el usuarioId para no mostrarle a un usuario
// el contexto que dejo otro en el mismo dispositivo.
function leerContextoGuardado(usuarioId) {
    if (!usuarioId) return null
    try {
        const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CONTEXTO))
        return guardado?.usuarioId === usuarioId ? guardado.contrato : null
    } catch {
        return null
    }
}

function guardarContexto(usuarioId, contrato) {
    sessionStorage.setItem(CLAVE_CONTEXTO, JSON.stringify({ usuarioId, contrato }))
}

// HU-004. Un solo estado compartido para toda la app (mismo patron que
// SincronizacionProvider): Mi ruta elige el contrato y la bodega, y Conteo
// los lee con useContextoAuditoria().
//
// contexto = el contrato activo ({ numCon, objCon }, armado en Mi ruta desde la
// ruta guardada localmente) mas codBodSeleccionada: la bodega de ese contrato
// que se eligio para contar.
export function ContextoAuditoriaProvider({ children }) {
    const { usuario } = useAuth()
    const usuarioId = usuario?.id
    const [contexto, setContexto] = useState(() => leerContextoGuardado(usuarioId))

    // Al cerrar sesion o cambiar de usuario el contexto anterior deja de
    // valer ("ajustar el estado durante el render", ver
    // SincronizacionProvider). Sin sesion se borra tambien lo guardado.
    const [usuarioIdPrevio, setUsuarioIdPrevio] = useState(usuarioId)
    if (usuarioId !== usuarioIdPrevio) {
        setUsuarioIdPrevio(usuarioId)
        if (!usuarioId) {
            sessionStorage.removeItem(CLAVE_CONTEXTO)
        }
        setContexto(leerContextoGuardado(usuarioId))
    }

    // Cambiar de contrato descarta la bodega elegida: era del contrato anterior.
    const establecerContexto = useCallback(
        (contrato) => {
            if (!usuarioId) return
            const valor = { ...contrato, codBodSeleccionada: null, seleccionadoEn: new Date().toISOString() }
            guardarContexto(usuarioId, valor)
            setContexto(valor)
        },
        [usuarioId],
    )

    const seleccionarBodega = useCallback(
        (codBod) => {
            if (!usuarioId || !contexto) return
            const valor = { ...contexto, codBodSeleccionada: codBod }
            guardarContexto(usuarioId, valor)
            setContexto(valor)
        },
        [usuarioId, contexto],
    )

    const limpiarContexto = useCallback(() => {
        sessionStorage.removeItem(CLAVE_CONTEXTO)
        setContexto(null)
    }, [])

    return (
        <ContextoAuditoriaContext.Provider value={{ contexto, establecerContexto, seleccionarBodega, limpiarContexto }}>
            {children}
        </ContextoAuditoriaContext.Provider>
    )
}
