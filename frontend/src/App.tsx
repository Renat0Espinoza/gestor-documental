import { useState, useEffect } from 'react';
import axios from 'axios';
import { Server, CheckCircle, XCircle, RefreshCcw } from 'lucide-react';

function App() {
  const [status, setStatus] = useState<{connected: boolean, message: string} | null>(null);
  const [loading, setLoading] = useState(true);

  const checkJenkins = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/jenkins-status');
      setStatus(res.data);
    } catch (err) {
      setStatus({ connected: false, message: "Error al contactar el servidor" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkJenkins(); }, []);

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f4f4f9' 
    }}>
      <div style={{ 
        padding: '30px', borderRadius: '12px', backgroundColor: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center', width: '350px'
      }}>
        <Server size={48} color="#666" style={{ marginBottom: '15px' }} />
        <h2>Estado de Jenkins</h2>

        {loading ? (
          <p>Consultando servidor...</p>
        ) : (
          <div style={{ 
            padding: '15px', borderRadius: '8px', 
            backgroundColor: status?.connected ? '#e6fffa' : '#fff5f5',
            color: status?.connected ? '#2c7a7b' : '#c53030',
            border: `1px solid ${status?.connected ? '#81e6d9' : '#feb2b2'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {status?.connected ? <CheckCircle size={20} /> : <XCircle size={20} />}
              <strong>{status?.connected ? 'Conectado' : 'Desconectado'}</strong>
            </div>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>{status?.message}</p>
          </div>
        )}

        <button 
          onClick={checkJenkins}
          style={{ 
            marginTop: '20px', padding: '10px 15px', cursor: 'pointer',
            border: 'none', borderRadius: '6px', backgroundColor: '#4a5568', color: 'white',
            display: 'flex', alignItems: 'center', gap: '8px', margin: '20px auto 0'
          }}
        >
          <RefreshCcw size={16} /> Reintentar
        </button>
      </div>
    </div>
  );
}

export default App;