import { useState } from 'react';
import { Lock, Mail, ArrowLeft, User } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth';
import { auth } from './firebase';

interface LoginProps {
  onLoginSuccess: () => void;
}

type Vista = 'login' | 'register' | 'forgot';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vista, setVista] = useState<Vista>('login');
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (vista === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: nombre.trim() });
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('📧 Se ha enviado un enlace de recuperación a tu correo electrónico.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No existe una cuenta con este correo electrónico.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo electrónico ingresado no es válido.');
      } else {
        setError('Ocurrió un error al enviar el correo. Inténtalo de nuevo.');
      }
    } finally {
      setSendingReset(false);
    }
  };

  const cambiarVista = (nuevaVista: Vista) => {
    setVista(nuevaVista);
    setError('');
    setSuccess('');
  };

  // --- VISTA DE RECUPERAR CONTRASEÑA ---
  if (vista === 'forgot') {
    return (
      <div className="login-page">
        <div className="login-card">
          <h2>Recuperar Contraseña</h2>
          <p className="subtitle">
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          <form onSubmit={handlePasswordReset} className="login-form">
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

            <button type="submit" className="btn-primary" disabled={sendingReset}>
              {sendingReset ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => cambiarVista('login')}
              className="btn-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Volver a Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA DE LOGIN / REGISTRO ---
  return (
    <div className="login-page">
      <div className="login-card">
        <h2>Sistema de Gestión</h2>
        <p className="subtitle">
          {vista === 'register' ? 'Crea una cuenta nueva' : 'Ingresa tus credenciales para continuar'}
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {vista === 'register' && (
            <div className="input-group">
              <label>Nombre de Usuario</label>
              <div className="input-wrapper">
                <User size={18} />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Tu nombre"
                  required
                />
              </div>
            </div>
          )}

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

          {vista === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-8px' }}>
              <button
                type="button"
                onClick={() => cambiarVista('forgot')}
                className="btn-link"
                style={{ fontSize: '13px' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" className="btn-primary">
            {vista === 'register' ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            onClick={() => cambiarVista(vista === 'register' ? 'login' : 'register')}
            className="btn-link"
          >
            {vista === 'register' ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}