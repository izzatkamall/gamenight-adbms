import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Navbar from './components/layout/Navbar'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Landing    from './pages/Landing'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import Profile    from './pages/Profile'
import Library    from './pages/Library'
import CreateRoom from './pages/CreateRoom'
import JoinRoom   from './pages/JoinRoom'
import RoomLobby  from './pages/RoomLobby'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/"              element={<Landing />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/register"      element={<Register />} />
          <Route path="/dashboard"     element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile"       element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/library"       element={<ProtectedRoute><Library /></ProtectedRoute>} />
          <Route path="/rooms/create"  element={<ProtectedRoute><CreateRoom /></ProtectedRoute>} />
          <Route path="/rooms/join"    element={<ProtectedRoute><JoinRoom /></ProtectedRoute>} />
          <Route path="/rooms/:id"     element={<ProtectedRoute><RoomLobby /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
