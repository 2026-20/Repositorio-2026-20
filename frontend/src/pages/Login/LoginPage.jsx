import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { obtenerEmpresas } from '../../services/authService'
import { useAuth } from '../../context/useAuth'
import { LOGOS_POR_EMPRESA } from '../../assets/logos'
import styles from './LoginPage.module.css'

export default function LoginPage() {
    const { login, estaAutenticado } = useAuth()

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
        return <Navigate to="/dashboard" replace />
    }

    return (
        <main className={styles.pagina}>
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

                        <input
                            id="contrasena"
                            type="password"
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

                    <a
                        className={styles.enlaceRecuperacion}
                        href="/recuperar-contrasena"
                    >
                        ¿Olvidaste tu contraseña?
                    </a>
                </form>
            </section>
        </main>
    )
}