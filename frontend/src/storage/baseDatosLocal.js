// La base SQLite (wa-sqlite + OPFS) vive en un Worker dedicado, no en el
// hilo principal -- ver baseDatosLocal.worker.js para el por que. Este
// modulo solo abre el worker y habla con el por mensajes.

function crearPuente(worker) {
    let siguienteId = 0
    const pendientes = new Map()

    worker.onmessage = (evento) => {
        const { id, resultado, error } = evento.data
        const promesa = pendientes.get(id)
        if (!promesa) return
        pendientes.delete(id)
        if (error) promesa.reject(new Error(error))
        else promesa.resolve(resultado)
    }

    return function enviar(comando, datos) {
        const id = siguienteId++
        return new Promise((resolve, reject) => {
            pendientes.set(id, { resolve, reject })
            worker.postMessage({ id, comando, datos })
        })
    }
}

// Antes era 5 reintentos x 25ms*intento (~375ms) -- alcanzaba en el caso
// simple, pero en una carga fresca de /conteo se abren varias sesiones de
// OPFS en paralelo (la sincronizacion automatica de AppLayout + la jornada +
// la ruta + la cola pendiente) y la liberacion real del handle de la sesion
// anterior a nivel de SO puede tardar mas que esa ventana (confirmado en
// navegador real, ver el comentario de abrirBaseLocal). 12 intentos con
// backoff lineal cubren hasta ~3.7s: suficiente para que el margen final se
// libere sin que la prueba (ni un usuario ahi afuera) vea el rechazo.
const REINTENTOS_MAXIMOS_AL_ABRIR = 12

function esAccessHandleTodaviaOcupado(error) {
    return /Access Handles cannot be created/.test(error?.message ?? '')
}

/**
 * Abre (o crea) una base SQLite persistida en OPFS. Cada llamada levanta un
 * Worker nuevo -- equivalente, para efectos de OPFS, a lo que pasaria en un
 * reload real de pagina (un realm de JS nuevo, un modulo WASM nuevo, un
 * registro de VFS nuevo). El directorio OPFS si persiste entre llamadas,
 * independientemente del Worker que lo escribio o leyo.
 *
 * Reintenta con backoff si OPFS todavia no termino de liberar el access
 * handle de la sesion anterior sobre este mismo archivo -- confirmado en un
 * navegador real: aunque cerrarBaseLocal() ya resolvio (el worker confirmo
 * "cerrado" y se le mando terminate()), la liberacion real del handle a
 * nivel de SO puede tardar un poco mas en reflejarse. Encolar en el
 * repositorio (ver datosMaestrosRepositorio.js) evita que DOS llamadas de
 * esta app choquen entre si, pero no alcanza para cubrir ese margen final
 * de la sesion que se esta cerrando.
 */
export async function abrirBaseLocal(directorioOpfs, nombreArchivo) {
    for (let intento = 1; intento <= REINTENTOS_MAXIMOS_AL_ABRIR; intento++) {
        const worker = new Worker(new URL('./baseDatosLocal.worker.js', import.meta.url), { type: 'module' })
        const enviar = crearPuente(worker)
        try {
            await enviar('abrir', { directorioOpfs, nombreArchivo })
            return { worker, enviar }
        } catch (error) {
            worker.terminate()
            const esElUltimoIntento = intento === REINTENTOS_MAXIMOS_AL_ABRIR
            if (esElUltimoIntento || !esAccessHandleTodaviaOcupado(error)) {
                throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 50 * intento))
        }
    }
}

export async function ejecutar(sesion, sql, params) {
    return sesion.enviar('ejecutar', { sql, params })
}

export async function consultar(sesion, sql, params) {
    return sesion.enviar('consultar', { sql, params })
}

/**
 * Cierra la conexion de SQLite y libera los access handles de OPFS (dentro
 * del worker), y termina el worker. Sin liberar los access handles, la
 * siguiente apertura sobre el mismo directorio falla -- son exclusivos por
 * archivo.
 */
export async function cerrarBaseLocal(sesion) {
    await sesion.enviar('cerrar')
    sesion.worker.terminate()
}
