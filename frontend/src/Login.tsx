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
    setLoading(true);

    try {
      if (vista === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Se actualiza el perfil antes de avanzar para evitar recargas en la vista principal
        await updateProfile(userCredential.user, { displayName: nombre });
        await userCredential.user.reload();

        // Guardamos los datos en Firestore con rol predeterminado
        await setDoc(doc(db, "users", userCredential.user.uid), {
          nombre: nombre,
          correo: email,
          rol: 'lector'
        });

        setSuccess('¡Registro exitoso!');
        onLoginSuccess();
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      }
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo electrónico ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError('Ocurrió un error inesperado. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Se ha enviado un enlace de restablecimiento a tu correo.');
    } catch (err: any) {
      setError('No se pudo enviar el correo. Verifica que esté bien escrito.');
    } finally {
      setSendingReset(false);
    }
  };

  const cambiarVista = (nuevaVista: Vista) => {
    setVista(nuevaVista);
    setError('');
    setSuccess('');
  };

  if (vista === 'forgot') {
    return (
      <div className="login-container">
        <div className="login-card">
          <button type="button" onClick={() => cambiarVista('login')} className="btn-back" style={{ marginBottom: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowLeft size={16} /> Volver al inicio
          </button>
          <h2>Recuperar Contraseña</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>
            Ingresa tu correo institucional para enviarte un enlace de recuperación.
          </p>
          {error && <div className="login-error" style={{ color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
          {success && <div className="login-success" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}
          <form onSubmit={handleForgotPassword} className="login-form">
            <div className="input-group">
              <label>Correo Electrónico</label>
              <div className="input-wrapper">
                <Mail size={18} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ejemplo@ubiobio.cl" required />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={sendingReset}>
              {sendingReset ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>{vista === 'register' ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>
          <p>{vista === 'register' ? 'Regístrate en el Gestor Documental UBB' : 'Ingresa tus credenciales para continuar'}</p>
        </div>

        {error && <div className="login-error" style={{ color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{error}</div>}
        {success && <div className="login-success" style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px' }}>{success}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {vista === 'register' && (
            <div className="input-group">
              <label>Nombre Completo</label>
              <div className="input-wrapper">
                <User size={18} />
                <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Juan Pérez" required />
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ejemplo@ubiobio.cl" required />
            </div>
          </div>

          <div className="input-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          </div>

          {vista === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '15px' }}>
              <button type="button" onClick={() => cambiarVista('forgot')} className="btn-link" style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '13px' }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="spin-icon" size={20} /> : (vista === 'register' ? 'Registrarse' : 'Iniciar Sesión')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="button" onClick={() => cambiarVista(vista === 'register' ? 'login' : 'register')} className="btn-link" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {vista === 'register' ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    </div>
  );
}