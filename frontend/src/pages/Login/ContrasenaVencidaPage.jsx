import { useNavigate } from 'react-router-dom'
import FormularioCambioContrasena from '../../components/auth/FormularioCambioContrasena'
import { useAuth } from '../../context/useAuth'
import { paths } from '../../routes/paths'
import { cambiarContrasena } from '../../services/authService'
import styles from './ContrasenaVencidaPage.module.css'

// HU-049: pantalla obligatoria cuando la contraseña normal ha vencido.
// ProtectedRoute impide acceder al resto del sistema hasta realizar correctamente el cambio de contraseña.
export default function ContrasenaVencidaPage() {
    const {
        token,
        usuario,
        logout,
        marcarContrasenaCambiada,
    } = useAuth()

    const navigate = useNavigate()

    async function cambiarContrasenaVencida({
                                                contrasenaActual,
                                                contrasenaNueva,
                                            }) {
        await cambiarContrasena(
            token,
            contrasenaActual,
            contrasenaNueva,
        )

        marcarContrasenaCambiada()

        navigate(
            paths.dashboard,
            { replace: true },
        )
    }

    return (
        <main className={styles.pagina}>
            <section className={styles.tarjeta}>
                <h1>Contraseña vencida</h1>

                <p className={styles.descripcion}>
                    {usuario?.nombreCompleto
                        ? `${usuario.nombreCompleto}, `
                        : ''}
                    su contraseña ha vencido. Debe cambiarla antes de continuar.
                </p>

                <FormularioCambioContrasena
                    requiereContrasenaActual
                    etiquetaEnvio="Guardar y continuar"
                    onEnviar={cambiarContrasenaVencida}
                />

                <button
                    className={styles.cerrarSesion}
                    type="button"
                    onClick={logout}
                >
                    Cerrar sesión
                </button>
            </section>
        </main>
    )
}
