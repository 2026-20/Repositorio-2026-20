import { useCallback, useState } from 'react'

import { useAuth } from '../context/useAuth'
import { sincronizarDatosMaestros } from '../storage/sincronizacionDatosMaestros'

export function useSincronizacionDatosMaestros() {
    const { usuario, token } = useAuth()
    const [estado, setEstado] = useState('inactivo') // inactivo | sincronizando | listo | error
    const [error, setError] = useState(null)
    const [ultimaSincronizacion, setUltimaSincronizacion] = useState(null)

    const sincronizar = useCallback(async () => {
        setEstado('sincronizando')
        setError(null)
        try {
            const cuando = await sincronizarDatosMaestros(usuario.id, token)
            setUltimaSincronizacion(cuando)
            setEstado('listo')
        } catch (errorCapturado) {
            setError(errorCapturado)
            setEstado('error')
        }
    }, [usuario, token])

    return { estado, error, ultimaSincronizacion, sincronizar }
}
