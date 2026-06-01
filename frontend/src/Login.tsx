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

        // 2. Actualizar el perfil inmediatamente con el nombre provisto
        await updateProfile(userCredential.user, { displayName: nombre.trim() });

        // 3. Registrar el documento en Firestore con el rol por defecto
        await setDoc(doc(db, "users", userCredential.user.uid), {
          nombre: nombre.trim(),
          correo: email,
          rol: "lector"
        });

        setSuccess('¡Registro exitoso! Configurando panel...');
        setTimeout(() => {
          onLoginSuccess();
        }, 1200);

      } else if (vista === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccess('¡Inicio de sesión exitoso!');
        setTimeout(() => {
          onLoginSuccess();
        }, 1000);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El correo electrónico ya está registrado.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Credenciales incorrectas. Inténtalo de nuevo.');
      } else {
        setError(err.message || 'Ocurrió un error inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSendingReset(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Se ha enviado un enlace de recuperación a tu correo electrónico.');
    } catch (err: any) {
      setError(err.message || 'Error al enviar el enlace.');
    } finally {
      setSendingReset(false);
    }
  };

  const cambiarVista = (nuevaVista: Vista) => {
    setError('');
    setSuccess('');
    setVista(nuevaVista);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          {vista !== 'login' && (
            <button className="btn-back-login" onClick={() => cambiarVista('login')}>
              <ArrowLeft size={18} />
            </button>
          )}
          <h2>
            {vista === 'login' && 'Iniciar Sesión'}
            {vista === 'register' && 'Crear Cuenta'}
            {vista === 'forgot' && 'Recuperar Clave'}
          </h2>
          <p>
            {vista === 'login' && 'Accede al Sistema de Gestión Documental'}
            {vista === 'register' && 'Regístrate para subir y consultar archivos'}
            {vista === 'forgot' && 'Ingresa tu correo para restablecer tu contraseña'}
          </p>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        <form onSubmit={vista === 'forgot' ? handleForgotPassword : handleSubmit} className="login-form">
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
                placeholder="usuario@universidad.cl"
                required
              />
            </div>
          </div>

          {vista !== 'forgot' && (
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
          )}

          {vista === 'login' && (
            <div style={{ textAlign: 'right', marginTop: '-8px' }}>
              <button
                type=\"button\"
                onClick={() => cambiarVista('forgot')}
                className="btn-link"
                style={{ fontSize: '13px' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading || sendingReset}>
            {loading || sendingReset ? (
              <Loader2 className="spin-icon" size={20} />
            ) : (
              vista === 'register' ? 'Registrarse' : vista === 'forgot' ? 'Enviar Enlace' : 'Iniciar Sesión'
            )}
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
      </div >
    </div >
  );
}