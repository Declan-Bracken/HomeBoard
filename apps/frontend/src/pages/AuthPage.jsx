import AuthForm from '../components/auth/AuthForm'

function AuthPage({ onLogin }) {
  return <AuthForm onLogin={onLogin} />
}

export default AuthPage
