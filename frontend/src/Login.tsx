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
  const [loading, setLoading] = useState(false);

  const cambiarVista = (nuevaVista: Vista) => {
    setVista(nuevaVista);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (vista === 'register') {
        // 1. Crear el usuario en Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // 2. Actualizar el perfil con el nombre
        await updateProfile(userCredential.user, { displayName: nombre });

        // 3. Guardar rol predeterminado en Firestore
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          nombre,
          email,
          rol: 'usuario',
          fechaCreacion: new Date().toISOString()
        });

        setSuccess('¡Registro completado con éxito!');
        onLoginSuccess();
      } else if (vista === 'login') {
        // Iniciar Sesión
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } else if (vista === 'forgot') {
        // Recuperar Contraseña
        await sendPasswordResetEmail(auth, email);
        setSuccess('Se ha enviado un correo para restablecer tu contraseña.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El correo electrónico ya está registrado.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Ocurrió un error. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {vista === 'forgot' && (
          <button type="button" className="btn-link" onClick={() => cambiarVista('login')} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px', padding: 0 }}>
            <ArrowLeft size={16} /> Volver al login
          </button>
        )}

        <h2>
          {vista === 'login' && 'Iniciar Sesión'}
          {vista === 'register' && 'Crear Cuenta'}
          {vista === 'forgot' && 'Recuperar Contraseña'}
        </h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {vista === 'register' && (
            <div className="form-group">
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

          <div className="form-group">
            <label>Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
          </div>

          {vista !== 'forgot' && (
            <div className="form-group">
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
            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '15px' }}>
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
            {loading ? (
              <Loader2 className="spin-icon" size={20} />
            ) : (
              vista === 'register' ? 'Registrarse' : vista === 'forgot' ? 'Enviar instrucciones' : 'Iniciar Sesión'
            )}
          </button>
        </form>

        {vista !== 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => cambiarVista(vista === 'register' ? 'login' : 'register')}
              className="btn-link"
            >
              {vista === 'register' ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);

  const cambiarVista = (nuevaVista: Vista) => {
    setVista(nuevaVista);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (vista === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: nombre });
        await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
          nombre,
          email,
          rol: 'usuario',
          fechaCreacion: new Date().toISOString()
        });
        setSuccess('¡Registro completado con éxito!');
        onLoginSuccess();
      } else if (vista === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        onLoginSuccess();
      } else if (vista === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccess('Se ha enviado un correo para restablecer tu contraseña.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El correo electrónico ya está registrado.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Correo o contraseña incorrectos.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError('Ocurrió un error. Por favor, inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {vista === 'forgot' && (
          <button type="button" className="btn-link" onClick={() => cambiarVista('login')} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '15px', padding: 0 }}>
            <ArrowLeft size={16} /> Volver al login
          </button>
        )}

        <h2>
          {vista === 'login' && 'Iniciar Sesión'}
          {vista === 'register' && 'Crear Cuenta'}
          {vista === 'forgot' && 'Recuperar Contraseña'}
        </h2>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {vista === 'register' && (
            <div className="form-group">
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

          <div className="form-group">
            <label>Correo Electrónico</label>
            <div className="input-wrapper">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
              />
            </div>
          </div>

          {vista !== 'forgot' && (
            <div className="form-group">
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
            <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '15px' }}>
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
            {loading ? (
              <Loader2 className="spin-icon" size={20} />
            ) : (
              vista === 'register' ? 'Registrarse' : vista === 'forgot' ? 'Enviar instrucciones' : 'Iniciar Sesión'
            )}
          </button>
        </form>

        {vista !== 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => cambiarVista(vista === 'register' ? 'login' : 'register')}
              className="btn-link"
            >
              {vista === 'register' ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}