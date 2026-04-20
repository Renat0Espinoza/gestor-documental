import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Server, CheckCircle, XCircle, RefreshCcw, 
  UploadCloud, FolderOpen, Search, Settings 
} from 'lucide-react';

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

  const handlePlaceholderClick = (funcion: string) => {
    alert(`La función "${funcion}" está en desarrollo.`);
  };

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', 
      minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f4f4f9' 
    }}>
      
      {/* ENCABEZADO SUPERIOR */}
      <header style={{ 
        backgroundColor: 'white', padding: '20px 40px', 
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', 
        justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, color: '#2d3748', fontSize: '24px' }}>
          Sistema de Gestión de Documentos
        </h1>
        <div style={{ color: '#718096', fontSize: '14px' }}>
          Panel de Administración
        </div>
      </header>

      {/* ÁREA PRINCIPAL (DASHBOARD) */}
      <main style={{ padding: '40px', flex: 1 }}>
        <h2 style={{ color: '#4a5568', marginBottom: '20px', fontSize: '18px', fontWeight: 'normal' }}>
          Acciones Rápidas
        </h2>
        
        {/* Cuadrícula de botones (Grid) */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
          gap: '20px' 
        }}>
          
          {/* Botón 1: Subir */}
          <button onClick={() => handlePlaceholderClick('Subir Documento')} style={cardButtonStyle}>
            <UploadCloud size={40} color="#3182ce" style={{ marginBottom: '15px' }} />
            <h3 style={cardTitleStyle}>Subir Documento</h3>
            <p style={cardDescStyle}>Cargar nuevos archivos al sistema</p>
          </button>

          {/* Botón 2: Ver Documentos */}
          <button onClick={() => handlePlaceholderClick('Explorar Archivos')} style={cardButtonStyle}>
            <FolderOpen size={40} color="#38a169" style={{ marginBottom: '15px' }} />
            <h3 style={cardTitleStyle}>Explorar Archivos</h3>
            <p style={cardDescStyle}>Ver listado de documentos guardados</p>
          </button>

          {/* Botón 3: Buscar */}
          <button onClick={() => handlePlaceholderClick('Búsqueda')} style={cardButtonStyle}>
            <Search size={40} color="#d69e2e" style={{ marginBottom: '15px' }} />
            <h3 style={cardTitleStyle}>Buscar</h3>
            <p style={cardDescStyle}>Encontrar archivos específicos</p>
          </button>

          {/* Botón 4: Configuración */}
          <button onClick={() => handlePlaceholderClick('Configuración')} style={cardButtonStyle}>
            <Settings size={40} color="#718096" style={{ marginBottom: '15px' }} />
            <h3 style={cardTitleStyle}>Configuración</h3>
            <p style={cardDescStyle}>Ajustes del sistema y conexión</p>
          </button>

        </div>
      </main>

      {/* INDICADOR DE JENKINS FLOTANTE (Abajo a la derecha) */}
      <div 
        onClick={loading ? undefined : checkJenkins}
        style={{ 
          position: 'fixed', bottom: '20px', right: '20px',
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 20px', borderRadius: '50px', backgroundColor: 'white',
          boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: loading ? 'wait' : 'pointer',
          border: `1px solid ${status?.connected ? '#81e6d9' : '#feb2b2'}`,
          transition: 'all 0.2s'
        }}
        title="Clic para actualizar estado"
      >
        <Server size={24} color={status?.connected ? '#319795' : '#e53e3e'} />
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: '#718096', fontWeight: 'bold' }}>
            Servidor Jenkins
          </span>
          <span style={{ 
            fontSize: '14px', 
            color: status?.connected ? '#2c7a7b' : '#c53030',
            display: 'flex', alignItems: 'center', gap: '5px' 
          }}>
            {loading ? 'Consultando...' : status?.connected ? 'Conectado' : 'Desconectado'}
            {status?.connected && !loading ? <CheckCircle size={14} /> : null}
            {!status?.connected && !loading ? <XCircle size={14} /> : null}
          </span>
        </div>

        <RefreshCcw 
          size={16} 
          color="#a0aec0" 
          style={{ marginLeft: '10px', animation: loading ? 'spin 1s linear infinite' : 'none' }} 
        />
      </div>

      {/* Animación básica para el icono de recarga */}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        button:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}

// --- ESTILOS REUTILIZABLES PARA LOS BOTONES/TARJETAS ---
const cardButtonStyle: React.CSSProperties = {
  backgroundColor: 'white',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '30px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  textAlign: 'center'
};

const cardTitleStyle: React.CSSProperties = {
  margin: '0 0 8px 0',
  color: '#2d3748',
  fontSize: '18px'
};

const cardDescStyle: React.CSSProperties = {
  margin: 0,
  color: '#718096',
  fontSize: '14px'
};

export default App;