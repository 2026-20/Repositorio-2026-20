import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FormularioCambioContrasena from '../../components/auth/FormularioCambioContrasena'
import FormularioBorrarAuditoriaLocal from '../../components/feedback/FormularioBorrarAuditoriaLocal'
import Modal from '../../components/feedback/Modal'
import Icon from '../../components/ui/Icon'
import { useAuth } from '../../context/useAuth'
import { useSincronizacion } from '../../context/useSincronizacion'
import { useConectividad } from '../../hooks/useConectividad'
import { useTheme } from '../../hooks/useTheme'
import { paths } from '../../routes/paths'
import { cambiarContrasena } from '../../services/authService'
import { borrarConteosLocales } from '../../storage/conteosPendientesRepositorio.js'
import { borrarCatalogoLocal } from '../../storage/datosMaestrosRepositorio.js'
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
    // Optional chaining: las pruebas existentes de esta pantalla no envuelven
    // con SincronizacionProvider (no lo necesitaban antes de esto) -- en la
    // app real (ver main.jsx) siempre esta montado.
    const { olvidarSincronizacion } = useSincronizacion() ?? {}
    const enLinea = useConectividad()
    const [perfil, setPerfil] = useState(null)
    const [cargandoPerfil, setCargandoPerfil] = useState(true)
    const [errorPerfil, setErrorPerfil] = useState('')
    const [perfilSinConexion, setPerfilSinConexion] = useState(false)
    const [mostrarCambioContrasena, setMostrarCambioContrasena] = useState(false)
    const [mostrarBorrarAuditoria, setMostrarBorrarAuditoria] = useState(false)

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

    // Borra el catalogo (bodegas/articulos/lotes/ruta) y los conteos locales
    // de este usuario en este dispositivo -- los dos archivos por separado
    // (ver borrarCatalogoLocal/borrarConteosLocales), uno despues del otro.
    // olvidarSincronizacion() pone ultimaSincronizacion en null en el
    // contexto compartido para que MiRutaPage/ConteoPage, que ya dependen de
    // ese valor para releer su estado local, lo noten sin recargar la
    // pagina.
    async function manejarBorrarAuditoriaLocal() {
        await borrarCatalogoLocal(usuario.id)
        await borrarConteosLocales(usuario.id)
        olvidarSincronizacion?.()

        setTimeout(() => setMostrarBorrarAuditoria(false), MS_ANTES_DE_CERRAR_TRAS_EXITO)
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
                <h2 className={styles.tituloSeccion}>Trazabilidad</h2>

                <p className={styles.descripcion}>
                    Consultá el registro de acciones realizadas: inicio de sesión, conteos
                    registrados y las demás que se vayan agregando.
                </p>

                <Link to={paths.trazabilidad} className={styles.botonAbrirModal}>
                    Ver registro de trazabilidad
                </Link>
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

            <section className={styles.seccion}>
                <h2 className={styles.tituloSeccion}>Borrar auditoría cargada</h2>

                <p className={styles.descripcion}>
                    Borra la ruta, las bodegas, los artículos y los conteos guardados en este dispositivo. Útil si
                    algo quedó mal localmente y preferís empezar de cero — vas a necesitar que un administrador
                    genere la auditoría de nuevo antes de poder contar otra vez.
                </p>

                <button
                    type="button"
                    className={styles.botonPeligro}
                    onClick={() => setMostrarBorrarAuditoria(true)}
                >
                    Borrar datos locales
                </button>
            </section>

            {mostrarBorrarAuditoria && (
                <Modal titulo="Borrar auditoría cargada" onCerrar={() => setMostrarBorrarAuditoria(false)}>
                    <FormularioBorrarAuditoriaLocal
                        onConfirmar={manejarBorrarAuditoriaLocal}
                        onCancelar={() => setMostrarBorrarAuditoria(false)}
                    />
                </Modal>
            )}

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
