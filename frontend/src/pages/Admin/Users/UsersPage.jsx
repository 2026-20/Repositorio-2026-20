import { useCallback, useEffect, useState } from 'react'
import ConfirmDialog from '../../../components/feedback/ConfirmDialog'
import { useAuth } from '../../../context/useAuth'
import {
    desbloquearUsuario,
    inactivarUsuario,
    listarUsuarios,
    reactivarUsuario,
} from '../../../services/usuarioService'
import styles from './UsersPage.module.css'

export default function UsersPage() {
    const { token } = useAuth()

    const [usuarios, setUsuarios] = useState([])
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')

    const [usuarioAInactivar, setUsuarioAInactivar] = useState(null)
    const [motivo, setMotivo] = useState('')
    const [inactivando, setInactivando] = useState(false)
    const [desbloqueandoId, setDesbloqueandoId] = useState(null)
    const [reactivandoId, setReactivandoId] = useState(null)

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

    async function reactivar(usuario) {
        try {
            setReactivandoId(usuario.id)
            setError('')

            const actualizado = await reactivarUsuario(
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
                'No fue posible reactivar al usuario. Intente nuevamente.',
            )
        } finally {
            setReactivandoId(null)
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
                                <td data-label="Nombre">{usuario.nombreCompleto}</td>
                                <td data-label="Usuario">{usuario.username}</td>
                                <td data-label="Rol">{usuario.rol}</td>
                                <td data-label="Estado">
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
                                <td className={styles.celdaAcciones}>
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

                                    {usuario.estado === 'INACTIVO' ? (
                                        <button
                                            type="button"
                                            className={styles.botonReactivar}
                                            onClick={() => reactivar(usuario)}
                                            disabled={reactivandoId === usuario.id}
                                        >
                                            {reactivandoId === usuario.id
                                                ? 'Reactivando...'
                                                : 'Reactivar'}
                                        </button>
                                    ) : (
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
