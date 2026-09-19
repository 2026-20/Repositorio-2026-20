import {
    Navigate,
    Route,
    Routes,
} from 'react-router-dom'

import AppLayout from '../components/layout/AppLayout'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import LoginPage from '../pages/Login/LoginPage'
import RecuperarContrasena from '../pages/recuperacionContrasena/RecuperarContrasena'
import UsersPage from '../pages/Admin/Users/UsersPage'
import ProtectedRoute from './ProtectedRoute'

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/login"
                element={<LoginPage />}
            />

<Route
                path="/recuperar-contrasena"
                element={<RecuperarContrasena />}
            />

            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    path="/dashboard"
                    element={<DashboardPage />}
                />

                <Route
                    path="/admin/usuarios"
                    element={<UsersPage />}
                />
            </Route>

            <Route
                path="*"
                element={
                    <Navigate
                        to="/login"
                        replace
                    />
                }
            />
        </Routes>
    )
}