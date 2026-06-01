import { useState } from 'react';
import { Lock, Mail, ArrowLeft, User, Loader2 } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

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
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (vista === 'register') {
        // 1. Crear el usuario en Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // 2. Actualizar el perfil inmediatamente en Auth para que el estado tenga el nombre disponible
        await updateProfile(userCredential.user, {
          displayName: nombre
        });

        // 3. Guardar en la base de datos de Firestore con el rol por defecto
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          uid: userCredential.user.uid,
          nombre: nombre,
          email: email,
          rol: 'colaborador'
        });

        setSuccess('Cuenta creada con éxito. Iniciando sesión...');
        setTimeout(() => {
          onLoginSuccess();
        }, 1500);

      } else if (vista === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El correo electrónico ya está en uso.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas. Inténtalo de nuevo.');
      } else {
        setError('Ocurrió un error inesperado. Inténtalo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }
    setError('');
    setSuccess('');
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Se ha enviado un correo para restablecer tu contraseña.');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No existe ningún usuario con este correo.');
      } else {
        setError('Error al enviar el correo de recuperación.');
      }
    } finally {
      setSendingReset(false);
    }
  };

  const cambiarVista = (nuevaVista: Vista) => {
    setError('');
    setSuccess('');
    setVista(nuevaVista);
  };

  if (vista === 'forgot') {
    return (
      <div className="login-container">
        <div className="login-card">
          <button type="button" onClick={() => cambiarVista('login')} className="btn-back-login">
            <ArrowLeft size={16} /> Volver al inicio
          </button>
          <h2>Recuperar Contraseña</h2>
          <p className="login-subtitle">Ingresa tu correo para enviarte un enlace de restablecimiento.</p>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleForgotPassword}>
            <div className="input-group">
              <label>Correo Electrónico</label>
              <div className="input-wrapper">
                <Mail size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={sendingReset}>
              {sendingReset ? <Loader2 className="spin-icon" size={20} /> : 'Enviar Enlace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{vista === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
        <p className="login-subtitle">
          {vista === 'register' ? 'Regístrate para acceder al sistema' : 'Ingresa tus credenciales para continuar'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {vista === 'register' && (
            <div className="input-group">
              <label>Nombre Completo</label>
              <div className="input-wrapper">
                <User size={18} />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Juan Pérez"
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
                placeholder="ejemplo@correo.com"
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="spin-icon" size={20} /> : (vista === 'register' ? 'Registrarse' : 'Iniciar Sesión')}
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