import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '../../../components/feedback/ConfirmDialog'
import { useAuth } from '../../../context/useAuth'
import { crearUsuario, desbloquearUsuario, inactivarUsuario, listarRoles, listarUsuarios } from '../../../services/usuarioService'
import { obtenerEmpresas } from '../../../services/authService'
import styles from './UsersPage.module.css'

const EXPRESION_CORREO_BASICA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function UsersPage() {
    const { token, usuario } = useAuth()

    const [usuarios, setUsuarios] = useState([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [mensajeExito, setMensajeExito] = useState('')

    const [usuarioAInactivar, setUsuarioAInactivar] = useState(null)
    const [motivo, setMotivo] = useState('')
    const [inactivando, setInactivando] = useState(false)
    const [desbloqueandoId, setDesbloqueandoId] = useState(null)

    const [mostrarCrear, setMostrarCrear] = useState(false)
    const [creando, setCreando] = useState(false)
    const [errorCrear, setErrorCrear] = useState('')
    const [cargandoOpciones, setCargandoOpciones] = useState(false)
    const [roles, setRoles] = useState([])
    const [empresas, setEmpresas] = useState([])
    const [nombreCompleto, setNombreCompleto] = useState('')
    const [cedula, setCedula] = useState('')
    const [correo, setCorreo] = useState('')
    const [username, setUsername] = useState('')
    const [rolId, setRolId] = useState('')
    const [empresaId, setEmpresaId] = useState('')

    const cargarUsuarios = useCallback(async () => {
        try {
            setCargando(true)
            setError('')
            const datos = await listarUsuarios(token)
            setUsuarios(datos)
        } catch {
            setError('No fue posible cargar el listado de usuarios.')
        } finally {
            setCargando(false)
        }
    }, [token])

    useEffect(() => {
        cargarUsuarios()
    }, [cargarUsuarios])

    // Temporal (ver LoginPage): si un Administrador llega aqui recien logueado,
    // se le abre el formulario de alta de una vez en lugar de que tenga que
    // hacer clic en "Crear usuario".
    useEffect(() => {
        if (usuario?.rol === 'Administrador') {
            abrirFormularioCrear()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    async function abrirFormularioCrear() {
        setMostrarCrear(true)
        setErrorCrear('')
        setMensajeExito('')
        setNombreCompleto('')
        setCedula('')
        setCorreo('')
        setUsername('')
        setRolId('')
        setEmpresaId('')

        try {
            setCargandoOpciones(true)
            const [rolesDatos, empresasDatos] = await Promise.all([
                listarRoles(token),
                obtenerEmpresas(),
            ])
            setRoles(rolesDatos)
            setEmpresas(empresasDatos)
        } catch {
            setErrorCrear('No fue posible cargar los roles y empresas disponibles.')
        } finally {
            setCargandoOpciones(false)
        }
    }

    function cerrarFormularioCrear() {
        if (creando) return
        setMostrarCrear(false)
    }

    async function confirmarCreacion() {
        setErrorCrear('')

        if (
            !nombreCompleto.trim() ||
            !cedula.trim() ||
            !correo.trim() ||
            !username.trim() ||
            !rolId ||
            !empresaId
        ) {
            setErrorCrear('Debe completar todos los campos.')
            return
        }

        if (!EXPRESION_CORREO_BASICA.test(correo.trim())) {
            setErrorCrear('Ingrese un correo electrónico válido.')
            return
        }

        try {
            setCreando(true)

            const usuarioCreado = await crearUsuario(token, {
                nombreCompleto: nombreCompleto.trim(),
                cedula: cedula.trim(),
                correo: correo.trim(),
                username: username.trim(),
                rolId: Number(rolId),
                empresaId: Number(empresaId),
            })

            setUsuarios((actual) => [...actual, usuarioCreado])
            setMostrarCrear(false)
            setMensajeExito(
                `Se creó la cuenta de ${usuarioCreado.nombreCompleto} y se envió un correo con las credenciales de acceso.`,
            )
        } catch (err) {
            if (err.codigo === 'USUARIO_DUPLICADO') {
                setErrorCrear(err.message || 'Ya existe un usuario con esos datos.')
            } else {
                setErrorCrear('No fue posible crear el usuario. Intente nuevamente.')
            }
        } finally {
            setCreando(false)
        }
    }

    function abrirConfirmacion(usuario) {
        setUsuarioAInactivar(usuario)
        setMotivo('')
    }

    function cerrarConfirmacion() {
        if (inactivando) return
        setUsuarioAInactivar(null)
        setMotivo('')
    }

    async function confirmarInactivacion() {
        try {
            setInactivando(true)

            const actualizado = await inactivarUsuario(
                token,
                usuarioAInactivar.id,
                motivo.trim(),
            )

            setUsuarios((actual) =>
                actual.map((usuario) =>
                    usuario.id === actualizado.id ? actualizado : usuario,
                ),
            )

            setUsuarioAInactivar(null)
            setMotivo('')
        } catch {
            setError('No fue posible inactivar al usuario. Intente nuevamente.')
        } finally {
            setInactivando(false)
        }
    }

    async function desbloquear(usuario) {
        try {
            setDesbloqueandoId(usuario.id)
            setError('')

            const actualizado = await desbloquearUsuario(
                token,
                usuario.id,
            )

            setUsuarios((actual) =>
                actual.map((item) =>
                    item.id === actualizado.id
                        ? actualizado
                        : item,
                ),
            )
        } catch {
            setError(
                'No fue posible desbloquear al usuario. Intente nuevamente.',
            )
        } finally {
            setDesbloqueandoId(null)
        }
    }

    return (
        <main className={styles.pagina}>
            <h1>Usuarios</h1>

            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

            {mensajeExito && (
                <div className={styles.exito} role="status">
                    {mensajeExito}
                </div>
            )}

            <div className={styles.acciones}>
                <button
                    type="button"
                    className={styles.botonCrear}
                    onClick={abrirFormularioCrear}
                >
                    Crear usuario
                </button>
            </div>

            {cargando ? (
                <p>Cargando usuarios...</p>
            ) : (
                <table className={styles.tabla}>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Usuario</th>
                            <th>Rol</th>
                            <th>Estado</th>
                            <th aria-label="Acciones" />
                        </tr>
                    </thead>

                    <tbody>
                        {usuarios.map((usuario) => (
                            <tr key={usuario.id}>
                                <td>{usuario.nombreCompleto}</td>
                                <td>{usuario.username}</td>
                                <td>{usuario.rol}</td>
                                <td>
                                    <span
                                        className={
                                            usuario.estado === 'INACTIVO'
                                                ? styles.estadoInactivo
                                                : styles.estadoActivo
                                        }
                                    >
                                        {usuario.bloqueado
                                            ? 'BLOQUEADO'
                                            : usuario.estado}
                                    </span>
                                </td>
                                <td>
                                    {usuario.bloqueado
                                        && usuario.estado !== 'INACTIVO' && (
                                            <button
                                                type="button"
                                                className={styles.botonDesbloquear}
                                                onClick={() => desbloquear(usuario)}
                                                disabled={desbloqueandoId === usuario.id}
                                            >
                                                {desbloqueandoId === usuario.id
                                                    ? 'Desbloqueando...'
                                                    : 'Desbloquear'}
                                            </button>
                                        )}

                                    {usuario.estado !== 'INACTIVO' && (
                                        <button
                                            type="button"
                                            className={styles.botonInactivar}
                                            onClick={() => abrirConfirmacion(usuario)}
                                        >
                                            Inactivar
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {usuarioAInactivar && (
                <ConfirmDialog
                    titulo="Inactivar usuario"
                    confirmando={inactivando}
                    textoConfirmar="Inactivar"
                    variante="peligro"
                    onConfirmar={confirmarInactivacion}
                    onCancelar={cerrarConfirmacion}
                >
                    <p>
                        ¿Está seguro de que desea inactivar a{' '}
                        <strong>{usuarioAInactivar.nombreCompleto}</strong> (usuario{' '}
                        <strong>{usuarioAInactivar.username}</strong>)?
                    </p>

                    <p>
                        Se cerrará su sesión activa de inmediato y no podrá volver a
                        iniciar sesión hasta que se reactive su cuenta.
                    </p>

                    <label htmlFor="motivo-inactivacion">Motivo (opcional)</label>

                    <textarea
                        id="motivo-inactivacion"
                        className={styles.motivo}
                        value={motivo}
                        onChange={(event) => setMotivo(event.target.value)}
                        disabled={inactivando}
                        rows={3}
                    />
                </ConfirmDialog>
            )}

            {mostrarCrear && (
                <ConfirmDialog
                    titulo="Crear usuario"
                    confirmando={creando}
                    textoConfirmar="Crear usuario"
                    variante="primaria"
                    onConfirmar={confirmarCreacion}
                    onCancelar={cerrarFormularioCrear}
                >
                    {errorCrear && (
                        <div className={styles.error} role="alert">
                            {errorCrear}
                        </div>
                    )}

                    <div className={styles.grupo}>
                        <label htmlFor="crear-nombre-completo">Nombre completo</label>
                        <input
                            id="crear-nombre-completo"
                            type="text"
                            className={styles.campo}
                            value={nombreCompleto}
                            onChange={(event) => setNombreCompleto(event.target.value)}
                            disabled={creando}
                        />
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="crear-cedula">Cédula</label>
                        <input
                            id="crear-cedula"
                            type="text"
                            className={styles.campo}
                            value={cedula}
                            onChange={(event) => setCedula(event.target.value)}
                            disabled={creando}
                        />
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="crear-correo">Correo electrónico</label>
                        <input
                            id="crear-correo"
                            type="email"
                            className={styles.campo}
                            value={correo}
                            onChange={(event) => setCorreo(event.target.value)}
                            disabled={creando}
                        />
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="crear-username">Username</label>
                        <input
                            id="crear-username"
                            type="text"
                            className={styles.campo}
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            disabled={creando}
                        />
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="crear-rol">Rol</label>
                        <select
                            id="crear-rol"
                            className={styles.campo}
                            value={rolId}
                            onChange={(event) => setRolId(event.target.value)}
                            disabled={creando || cargandoOpciones}
                        >
                            <option value="">
                                {cargandoOpciones ? 'Cargando roles...' : 'Seleccione un rol'}
                            </option>

                            {roles.map((rol) => (
                                <option key={rol.id} value={rol.id}>
                                    {rol.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.grupo}>
                        <label htmlFor="crear-empresa">Empresa</label>
                        <select
                            id="crear-empresa"
                            className={styles.campo}
                            value={empresaId}
                            onChange={(event) => setEmpresaId(event.target.value)}
                            disabled={creando || cargandoOpciones}
                        >
                            <option value="">
                                {cargandoOpciones ? 'Cargando empresas...' : 'Seleccione una empresa'}
                            </option>

                            {empresas.map((empresa) => (
                                <option key={empresa.id} value={empresa.id}>
                                    {empresa.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* El backend genera la contraseña temporal y la envia por correo
                        (HU-047) -- este formulario no la pide ni la muestra en ningun campo. */}
                </ConfirmDialog>
            )}
        </main>
    )
}
