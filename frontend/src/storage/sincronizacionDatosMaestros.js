import { listarBodegas, listarDetalleBodega, listarLotesBodega } from '../services/auditoriaService.js'
import { reemplazarCatalogos } from './datosMaestrosRepositorio.js'

export class ErrorSinConexion extends Error {
    constructor() {
        super('No hay conexion a internet. Los datos de la ultima sincronizacion no se modificaron.')
        this.name = 'ErrorSinConexion'
    }
}

// navigator.onLine puede dar falso positivo (wifi conectado pero sin
// salida real a internet -- ver el mismo comentario en useConectividad.js).
// Por eso, ademas de revisarlo antes de empezar, cualquier llamada al
// backend que falle sin siquiera llegar a tener una respuesta (fetch tira
// un TypeError, o el error que armamos en auditoriaService.js no trae
// `status` porque nunca hubo response) se trata igual que sin conexion.
// Un error que SI tiene `status` (401, 500, etc.) significa que el backend
// si contesto, y se propaga tal cual -- ese es "el motivo especifico del
// fallo" que pide el criterio 3 cuando el problema no es de red.
async function sinFalsoPositivoDeRed(promesaHttp) {
    try {
        return await promesaHttp
    } catch (error) {
        if (error.status === undefined) {
            throw new ErrorSinConexion()
        }
        throw error
    }
}

/**
 * HU-003. Descarga el catalogo completo (bodegas + su detalle + sus lotes)
 * y reemplaza el almacenamiento local de ese usuario de forma atomica.
 *
 * Criterio 3 ("los datos descargados previamente permanecen sin
 * modificacion" si falla): el reemplazo en el almacenamiento local
 * (reemplazarCatalogos) solo se llama si TODAS las descargas tuvieron
 * exito. Si cualquiera falla a medio camino, no se toca el almacenamiento
 * local en absoluto -- no hay un estado intermedio posible.
 *
 * Devuelve la fecha/hora ISO de la sincronizacion (criterio 1).
 */
export async function sincronizarDatosMaestros(usuarioId, token) {
    if (!navigator.onLine) {
        throw new ErrorSinConexion()
    }

    const bodegas = await sinFalsoPositivoDeRed(listarBodegas(token))

    // El backend expone el detalle/lotes de una bodega agrupados solo por
    // cod_bod -- si "bodegas" trae el mismo cod_bod en mas de una fila (el
    // ERP reusa el codigo bajo distinto tipo_bod/num_con, ver
    // datosMaestrosRepositorio.js), no hay que pedirlo dos veces.
    const detallesPorBodega = {}
    const lotesPorBodega = {}
    const codigosBodegaUnicos = [...new Set(bodegas.map((bodega) => bodega.codBod))]
    for (const codBod of codigosBodegaUnicos) {
        detallesPorBodega[codBod] = await sinFalsoPositivoDeRed(listarDetalleBodega(token, codBod))
        lotesPorBodega[codBod] = await sinFalsoPositivoDeRed(listarLotesBodega(token, codBod))
    }

    return reemplazarCatalogos(usuarioId, { bodegas, detallesPorBodega, lotesPorBodega })
}
