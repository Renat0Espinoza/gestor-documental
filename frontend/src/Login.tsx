import { useState } from 'react';
import { Lock, Mail, ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore'; // Inyectado para roles
import { auth, db } from './firebase'; // Inyectado 'db'

interface LoginProps {
  onLoginSuccess: () => void;
}

type Vista = 'login' | 'register' | 'forgot';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [vista, setVista] = useState<Vista>('login');
  const [sendingReset, setSendingReset] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para visibilidad de contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (vista === 'register') {
        // Validar que las contraseñas coincidan
        if (password !== confirmPassword) {
          setError('Las contraseñas no coinciden. Por favor, verifica e inténtalo de nuevo.');
          setLoading(false);
          return;
        }

        // 1. Crear el usuario en Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // 2. Guardar en Firestore con el rol "lector" y sin nombre (se pedirá después)
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          nombre: '',
          telefono: '',
          correo: email,
          rol: 'lector', // Rol inicial según lo solicitado
          estado: 'Activo',
          perfilCompleto: false, // Flag para saber si completó su perfil
          fechaCreacion: new Date().toISOString()
        });

        onLoginSuccess();
      } else {
        // Login normal
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      }
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
    } finally {
      setLoading(false);
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
    setShowPassword(false);
    setShowConfirmPassword(false);
    setConfirmPassword('');
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
              {sendingReset ? <Loader2 className="spin-icon" size={20} /> : 'Enviar enlace de recuperación'}
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
        {success && <div className="login-success">{success}</div>}

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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {vista === 'register' && (
            <div className="input-group">
              <label>Confirmar Contraseña</label>
              <div className="input-wrapper">
                <Lock size={18} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  title={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="input-hint error">Las contraseñas no coinciden</div>
              )}
              {confirmPassword && password === confirmPassword && confirmPassword.length > 0 && (
                <div className="input-hint success">Las contraseñas coinciden ✓</div>
              )}
            </div>
          )}

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