import { useAuth } from '../../context/useAuth'

export default function DashboardPage() {
    const { usuario } = useAuth()

    return (
        <main>
            <h1>Inicio</h1>

            <p>
                Sesión iniciada correctamente.
            </p>

            <p>
                Usuario: {usuario?.nombreCompleto}
            </p>

            <p>
                Rol: {usuario?.rol}
            </p>
        </main>
    )
}