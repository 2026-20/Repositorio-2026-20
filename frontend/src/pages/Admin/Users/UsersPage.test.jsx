import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '../../../context/AuthContext'
import * as usuarioService from '../../../services/usuarioService'
import UsersPage from './UsersPage'

const TOKEN_DE_PRUEBA = 'token-de-prueba'

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
})
