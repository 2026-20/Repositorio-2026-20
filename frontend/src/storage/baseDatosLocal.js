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

/**
 * Abre (o crea) una base SQLite persistida en OPFS. Cada llamada levanta un
 * Worker nuevo -- equivalente, para efectos de OPFS, a lo que pasaria en un
 * reload real de pagina (un realm de JS nuevo, un modulo WASM nuevo, un
 * registro de VFS nuevo). El directorio OPFS si persiste entre llamadas,
 * independientemente del Worker que lo escribio o leyo.
 */
export async function abrirBaseLocal(directorioOpfs, nombreArchivo) {
    const worker = new Worker(new URL('./baseDatosLocal.worker.js', import.meta.url), { type: 'module' })
    const enviar = crearPuente(worker)
    await enviar('abrir', { directorioOpfs, nombreArchivo })
    return { worker, enviar }
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
