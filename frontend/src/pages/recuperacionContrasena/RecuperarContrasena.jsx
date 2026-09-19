import { useState } from 'react'
import {
  solicitarRecuperacion,
  validarOtp,
  establecerNuevaContrasena,
  MENSAJE_SIN_CONEXION,
} from '../../services/recuperacionService'
import { useConectividad } from '../../hooks/useConectividad'

// Un solo componente para los 3 pasos de HU-046 en vez de 3 páginas/rutas --
// más simple de integrar mientras el equipo no defina todavía cómo va a
// quedar routes/ (ver frontend/src/routes/.gitkeep). Si más adelante conviene
// una ruta por paso, este estado (paso/correo/otp/tokenSesionTemporal) es
// exactamente lo que habría que mover a la URL o a un contexto.
const PASO = { CORREO: 'correo', OTP: 'otp', NUEVA_CONTRASENA: 'nueva-contrasena', LISTO: 'listo' }

function RecuperarContrasena() {
  const enLinea = useConectividad()
  const [paso, setPaso] = useState(PASO.CORREO)
  const [correo, setCorreo] = useState('')
  const [otp, setOtp] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [tokenSesionTemporal, setTokenSesionTemporal] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  async function manejarEnvioCorreo(evento) {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const respuesta = await solicitarRecuperacion(correo)
      setMensaje(respuesta.mensaje)
      setPaso(PASO.OTP)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function manejarValidacionOtp(evento) {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const respuesta = await validarOtp(correo, otp)
      setTokenSesionTemporal(respuesta.tokenSesionTemporal)
      setMensaje(null)
      setPaso(PASO.NUEVA_CONTRASENA)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  async function manejarNuevaContrasena(evento) {
    evento.preventDefault()
    setError(null)
    setCargando(true)
    try {
      const respuesta = await establecerNuevaContrasena(tokenSesionTemporal, nuevaContrasena)
      setMensaje(respuesta.mensaje)
      setPaso(PASO.LISTO)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // Criterio 1: bloqueo total e inmediato de la pantalla si no hay conexión --
  // ni siquiera se muestra el formulario.
  if (!enLinea) {
    return <p role="alert">{MENSAJE_SIN_CONEXION}</p>
  }

  return (
    <div>
      <h1>Recuperar contraseña</h1>
      {error && <p role="alert">{error}</p>}

      {paso === PASO.CORREO && (
        <form onSubmit={manejarEnvioCorreo}>
          <label htmlFor="correo">Correo registrado</label>
          <input
            id="correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
          <button type="submit" disabled={cargando}>Enviar código</button>
        </form>
      )}

      {paso === PASO.OTP && (
        <form onSubmit={manejarValidacionOtp}>
          {mensaje && <p>{mensaje}</p>}
          <label htmlFor="otp">Código de 6 dígitos</label>
          <input
            id="otp"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          <p>El código vence 15 minutos después de haberlo solicitado.</p>
          <button type="submit" disabled={cargando}>Validar código</button>
        </form>
      )}

      {paso === PASO.NUEVA_CONTRASENA && (
        <form onSubmit={manejarNuevaContrasena}>
          <label htmlFor="nuevaContrasena">Nueva contraseña</label>
          <input
            id="nuevaContrasena"
            type="password"
            value={nuevaContrasena}
            onChange={(e) => setNuevaContrasena(e.target.value)}
            required
          />
          <button type="submit" disabled={cargando}>Guardar nueva contraseña</button>
        </form>
      )}

      {paso === PASO.LISTO && <p>{mensaje}</p>}
    </div>
  )
}

export default RecuperarContrasena
