import { useEffect, useState } from 'react'
import ConfirmDialog from '../../../components/feedback/ConfirmDialog'
import { inactivarUsuario, listarUsuarios } from '../../../services/usuarioService'
import styles from './UsersPage.module.css'

export default function UsersPage() {
    const [usuarios, setUsuarios] = useState([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    const [usuarioAInactivar, setUsuarioAInactivar] = useState(null)
    const [motivo, setMotivo] = useState('')
    const [inactivando, setInactivando] = useState(false)

    async function cargarUsuarios() {
        try {
            setCargando(true)
            setError('')
            const datos = await listarUsuarios()
            setUsuarios(datos)
        } catch {
            setError('No fue posible cargar el listado de usuarios.')
        } finally {
            setCargando(false)
        }
    }

    useEffect(() => {
        cargarUsuarios()
    }, [])

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

    return (
        <main className={styles.pagina}>
            <h1>Usuarios</h1>

            {error && (
                <div className={styles.error} role="alert">
                    {error}
                </div>
            )}

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
                                        {usuario.estado}
                                    </span>
                                </td>
                                <td>
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
        </main>
    )
}
