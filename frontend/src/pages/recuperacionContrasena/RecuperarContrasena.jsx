import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  solicitarRecuperacion,
  validarOtp,
  establecerNuevaContrasena,
  MENSAJE_SIN_CONEXION,
} from '../../services/recuperacionService'
import { useConectividad } from '../../hooks/useConectividad'
import GradientWaves from '../../components/effects/GradientWaves'
import Icon from '../../components/ui/Icon'
import PasswordField from '../../components/ui/PasswordField'
import { usePrefiereMenosMovimiento } from '../../hooks/usePrefiereMenosMovimiento'
import { paths } from '../../routes/paths'
import styles from './RecuperarContrasena.module.css'

// Un solo componente para los 3 pasos de HU-046 en vez de 3 páginas/rutas --
// más simple de integrar mientras el equipo no defina todavía cómo va a
// quedar routes/ (ver frontend/src/routes/.gitkeep). Si más adelante conviene
// una ruta por paso, este estado (paso/correo/otp/tokenSesionTemporal) es
// exactamente lo que habría que mover a la URL o a un contexto.
const PASO = { CORREO: 'correo', OTP: 'otp', NUEVA_CONTRASENA: 'nueva-contrasena', LISTO: 'listo' }

function RecuperarContrasena() {
  const enLinea = useConectividad()
  const prefiereMenosMovimiento = usePrefiereMenosMovimiento()
  const [paso, setPaso] = useState(PASO.CORREO)
  const [correo, setCorreo] = useState('')
  const [otp, setOtp] = useState('')
  const [nuevaContrasena, setNuevaContrasena] = useState('')
  const [tokenSesionTemporal, setTokenSesionTemporal] = useState(null)
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)

  // El navegador valida "required"/type="email" con su propio mensaje nativo,
  // en el idioma del sistema operativo o del navegador -- no del sitio. Con
  // "noValidate" en el <form> se apaga esa validacion nativa y se reemplaza
  // por esta, siempre en español sin importar la maquina de quien la usa.
  function validarCorreo() {
    if (!correo.trim()) {
      return 'Ingresá el correo registrado.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return 'Ingresá un correo válido.'
    }
    return ''
  }

  function validarOtpLocal() {
    if (!otp.trim()) {
      return 'Ingresá el código de 6 dígitos.'
    }
    if (!/^\d{6}$/.test(otp)) {
      return 'El código debe tener 6 dígitos.'
    }
    return ''
  }

  function validarNuevaContrasenaLocal() {
    if (!nuevaContrasena) {
      return 'Ingresá la contraseña nueva.'
    }
    return ''
  }

  async function manejarEnvioCorreo(evento) {
    evento.preventDefault()
    setError(null)

    const errorLocal = validarCorreo()
    if (errorLocal) {
      setError(errorLocal)
      return
    }

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

    const errorLocal = validarOtpLocal()
    if (errorLocal) {
      setError(errorLocal)
      return
    }

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

    const errorLocal = validarNuevaContrasenaLocal()
    if (errorLocal) {
      setError(errorLocal)
      return
    }

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
    return (
      <main className={styles.pagina}>
        <section className={styles.tarjeta}>
          <p role="alert">{MENSAJE_SIN_CONEXION}</p>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.pagina}>
      {!prefiereMenosMovimiento && (
        <div className={styles.fondo} aria-hidden="true">
          <GradientWaves
            horizonColor="#bfd6ec"
            waveColor="#0f426e"
            crestColor="#ffffff"
            speed={0.4}
            amplitude={2.5}
            waveScale={0.6}
            waveRatio={0.9}
            swell={35}
            turbulence={20}
            tilt={1.11}
            zoom={1}
            height={5.5}
            fogDepth={30}
            detail="medium"
            brightness={1}
            opacity={1}
            grain
            grainIntensity={0.05}
            mouseInteraction
            parallaxStrength={0.5}
          />
        </div>
      )}

      <section className={styles.tarjeta}>
        <div className={styles.encabezado}>
          <Icon
            name="cerradura"
            size={40}
            className={styles.icono}
          />

          <h1>Recuperar contraseña</h1>

          <p>Sistema de gestión y control de reactivos</p>
        </div>

        {error && (
          <div
            className={styles.error}
            role="alert"
          >
            {error}
          </div>
        )}

        {paso === PASO.CORREO && (
          <form
            className={styles.formulario}
            onSubmit={manejarEnvioCorreo}
            noValidate
          >
            <div className={styles.grupo}>
              <label htmlFor="correo">Correo registrado</label>
              <input
                id="correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                autoComplete="email"
              />
            </div>
            <button type="submit" className={styles.boton} disabled={cargando}>Enviar código</button>
          </form>
        )}

        {paso === PASO.OTP && (
          <form
            className={styles.formulario}
            onSubmit={manejarValidacionOtp}
            noValidate
          >
            {mensaje && <p className={styles.info}>{mensaje}</p>}
            <div className={styles.grupo}>
              <label htmlFor="otp">Código de 6 dígitos</label>
              <input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
            <p className={styles.info}>El código vence 15 minutos después de haberlo solicitado.</p>
            <button type="submit" className={styles.boton} disabled={cargando}>Validar código</button>
          </form>
        )}

        {paso === PASO.NUEVA_CONTRASENA && (
          <form
            className={styles.formulario}
            onSubmit={manejarNuevaContrasena}
            noValidate
          >
            <div className={styles.grupo}>
              <label htmlFor="nuevaContrasena">Nueva contraseña</label>
              <PasswordField
                id="nuevaContrasena"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                autoComplete="new-password"
                aria-describedby="nuevaContrasena-ayuda"
              />
              <p id="nuevaContrasena-ayuda" className={styles.ayuda}>
                Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un carácter especial.
              </p>
            </div>
            <button type="submit" className={styles.boton} disabled={cargando}>Guardar nueva contraseña</button>
          </form>
        )}

        {paso === PASO.LISTO && (
          <>
            <p className={styles.exito}>{mensaje}</p>
            <Link to={paths.login} className={styles.boton}>
              Ir a iniciar sesión
            </Link>
          </>
        )}

        {paso !== PASO.LISTO && (
          <Link to={paths.login} className={styles.enlaceVolver}>
            Volver al inicio de sesión
          </Link>
        )}
      </section>
    </main>
  )
}

export default RecuperarContrasena
