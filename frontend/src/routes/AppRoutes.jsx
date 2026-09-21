import {
    Navigate,
    Route,
    Routes,
} from 'react-router-dom'

import AppLayout from '../components/layout/AppLayout'
import AjustesPage from '../pages/Settings/AjustesPage'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import LoginPage from '../pages/Login/LoginPage'
import PrimerIngresoPage from '../pages/Login/PrimerIngresoPage'
import RecuperarContrasena from '../pages/recuperacionContrasena/RecuperarContrasena'
import UsersPage from '../pages/Admin/Users/UsersPage'
import ProtectedRoute from './ProtectedRoute'
import { paths } from './paths'

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path={paths.login}
                element={<LoginPage />}
            />

            <Route
                path={paths.primerIngreso}
                element={
                    <ProtectedRoute>
                        <PrimerIngresoPage />
                    </ProtectedRoute>
                }
                path={paths.recuperarContrasena}
                element={<RecuperarContrasena />}
            />

            <Route
                element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    path={paths.dashboard}
                    element={<DashboardPage />}
                />

                <Route
                    path={paths.usuarios}
                    element={
                        <ProtectedRoute rolRequerido="Administrador">
                            <UsersPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path={paths.ajustes}
                    element={<AjustesPage />}
                />
            </Route>

            <Route
                path="*"
                element={
                    <Navigate
                        to={paths.login}
                        replace
                    />
                }
            />
        </Routes>
    )
}
