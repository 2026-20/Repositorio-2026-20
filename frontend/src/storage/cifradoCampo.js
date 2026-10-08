// Cifrado a nivel de campo con WebCrypto (AES-GCM) para los datos que se
// guardan en el almacenamiento local (wa-sqlite/OPFS o el fallback Dexie.js).
// No existe un SQLCipher real para navegador, por eso la decision del equipo
// fue cifrar campo por campo en vez de la base completa (ver docs/
// CONTEXTO_PROYECTO.md seccion 2.1).
//
// El manejo/almacenamiento de la clave (derivarla del login, guardarla en
// IndexedDB, rotarla, etc.) es un problema aparte, todavia no resuelto --
// este modulo solo cifra/descifra dada una CryptoKey ya obtenida.

const ALGORITMO = 'AES-GCM'
const LONGITUD_IV_BYTES = 12

export async function generarClave() {
  return crypto.subtle.generateKey({ name: ALGORITMO, length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function cifrar(clave, textoPlano) {
  const iv = crypto.getRandomValues(new Uint8Array(LONGITUD_IV_BYTES))
  const datos = new TextEncoder().encode(textoPlano)
  const cifrado = await crypto.subtle.encrypt({ name: ALGORITMO, iv }, clave, datos)
  return { iv, cifrado: new Uint8Array(cifrado) }
}

export async function descifrar(clave, iv, cifrado) {
  const datos = await crypto.subtle.decrypt({ name: ALGORITMO, iv }, clave, cifrado)
  return new TextDecoder().decode(datos)
}
