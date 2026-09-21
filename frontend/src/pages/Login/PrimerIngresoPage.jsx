import { useNavigate } from 'react-router-dom'
import FormularioCambioContrasena from '../../components/auth/FormularioCambioContrasena'
import { useAuth } from '../../context/useAuth'
import { paths } from '../../routes/paths'
import { cambiarContrasenaPrimerIngreso } from '../../services/authService'
import styles from './PrimerIngresoPage.module.css'

// HU-044: pantalla obligatoria mientras la cuenta siga con contraseña
// temporal (PENDIENTE_PRIMER_INGRESO), sin importar el rol. ProtectedRoute
// no deja entrar a ninguna otra ruta; el limite real lo aplica el backend.
export default function PrimerIngresoPage() {
    const { token, usuario, logout, marcarContrasenaCambiada } = useAuth()
    const navigate = useNavigate()

    async function cambiarContrasena({ contrasenaNueva }) {
        await cambiarContrasenaPrimerIngreso(token, contrasenaNueva)

        marcarContrasenaCambiada()
        navigate(paths.dashboard, { replace: true })
    }

    return (
        <main className={styles.pagina}>
            <section className={styles.tarjeta}>
                <h1>Cambie su contraseña</h1>

                <p className={styles.descripcion}>
                    {usuario?.nombreCompleto ? `${usuario.nombreCompleto}, ` : ''}
                    su cuenta usa una contraseña temporal. Debe definir una
                    contraseña propia antes de continuar.
                </p>

                <FormularioCambioContrasena
                    etiquetaEnvio="Guardar y continuar"
                    onEnviar={cambiarContrasena}
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
