import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onLoginSuccess();
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres');
      } else {
        setError('Ocurrió un error. Inténtalo de nuevo.');
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Sistema de Gestión</h2>
        <p className="subtitle">
          {isRegistering ? 'Crea una cuenta nueva' : 'Ingresa tus credenciales para continuar'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@ubiobio.cl"
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary">
            {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="btn-link"
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}