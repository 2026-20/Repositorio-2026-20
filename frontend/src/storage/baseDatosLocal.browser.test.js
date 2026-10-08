import { describe, expect, it } from 'vitest'

import { abrirBaseLocal, cerrarBaseLocal, consultar, ejecutar } from './baseDatosLocal.js'
import { cifrar, descifrar, generarClave } from './cifradoCampo.js'

// POC de la decision del equipo (wa-sqlite + OPFS, ver docs/CONTEXTO_
// PROYECTO.md seccion 2.1): abrir una base, escribir una fila cifrada,
// cerrarla, y volver a abrirla en un worker/modulo WASM totalmente nuevo
// (ver baseDatosLocal.js) para confirmar que el dato persiste en OPFS -- no
// solo en memoria de la conexion -- y que se puede descifrar igual que como
// se guardo.
//
// Corre contra un Chromium real via Playwright (jsdom no implementa OPFS
// ni Worker de verdad, ver vite.config.js, proyecto "browser").
describe('POC wa-sqlite + OPFS', () => {
    const directorioOpfs = 'capris-poc'
    const nombreArchivo = 'poc.db'

    it('una fila cifrada persiste y se descifra igual despues de cerrar y reabrir la base', async () => {
        const clave = await generarClave()
        const textoOriginal = 'MEPRIN-001: conteo pendiente de sincronizar'

        const sesion1 = await abrirBaseLocal(directorioOpfs, nombreArchivo)
        try {
            await ejecutar(
                sesion1,
                `CREATE TABLE IF NOT EXISTS prueba_cifrada (
                    id INTEGER PRIMARY KEY,
                    iv BLOB NOT NULL,
                    valor_cifrado BLOB NOT NULL
                )`,
            )
            await ejecutar(sesion1, 'DELETE FROM prueba_cifrada')

            const { iv, cifrado } = await cifrar(clave, textoOriginal)
            await ejecutar(sesion1, 'INSERT INTO prueba_cifrada (iv, valor_cifrado) VALUES (?, ?)', [
                iv,
                cifrado,
            ])
        } finally {
            await cerrarBaseLocal(sesion1)
        }

        // Mismo directorio OPFS, pero abrirBaseLocal levanta un worker nuevo --
        // equivalente a lo que pasaria en un reload real de pagina.
        const sesion2 = await abrirBaseLocal(directorioOpfs, nombreArchivo)
        try {
            const resultado = await consultar(sesion2, 'SELECT iv, valor_cifrado FROM prueba_cifrada')

            expect(resultado.rows).toHaveLength(1)
            const [ivLeido, cifradoLeido] = resultado.rows[0]
            const textoDescifrado = await descifrar(clave, ivLeido, cifradoLeido)
            expect(textoDescifrado).toBe(textoOriginal)
        } finally {
            await cerrarBaseLocal(sesion2)
        }
    })
})
