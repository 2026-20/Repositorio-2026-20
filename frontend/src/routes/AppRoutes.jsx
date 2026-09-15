import {
    Navigate,
    Route,
    Routes,
} from 'react-router-dom'

import AppLayout from '../components/layout/AppLayout'
import DashboardPage from '../pages/Dashboard/DashboardPage'
import LoginPage from '../pages/Login/LoginPage'
import ProtectedRoute from './ProtectedRoute'

export default function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/login"
                element={<LoginPage />}
            />

            <Route
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