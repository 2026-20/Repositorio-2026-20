import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute({ children }) {
    const { estaAutenticado } = useAuth()

    if (!estaAutenticado) {
        return <Navigate to="/login" replace />
    }

    return children
}
