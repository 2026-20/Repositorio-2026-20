import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from 'wa-sqlite/src/sqlite-api.js'
import { AccessHandlePoolVFS } from 'wa-sqlite/src/examples/AccessHandlePoolVFS.js'

// createSyncAccessHandle() (la API que usa AccessHandlePoolVFS para leer/
// escribir OPFS de forma sincrona) solo existe dentro de un Worker dedicado
// -- confirmado corriendo el POC: en el hilo principal tira
// "createSyncAccessHandle is not a function". Por eso todo este modulo vive
// en un worker y baseDatosLocal.js (hilo principal) solo habla con el por
// mensajes.
const NOMBRE_VFS = 'AccessHandlePool'

let estado = null

async function manejar(comando, datos) {
    switch (comando) {
        case 'abrir': {
            const modulo = await SQLiteESMFactory()
            const sqlite3 = SQLite.Factory(modulo)
            const vfs = new AccessHandlePoolVFS(datos.directorioOpfs)
            await vfs.isReady
            sqlite3.vfs_register(vfs, true)
            const db = await sqlite3.open_v2(
                datos.nombreArchivo,
                SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE,
                NOMBRE_VFS,
            )
            estado = { sqlite3, db, vfs }
            return true
        }
        case 'ejecutar':
            await estado.sqlite3.run(estado.db, datos.sql, datos.params)
            return true
        case 'consultar':
            return estado.sqlite3.execWithParams(estado.db, datos.sql, datos.params)
        case 'cerrar':
            await estado.sqlite3.close(estado.db)
            await estado.vfs.close()
            estado = null
            return true
        default:
            throw new Error(`comando desconocido: ${comando}`)
    }
}

self.onmessage = async (evento) => {
    const { id, comando, datos } = evento.data
    try {
        const resultado = await manejar(comando, datos)
        self.postMessage({ id, resultado })
    } catch (error) {
        self.postMessage({ id, error: error.message })
    }
}
