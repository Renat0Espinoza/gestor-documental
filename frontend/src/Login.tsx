import { useState } from 'react';
import { Lock, Mail } from 'lucide-react';
// 1. Importamos las funciones de Firebase
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase'; // Asegúrate de que la ruta coincida con donde guardaste firebase.js

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // Cambiamos username por email para adaptarlo a Firebase
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Nuevo estado para alternar entre "Iniciar Sesión" y "Registrarse"
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); // Limpiamos errores anteriores

    try {
      if (isRegistering) {
        // Modo Registro: Le pedimos a Google que cree el usuario
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Modo Login: Le pedimos a Google que verifique la contraseña
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Si pasa la línea anterior sin explotar, el login fue exitoso
      onLoginSuccess();
    } catch (err: any) {
      // Traducimos los errores comunes de Firebase al español
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px', color: '#333' }}>
          Sistema de Gestión
        </h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          {isRegistering ? 'Crea una cuenta nueva' : 'Ingresa tus credenciales para continuar'}
        </p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '16px', textAlign: 'center', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4b5563', fontSize: '14px' }}>Correo Electrónico</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px' }}>
              <Mail size={18} color="#9ca3af" style={{ marginRight: '8px' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@ubiobio.cl"
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '16px' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4b5563', fontSize: '14px' }}>Contraseña</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px' }}>
              <Lock size={18} color="#9ca3af" style={{ marginRight: '8px' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ border: 'none', outline: 'none', width: '100%', fontSize: '16px' }}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            style={{ backgroundColor: '#2563eb', color: 'white', padding: '12px', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          >
            {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Botón para alternar entre Login y Registro */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(''); // Limpiamos errores al cambiar de modo
            }}
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>

      </div>
    </div>
  );
}