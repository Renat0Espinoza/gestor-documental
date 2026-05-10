import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut, ArrowLeft, FileText
} from 'lucide-react';
import Login from './Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean, message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // NUEVO ESTADO: Controla qué pantalla vemos ('dashboard' o 'explorador')
  const [vistaActual, setVistaActual] = useState<'dashboard' | 'explorador'>('dashboard');
  // NUEVO ESTADO: Guarda la lista de archivos que nos manda el servidor
  const [listaArchivos, setListaArchivos] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // DESPUÉS
  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/github-status');
      setStatus(res.data);
    } catch (err) {
      setStatus({ connected: false, message: "Error al contactar GitHub" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) { checkGithub(); }
  }, [isAuthenticated]);

  const handlePlaceholderClick = (funcion: string) => {
    alert(`La función "${funcion}" está en desarrollo.`);
  };

  // --- FUNCIÓN PARA SUBIR ARCHIVOS (Ya funciona) ---
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('⚠️ Por favor, selecciona únicamente archivos PDF.');
      return;
    }

    const formData = new FormData();
    formData.append('documento', file);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`✅ ¡Subida exitosa!\nEl archivo se guardó como: ${response.data.file}`);
    } catch (error) {
      console.error("Error al subir:", error);
      alert('❌ Hubo un error al intentar subir el archivo al servidor.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- NUEVA FUNCIÓN: OBTENER ARCHIVOS ---
  const abrirExplorador = async () => {
    try {
      // Le pedimos al backend la lista de archivos
      const response = await axios.get('/api/files');
      setListaArchivos(response.data); // Guardamos los datos
      setVistaActual('explorador');    // Cambiamos la pantalla
    } catch (error) {
      console.error("Error al obtener archivos:", error);
      alert("❌ Error al conectar con el servidor para ver los archivos.");
    }
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f4f4f9' }}>

      <header style={{ backgroundColor: 'white', padding: '20px 40px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#2d3748', fontSize: '24px' }}>Sistema de Gestión de Documentos</h1>
          <div style={{ color: '#718096', fontSize: '14px', marginTop: '4px' }}>Panel de Administración</div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} style={logoutStyle} title="Cerrar Sesión">
          <LogOut size={18} /> Salir
        </button>
      </header>

      <main style={{ padding: '40px', flex: 1, maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {/* === PANTALLA 1: DASHBOARD PRINCIPAL === */}
        {vistaActual === 'dashboard' && (
          <>
            <h2 style={{ color: '#4a5568', marginBottom: '20px', fontSize: '18px', fontWeight: 'normal' }}>Acciones Rápidas</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>

              <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

              <button onClick={() => fileInputRef.current?.click()} style={cardButtonStyle}>
                <UploadCloud size={40} color="#3182ce" style={{ marginBottom: '15px' }} />
                <h3 style={cardTitleStyle}>Subir Documento</h3>
                <p style={cardDescStyle}>Cargar nuevos archivos al sistema</p>
              </button>

              {/* Conectamos el botón al backend */}
              <button onClick={abrirExplorador} style={cardButtonStyle}>
                <FolderOpen size={40} color="#38a169" style={{ marginBottom: '15px' }} />
                <h3 style={cardTitleStyle}>Explorar Archivos</h3>
                <p style={cardDescStyle}>Ver listado de documentos guardados</p>
              </button>

              <button onClick={() => handlePlaceholderClick('Búsqueda')} style={cardButtonStyle}>
                <Search size={40} color="#d69e2e" style={{ marginBottom: '15px' }} />
                <h3 style={cardTitleStyle}>Buscar</h3>
                <p style={cardDescStyle}>Encontrar archivos específicos</p>
              </button>

              <button onClick={() => handlePlaceholderClick('Configuración')} style={cardButtonStyle}>
                <Settings size={40} color="#718096" style={{ marginBottom: '15px' }} />
                <h3 style={cardTitleStyle}>Configuración</h3>
                <p style={cardDescStyle}>Ajustes del sistema y conexión</p>
              </button>
            </div>
          </>
        )}

        {/* === PANTALLA 2: EXPLORADOR DE ARCHIVOS === */}
        {vistaActual === 'explorador' && (
          <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
              <button
                onClick={() => setVistaActual('dashboard')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <ArrowLeft size={20} /> Volver
              </button>
              <h2 style={{ margin: 0, color: '#2d3748', fontSize: '20px' }}>Archivos Subidos ({listaArchivos.length})</h2>
            </div>

            {listaArchivos.length === 0 ? (
              <p style={{ color: '#718096', textAlign: 'center', padding: '40px 0' }}>No hay documentos en la bodega aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {listaArchivos.map((archivo, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc' }}>
                    <FileText size={24} color="#e53e3e" style={{ marginRight: '16px' }} />
                    <span style={{ color: '#2d3748', fontSize: '15px', fontWeight: '500' }}>{archivo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Widget de Jenkins (Se mantiene) */}
      <div
        onClick={loading ? undefined : checkGithub}
        style={{ position: 'fixed', bottom: '20px', right: '20px', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderRadius: '50px', backgroundColor: 'white', boxShadow: '0 4px 10px rgba(0,0,0,0.15)', cursor: loading ? 'wait' : 'pointer', border: `1px solid ${status?.connected ? '#81e6d9' : '#feb2b2'}`, transition: 'all 0.2s' }}
      >
        <Server size={24} color={status?.connected ? '#319795' : '#e53e3e'} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '12px', color: '#718096', fontWeight: 'bold' }}>GitHub Actions</span>
          <span style={{ fontSize: '14px', color: status?.connected ? '#2c7a7b' : '#c53030', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {loading ? 'Consultando...' : status?.connected ? 'Conectado' : 'Desconectado'}
            {status?.connected && !loading ? <CheckCircle size={14} /> : null}
            {!status?.connected && !loading ? <XCircle size={14} /> : null}
          </span>
        </div>
        <RefreshCcw size={16} color="#a0aec0" style={{ marginLeft: '10px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        button:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
}

// Estilos extraídos
const cardButtonStyle: React.CSSProperties = { backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease-in-out', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', textAlign: 'center' };
const cardTitleStyle: React.CSSProperties = { margin: '0 0 8px 0', color: '#2d3748', fontSize: '18px' };
const cardDescStyle: React.CSSProperties = { margin: 0, color: '#718096', fontSize: '14px' };
const logoutStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'transparent', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', color: '#e53e3e', fontWeight: 'bold', transition: 'all 0.2s' };

export default App;