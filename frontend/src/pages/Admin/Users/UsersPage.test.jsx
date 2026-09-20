import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../../context/AuthContext'
import * as authService from '../../../services/authService'
import * as usuarioService from '../../../services/usuarioService'
import UsersPage from './UsersPage'

const TOKEN_DE_PRUEBA = 'token-de-prueba'

const roles = [
    { id: 10, nombre: 'Usuario de Campo' },
    { id: 20, nombre: 'Administrador' },
]

const empresasDisponibles = [
    { id: 1, nombre: 'CAPRIS Médica' },
    { id: 2, nombre: 'Diagnostika' },
]

function renderUsersPage() {
    return render(
        <AuthContext.Provider value={{ token: TOKEN_DE_PRUEBA }}>
            <UsersPage />
        </AuthContext.Provider>,
    )
}

const usuarios = [
    {
        id: 1,
        nombreCompleto: 'Andrey Meléndez Ovares',
        correo: 'amelendez@capris.co.cr',
        username: 'amelendez',
        rol: 'Usuario de Campo',
        empresa: 'CAPRIS Médica',
        estado: 'ACTIVO',
    },
    {
        id: 2,
        nombreCompleto: 'Adrián Arce Soto',
        correo: 'arcea@capris.cr',
        username: 'arcea',
        rol: 'Usuario de Campo',
        empresa: 'CAPRIS Médica',
        estado: 'INACTIVO',
    },
]

describe('UsersPage', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('lista los usuarios obtenidos del backend', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)

        renderUsersPage()

        expect(await screen.findByText('Andrey Meléndez Ovares')).toBeInTheDocument()
        expect(screen.getByText('Adrián Arce Soto')).toBeInTheDocument()
    })

    it('no muestra el boton de inactivar para un usuario ya inactivo', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')

        expect(screen.getAllByRole('button', { name: 'Inactivar' })).toHaveLength(1)
    })

    it('pide confirmacion mostrando nombre y username antes de inactivar', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')

        fireEvent.click(screen.getByRole('button', { name: 'Inactivar' }))

        const dialogo = screen.getByRole('alertdialog')

        expect(dialogo).toHaveTextContent('Andrey Meléndez Ovares')
        expect(dialogo).toHaveTextContent('amelendez')
    })

    it('cancela sin llamar al backend', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        const inactivarSpy = vi.spyOn(usuarioService, 'inactivarUsuario')

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Inactivar' }))
        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(inactivarSpy).not.toHaveBeenCalled()
    })

    it('confirma la inactivacion y actualiza el estado en la tabla', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'inactivarUsuario').mockResolvedValue({
            ...usuarios[0],
            estado: 'INACTIVO',
        })

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Inactivar' }))

        const dialogo = screen.getByRole('alertdialog')
        fireEvent.click(within(dialogo).getByRole('button', { name: 'Inactivar' }))

        await waitFor(() => {
            expect(usuarioService.inactivarUsuario).toHaveBeenCalledWith(
                TOKEN_DE_PRUEBA,
                1,
                '',
            )
        })

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(screen.getAllByText('INACTIVO')).toHaveLength(2)
    })

    it('muestra un error si falla la carga inicial', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockRejectedValue(new Error('falla'))

        renderUsersPage()

        expect(
            await screen.findByText('No fue posible cargar el listado de usuarios.'),
        ).toBeInTheDocument()
    })

    it('muestra Reactivar en vez de Inactivar para un usuario inactivo', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')

        expect(screen.getAllByRole('button', { name: 'Reactivar' })).toHaveLength(1)
        expect(screen.getAllByRole('button', { name: 'Inactivar' })).toHaveLength(1)
    })

    it('reactiva un usuario y actualiza el estado en la tabla', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'reactivarUsuario').mockResolvedValue({
            ...usuarios[1],
            estado: 'ACTIVO',
        })

        renderUsersPage()

        await screen.findByText('Adrián Arce Soto')
        fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }))

        await waitFor(() => {
            expect(usuarioService.reactivarUsuario).toHaveBeenCalledWith(
                TOKEN_DE_PRUEBA,
                2,
            )
        })

        expect(screen.getAllByText('ACTIVO')).toHaveLength(2)
    })

    it('permite desbloquear una cuenta bloqueada desde el panel', async () => {
        const usuarioBloqueado = {...usuarios[0], bloqueado: true, bloqueadoHasta: '2026-09-16T21:00:00Z',
        }

        vi.spyOn(usuarioService, 'listarUsuarios',).mockResolvedValue([usuarioBloqueado,])
        vi.spyOn(usuarioService, 'desbloquearUsuario',).mockResolvedValue({...usuarioBloqueado, bloqueado: false, bloqueadoHasta: null,})

        renderUsersPage()

        await screen.findByText('BLOQUEADO')

        fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' },),)

        await waitFor(() => {
            expect(usuarioService.desbloquearUsuario,).toHaveBeenCalledWith(TOKEN_DE_PRUEBA, 1,)
        })

        expect(screen.queryByText('BLOQUEADO'),).not.toBeInTheDocument()
    })

    it('abre el formulario de creacion y carga roles y empresas', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'listarRoles').mockResolvedValue(roles)
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue(empresasDisponibles)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

        const dialogo = await screen.findByRole('alertdialog')
        expect(within(dialogo).getByRole('heading', { name: 'Crear usuario' })).toBeInTheDocument()

        await waitFor(() => {
            expect(within(dialogo).getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
        })
        expect(within(dialogo).getByRole('option', { name: 'Diagnostika' })).toBeInTheDocument()
    })

    it('no llama a crearUsuario si el formulario esta incompleto', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'listarRoles').mockResolvedValue(roles)
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue(empresasDisponibles)
        const crearSpy = vi.spyOn(usuarioService, 'crearUsuario')

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

        const dialogo = await screen.findByRole('alertdialog')
        await waitFor(() => {
            expect(within(dialogo).getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
        })

        fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }))

        expect(await within(dialogo).findByText('Debe completar todos los campos.')).toBeInTheDocument()
        expect(crearSpy).not.toHaveBeenCalled()
    })

    it('crea el usuario y lo agrega a la tabla sin recargar el listado', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'listarRoles').mockResolvedValue(roles)
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue(empresasDisponibles)

        const usuarioCreado = {
            id: 3,
            nombreCompleto: 'Persona Nueva',
            correo: 'persona.nueva@capris.co.cr',
            username: 'persona.nueva',
            rol: 'Usuario de Campo',
            empresa: 'CAPRIS Médica',
            estado: 'PENDIENTE_PRIMER_INGRESO',
        }
        vi.spyOn(usuarioService, 'crearUsuario').mockResolvedValue(usuarioCreado)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

        const dialogo = await screen.findByRole('alertdialog')
        await waitFor(() => {
            expect(within(dialogo).getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
        })

        fireEvent.change(within(dialogo).getByLabelText('Nombre completo'), { target: { value: 'Persona Nueva' } })
        fireEvent.change(within(dialogo).getByLabelText('Cédula'), { target: { value: '1-2345-6789' } })
        fireEvent.change(within(dialogo).getByLabelText('Correo electrónico'), { target: { value: 'persona.nueva@capris.co.cr' } })
        fireEvent.change(within(dialogo).getByLabelText('Username'), { target: { value: 'persona.nueva' } })
        fireEvent.change(within(dialogo).getByLabelText('Rol'), { target: { value: '10' } })
        fireEvent.change(within(dialogo).getByLabelText('Empresa'), { target: { value: '1' } })

        fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }))

        await waitFor(() => {
            expect(usuarioService.crearUsuario).toHaveBeenCalledWith(TOKEN_DE_PRUEBA, {
                nombreCompleto: 'Persona Nueva',
                cedula: '1-2345-6789',
                correo: 'persona.nueva@capris.co.cr',
                username: 'persona.nueva',
                rolId: 10,
                empresaId: 1,
            })
        })

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
        expect(screen.getByText('Persona Nueva')).toBeInTheDocument()
    })

    it('muestra el error de duplicado dentro del modal sin cerrarlo', async () => {
        vi.spyOn(usuarioService, 'listarUsuarios').mockResolvedValue(usuarios)
        vi.spyOn(usuarioService, 'listarRoles').mockResolvedValue(roles)
        vi.spyOn(authService, 'obtenerEmpresas').mockResolvedValue(empresasDisponibles)

        const errorDuplicado = new Error('Ya existe un usuario con ese correo')
        errorDuplicado.codigo = 'USUARIO_DUPLICADO'
        vi.spyOn(usuarioService, 'crearUsuario').mockRejectedValue(errorDuplicado)

        renderUsersPage()

        await screen.findByText('Andrey Meléndez Ovares')
        fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))

        const dialogo = await screen.findByRole('alertdialog')
        await waitFor(() => {
            expect(within(dialogo).getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
        })

        fireEvent.change(within(dialogo).getByLabelText('Nombre completo'), { target: { value: 'Persona Duplicada' } })
        fireEvent.change(within(dialogo).getByLabelText('Cédula'), { target: { value: '1-1111-1111' } })
        fireEvent.change(within(dialogo).getByLabelText('Correo electrónico'), { target: { value: 'wmolina@capris.cr' } })
        fireEvent.change(within(dialogo).getByLabelText('Username'), { target: { value: 'otra.persona' } })
        fireEvent.change(within(dialogo).getByLabelText('Rol'), { target: { value: '10' } })
        fireEvent.change(within(dialogo).getByLabelText('Empresa'), { target: { value: '1' } })

        fireEvent.click(within(dialogo).getByRole('button', { name: 'Crear usuario' }))

        expect(await within(dialogo).findByText('Ya existe un usuario con ese correo')).toBeInTheDocument()
        expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })
})
