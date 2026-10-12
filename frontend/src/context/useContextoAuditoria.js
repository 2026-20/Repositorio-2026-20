import { useContext } from 'react'
import { ContextoAuditoriaContext } from './ContextoAuditoriaContext'

/**
 * HU-004: contrato activo de la sesion ({ contexto, establecerContexto,
 * seleccionarBodega, limpiarContexto }). contexto es null mientras no se
 * haya elegido uno; contexto.codBodSeleccionada es la bodega elegida en Mi
 * ruta para contar. Fuera de ContextoAuditoriaProvider devuelve null.
 */
export function useContextoAuditoria() {
    return useContext(ContextoAuditoriaContext)
}
