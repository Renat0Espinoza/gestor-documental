import { useState } from 'react';
import { Lock, User } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simulación de validación temporal (luego esto lo hará tu Backend)
    if (username === 'admin' && password === '12345') {
      setError('');
      onLoginSuccess(); 
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', backgroundColor: '#f3f4f6' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px', color: '#333' }}>
          Sistema de Gestión
        </h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
          Ingresa tus credenciales para continuar
        </p>

        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#ef4444', padding: '10px', borderRadius: '6px', marginBottom: '16px', textAlign: 'center', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4b5563', fontSize: '14px' }}>Usuario</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 12px' }}>
              <User size={18} color="#9ca3af" style={{ marginRight: '8px' }} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: admin"
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
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
}