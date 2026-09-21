const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export const MENSAJE_SIN_CONEXION = 'Funcionalidad no disponible sin conexión a red'

async function llamar(ruta, cuerpo) {
  // Primera barrera (rápida, criterio 1): si el navegador ya sabe que no hay
  // red, ni siquiera se intenta.
  if (!navigator.onLine) {
    throw new Error(MENSAJE_SIN_CONEXION)
  }

  let respuesta
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    // Segunda barrera (real, criterio 1): fetch() lanza TypeError cuando la
    // petición de verdad no pudo salir a la red, aunque navigator.onLine haya
    // dicho que sí había conexión (ej. wifi conectado pero sin salida a
    // internet). Este catch es el respaldo que evita ese falso positivo.
    throw new Error(MENSAJE_SIN_CONEXION)
  }

  const datos = await respuesta.json().catch(() => ({}))
  if (!respuesta.ok) {
    throw new Error(datos.mensaje ?? 'Ocurrió un error inesperado')
  }
  return datos
}

export function solicitarRecuperacion(correo) {
  return llamar('/api/auth/recuperacion/solicitar', { correo })
}

export function validarOtp(correo, otp) {
  return llamar('/api/auth/recuperacion/validar-otp', { correo, otp })
}

export function establecerNuevaContrasena(tokenSesionTemporal, nuevaContrasena) {
  return llamar('/api/auth/recuperacion/nueva-contrasena', { tokenSesionTemporal, nuevaContrasena })
}
