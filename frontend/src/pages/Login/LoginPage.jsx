import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { obtenerEmpresas } from '../../services/authService'
import { useAuth } from '../../context/useAuth'
import { LOGOS_POR_EMPRESA } from '../../assets/logos'
import GradientWaves from '../../components/effects/GradientWaves'
import PasswordField from '../../components/ui/PasswordField'
import { usePrefiereMenosMovimiento } from '../../hooks/usePrefiereMenosMovimiento'
import { paths } from '../../routes/paths'
import styles from './LoginPage.module.css'

// Experimental: fondo animado detras de la tarjeta de acceso (ver
// components/effects/GradientWaves). Se omite con prefers-reduced-motion,
// igual que el resto de las animaciones del proyecto.
export default function LoginPage() {
    const { login, estaAutenticado } = useAuth()
    const prefiereMenosMovimiento = usePrefiereMenosMovimiento()

    const [username, setUsername] = useState('')
    const [contrasena, setContrasena] = useState('')
    const [empresaId, setEmpresaId] = useState('')
    const [empresas, setEmpresas] = useState([])

    const [cargandoEmpresas, setCargandoEmpresas] = useState(true)
    const [enviando, setEnviando] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        async function cargarEmpresas() {
            try {
                const datos = await obtenerEmpresas()
                setEmpresas(datos)

                if (datos.length === 1) {
                    setEmpresaId(String(datos[0].id))
                }
            } catch {
                setError(
                    'No fue posible cargar las empresas disponibles. Intente nuevamente.',
                )
            } finally {
                setCargandoEmpresas(false)
            }
        }

        cargarEmpresas()
    }, [])

    const empresaSeleccionada = empresas.find(
        (empresa) => String(empresa.id) === empresaId,
    )

    const logoEmpresaSeleccionada = empresaSeleccionada
        ? LOGOS_POR_EMPRESA[empresaSeleccionada.nombre]
        : undefined

    async function manejarSubmit(event) {
        event.preventDefault()
        setError('')

        if (!username.trim() || !contrasena || !empresaId) {
            setError('Debe completar todos los campos.')
            return
        }

        try {
            setEnviando(true)

            await login(
                username.trim(),
                contrasena,
                empresaId,
            )
        } catch (err) {
            if (err.codigo === 'CUENTA_BLOQUEADA') {
                setError('La cuenta se encuentra temporalmente bloqueada.')
            } else {
                setError(
                    err.message || 'Usuario, contraseña o empresa incorrectos.',
                )
            }
        } finally {
            setEnviando(false)
        }
    }

    if (estaAutenticado) {
        return <Navigate to={paths.dashboard} replace />
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
                    {logoEmpresaSeleccionada ? (
                        <img
                            src={logoEmpresaSeleccionada}
                            alt={`Logo de ${empresaSeleccionada?.nombre ?? 'la empresa seleccionada'}`}
                            className={styles.logo}
                        />
                    ) : (
                        <h1>Iniciar sesión</h1>
                    )}

                    <p>Sistema de gestión y control de reactivos</p>
                </div>

                <form
                    className={styles.formulario}
                    onSubmit={manejarSubmit}
                    noValidate
                >
                    <div className={styles.grupo}>
                        <label htmlFor="empresa">
                            Empresa
                        </label>

                        <select
                            id="empresa"
                            value={empresaId}
                            onChange={(event) =>
                                setEmpresaId(event.target.value)
                            }
                            disabled={cargandoEmpresas || enviando}
                        >
                            <option value="">
                                {cargandoEmpresas
                                    ? 'Cargando empresas...'
                                    : 'Seleccione una empresa'}
                            </option>

                            {empresas.map((empresa) => (
                                <option
                                    key={empresa.id}
                                    value={empresa.id}
                                >
                                    {empresa.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="username">
                            Usuario
                        </label>

                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value)
                            }
                            autoComplete="username"
                            disabled={enviando}
                        />
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="contrasena">
                            Contraseña
                        </label>

                        <PasswordField
                            id="contrasena"
                            value={contrasena}
                            onChange={(event) =>
                                setContrasena(event.target.value)
                            }
                            autoComplete="current-password"
                            disabled={enviando}
                        />
                    </div>

                    {error && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <button
                        className={styles.boton}
                        type="submit"
                        disabled={
                            enviando ||
                            cargandoEmpresas
                        }
                    >
                        {enviando
                            ? 'Iniciando sesión...'
                            : 'Iniciar sesión'}
                    </button>

                    <Link
                        className={styles.enlaceRecuperacion}
                        to={paths.recuperarContrasena}
                    >
                        ¿Olvidaste tu contraseña?
                    </Link>
                </form>
            </section>
        </main>
    )
}