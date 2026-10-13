import { useEffect, useState } from 'react'
import FormularioCambioContrasena from '../../components/auth/FormularioCambioContrasena'
import Modal from '../../components/feedback/Modal'
import Icon from '../../components/ui/Icon'
import { useAuth } from '../../context/useAuth'
import { useConectividad } from '../../hooks/useConectividad'
import { useTheme } from '../../hooks/useTheme'
import { cambiarContrasena } from '../../services/authService'
import styles from './AjustesPage.module.css'
import { consultarPerfil } from '../../services/usuarioService'

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
    const { usuario, token } = useAuth()
    const enLinea = useConectividad()
    const [perfil, setPerfil] = useState(null)
    const [cargandoPerfil, setCargandoPerfil] = useState(true)
    const [errorPerfil, setErrorPerfil] = useState('')
    const [perfilSinConexion, setPerfilSinConexion] = useState(false)
    const [mostrarCambioContrasena, setMostrarCambioContrasena] = useState(false)

    useEffect(() => {
        let activo = true

        async function cargarPerfil() {
            try {
                const datos = await consultarPerfil(token)

                if (activo) {
                    setPerfil(datos)
                    setErrorPerfil('')
                    setPerfilSinConexion(false)
                }
            } catch (error) {
                if (!activo) return

                // Sin conexion no hay por que tratarlo como un error: el
                // nombre, correo, rol y empresa ya se guardaron en la sesion
                // al iniciar sesion (AuthProvider), asi que se muestran esos
                // en vez de un mensaje de fallo. Si la peticion falla
                // estando en linea, eso si es un error real (backend caido,
                // 500, etc).
                //
                // No basta con navigator.onLine (puede dar falso positivo:
                // wifi conectado pero sin salida real a internet -- ver
                // recuperacionService.js). Segunda barrera real: cuando
                // fetch() nunca recibe una respuesta, procesarRespuesta no
                // llega a fijar error.status (eso solo pasa ante un 4xx/5xx
                // real del backend).
                const sinConexionDeVerdad = !enLinea || error.status === undefined

                if (sinConexionDeVerdad && usuario) {
                    setPerfil({
                        nombreCompleto: usuario.nombreCompleto,
                        correo: usuario.correo,
                        rol: usuario.rol,
                        empresa: usuario.empresaNombre,
                    })
                    setErrorPerfil('')
                    setPerfilSinConexion(true)
                } else {
                    setErrorPerfil(error.message)
                    setPerfilSinConexion(false)
                }
            } finally {
                if (activo) {
                    setCargandoPerfil(false)
                }
            }
        }

        if (token) {
            cargarPerfil()
        } else {
            setCargandoPerfil(false)
        }

        return () => {
            activo = false
        }
    }, [token, enLinea, usuario])

    async function manejarCambioContrasena({ contrasenaActual, contrasenaNueva }) {
        await cambiarContrasena(token, contrasenaActual, contrasenaNueva)

        // Deja ver el mensaje de exito un momento antes de cerrar la ventana sola.
        setTimeout(() => setMostrarCambioContrasena(false), MS_ANTES_DE_CERRAR_TRAS_EXITO)
    }

    return (
        <main>
            <h1>Ajustes</h1>
            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>
                    Información del usuario
                </h2>

                {cargandoPerfil && (
                    <p className={styles.descripcion}>
                        Cargando información del perfil...
                    </p>
                )}

                {perfilSinConexion && (
                    <p className={styles.avisoSinConexion} role="status">
                        Sin conexión: se muestra la información guardada en este dispositivo.
                    </p>
                )}

                {errorPerfil && (
                    <p role="alert" className={styles.errorPerfil}>
                        {errorPerfil}
                    </p>
                )}

                {perfil && (
                    <div className={styles.tarjetaPerfil}>
                        <div className={styles.campoPerfil}>
                            <span>Nombre</span>
                            <strong>{perfil.nombreCompleto}</strong>
                        </div>

                        <div className={styles.campoPerfil}>
                            <span>Correo electrónico</span>
                            <strong>{perfil.correo}</strong>
                        </div>

                        <div className={styles.campoPerfil}>
                            <span>Rol</span>
                            <strong>{perfil.rol}</strong>
                        </div>

                        <div className={styles.campoPerfil}>
                            <span>Empresa activa</span>
                            <strong>{perfil.empresa}</strong>
                        </div>
                    </div>
                )}
            </section>
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
