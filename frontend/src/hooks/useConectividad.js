import { useEffect, useState } from 'react'

// HU-046 criterio 1: antes de llamar al backend, hay que saber si el
// dispositivo tiene conexión. navigator.onLine cambia de valor apenas el
// sistema operativo detecta que se perdió/recuperó la red (no espera a que
// falle una petición), que es justo lo que pide el criterio: "la operación
// debe interrumpirse inmediatamente".
//
// OJO: navigator.onLine puede dar falso positivo (dice "en línea" si hay wifi
// pero el router no tiene salida real a internet). Por eso
// recuperacionService.js NO confía solo en este hook -- también atrapa el
// error real de fetch() como respaldo. Ver el comentario en ese archivo.
export function useConectividad() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)

  useEffect(() => {
    const marcarEnLinea = () => setEnLinea(true)
    const marcarSinConexion = () => setEnLinea(false)

    window.addEventListener('online', marcarEnLinea)
    window.addEventListener('offline', marcarSinConexion)

    return () => {
      window.removeEventListener('online', marcarEnLinea)
      window.removeEventListener('offline', marcarSinConexion)
    }
  }, [])

  return enLinea
}
