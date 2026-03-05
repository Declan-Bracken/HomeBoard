import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import WallPage from './pages/WallPage'
import WallDetailPage from './pages/WallDetailPage'
import RouteCreatePage from './pages/RouteCreatePage'
import RouteDetailPage from './pages/RouteDetailPage'
import ProfilePage from './pages/ProfilePage'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage onLogin={() => setToken(localStorage.getItem('token'))} />} />
      <Route path="/home" element={token ? <HomePage /> : <Navigate to="/auth" />} />
      <Route path="/walls/:id" element={token ? <WallPage /> : <Navigate to="/auth" />} />
      <Route path="/walls/:id/detail" element={token ? <WallDetailPage /> : <Navigate to="/auth" />} />
      <Route path="/walls/:id/route/new" element={token ? <RouteCreatePage /> : <Navigate to="/auth" />} />
      <Route path="/walls/:id/routes/:routeId" element={token ? <RouteDetailPage /> : <Navigate to="/auth" />} />
      <Route path="/profile" element={token ? <ProfilePage /> : <Navigate to="/auth" />} />
      <Route path="*" element={<Navigate to={token ? "/home" : "/auth"} />} />
    </Routes>
  )
}

export default App
