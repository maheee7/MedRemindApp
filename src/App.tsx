import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import RoleSelectionPage from './pages/RoleSelectionPage'
import AddMedicationPage from './pages/AddMedicationPage'
import PatientDashboardPage from './pages/PatientDashboardPage'
import CaretakerDashboardPage from './pages/CaretakerDashboardPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/role-selection" element={<RoleSelectionPage />} />
      <Route path="/add-medication" element={<AddMedicationPage />} />
      <Route path="/patient-dashboard" element={<PatientDashboardPage />} />
      <Route path="/caretaker-dashboard" element={<CaretakerDashboardPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App


