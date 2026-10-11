import { BrowserRouter } from 'react-router-dom'
import ActualizacionDisponible from './components/feedback/ActualizacionDisponible'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
      <BrowserRouter>
        <AppRoutes />
        <ActualizacionDisponible />
      </BrowserRouter>
  )
}
