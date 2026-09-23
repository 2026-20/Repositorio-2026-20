import { useState } from 'react'
import FormularioCambioContrasena from '../../components/auth/FormularioCambioContrasena'
import Modal from '../../components/feedback/Modal'
import Icon from '../../components/ui/Icon'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { cambiarContrasena } from '../../services/authService'
import styles from './AjustesPage.module.css'

// Cuanto queda visible el mensaje de exito antes de cerrar la ventana sola.
const MS_ANTES_DE_CERRAR_TRAS_EXITO = 1500

const OPCIONES_APARIENCIA = [
    { valor: 'claro', etiqueta: 'Claro', icono: 'temaClaro' },
    { valor: 'oscuro', etiqueta: 'Oscuro', icono: 'temaOscuro' },
]

// HU-029 (#67): AC1/AC2 -- eleccion explicita de modo claro/oscuro desde una
// pantalla de apariencia, con aplicacion inmediata. Por decision de negocio
// no se ofrece "seguir al sistema" como opcion aqui (ver useTheme) -- ese
// valor solo se usa internamente antes de la primera eleccion (AC3). AC4 y
// AC6 (persistencia local, sin sincronizar con el backend) los cubre
// useTheme via localStorage, sin acciones adicionales en esta pantalla.
//
// HU-045 AC1: seccion para cambiar la contraseña voluntariamente (actual +
// nueva + confirmar). Las reglas de bloqueo por intentos fallidos y la
// bitacora (AC2/AC5) las aplica el backend.
export default function AjustesPage() {
    const { temaEfectivo, setTema } = useTheme()
    const { token } = useAuth()
    const [mostrarCambioContrasena, setMostrarCambioContrasena] = useState(false)

    async function manejarCambioContrasena({ contrasenaActual, contrasenaNueva }) {
        await cambiarContrasena(token, contrasenaActual, contrasenaNueva)

        // Deja ver el mensaje de exito un momento antes de cerrar la ventana sola.
        setTimeout(() => setMostrarCambioContrasena(false), MS_ANTES_DE_CERRAR_TRAS_EXITO)
    }

    return (
        <main>
            <h1>Ajustes</h1>

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Apariencia</h2>

                <p className={styles.descripcion}>
                    Elegí cómo se ve la aplicación en este dispositivo. La
                    preferencia se guarda solo aquí y no se comparte con otros
                    dispositivos donde inicies sesión.
                </p>

                <div
                    className={styles.opciones}
                    role="radiogroup"
                    aria-label="Modo de visualización"
                >
                    {OPCIONES_APARIENCIA.map((opcion) => (
                        <button
                            key={opcion.valor}
                            type="button"
                            role="radio"
                            aria-checked={temaEfectivo === opcion.valor}
                            className={`${styles.opcion} ${
                                temaEfectivo === opcion.valor ? styles.seleccionada : ''
                            }`}
                            onClick={() => setTema(opcion.valor)}
                        >
                            <Icon name={opcion.icono} size={24} />
                            {opcion.etiqueta}
                        </button>
                    ))}
                </div>
            </section>

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Contraseña</h2>

                <p className={styles.descripcion}>
                    Para cambiarla necesitás ingresar tu contraseña actual.
                </p>

                <button
                    type="button"
                    className={styles.botonAbrirModal}
                    onClick={() => setMostrarCambioContrasena(true)}
                >
                    Cambiar contraseña
                </button>
            </section>

            {mostrarCambioContrasena && (
                <Modal
                    titulo="Cambiar contraseña"
                    onCerrar={() => setMostrarCambioContrasena(false)}
                >
                    <FormularioCambioContrasena
                        requiereContrasenaActual
                        etiquetaEnvio="Guardar"
                        mensajeExito="La contraseña se cambió correctamente."
                        onEnviar={manejarCambioContrasena}
                    />
                </Modal>
            )}
        </main>
    )
}
