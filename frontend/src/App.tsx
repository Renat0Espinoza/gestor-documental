import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox
} from 'lucide-react';
import Login from './Login';

interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

type Vista = 'dashboard' | 'explorador' | 'busqueda';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [listaArchivos, setListaArchivos] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE = '';

  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/github-status`);
      setStatus(res.data);
    } catch {
      setStatus({ connected: false, message: 'Error al contactar GitHub' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) checkGithub();
  }, [isAuthenticated]);

  // --- SUBIDA DE ARCHIVOS ---
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
      const response = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`✅ ¡Subida exitosa!\nArchivo: ${response.data.file}`);
    } catch {
      alert('❌ Hubo un error al intentar subir el archivo al servidor.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- EXPLORADOR ---
  const abrirExplorador = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/files`);
      setListaArchivos(response.data);
      setVistaActual('explorador');
    } catch {
      alert('❌ Error al conectar con el servidor para ver los archivos.');
    }
  };

  // --- BÚSQUEDA ---
  const abrirBusqueda = () => {
    setSearchQuery('');
    setSearchResults([]);
    setVistaActual('busqueda');
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await axios.get(`${API_BASE}/api/search`, { params: { q: query } });
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleDownload = (filename: string) => {
    window.open(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, '_blank');
  };

  // --- COMPONENTE DE LISTA DE ARCHIVOS REUTILIZABLE ---
  const renderFileList = (files: FileInfo[]) => (
    <div className="file-list">
      {files.map((archivo, index) => (
        <div key={index} className="file-item" style={{ animationDelay: `${index * 0.05}s` }}>
          <div className="file-icon">
            <FileText size={20} color="#f87171" />
          </div>
          <div className="file-info">
            <div className="file-name">{archivo.name}</div>
            <div className="file-meta">
              {formatFileSize(archivo.size)}
              {archivo.modified ? ` · ${formatDate(archivo.modified)}` : ''}
            </div>
          </div>
          <button className="file-download" onClick={() => handleDownload(archivo.name)}>
            <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            Descargar
          </button>
        </div>
      ))}
    </div>
  );

  // --- AUTH GATE ---
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>Gestión Documental</h1>
          <div className="header-sub">Panel de Administración</div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="btn-logout" title="Cerrar Sesión">
          <LogOut size={16} /> Salir
        </button>
      </header>

      <main className="app-main">
        {/* HIDDEN FILE INPUT */}
        <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

        {/* === DASHBOARD === */}
        {vistaActual === 'dashboard' && (
          <>
            <div className="section-title">Acciones Rápidas</div>
            <div className="card-grid">
              <button className="action-card" onClick={() => fileInputRef.current?.click()}>
                <div className="card-icon blue">
                  <UploadCloud size={26} color="#4f8cff" />
                </div>
                <h3>Subir Documento</h3>
                <p>Cargar nuevos archivos PDF al sistema</p>
              </button>

              <button className="action-card" onClick={abrirExplorador}>
                <div className="card-icon green">
                  <FolderOpen size={26} color="#34d399" />
                </div>
                <h3>Explorar Archivos</h3>
                <p>Ver listado de documentos guardados</p>
              </button>

              <button className="action-card" onClick={abrirBusqueda}>
                <div className="card-icon amber">
                  <Search size={26} color="#fbbf24" />
                </div>
                <h3>Buscar</h3>
                <p>Encontrar archivos por nombre</p>
              </button>

              <button className="action-card" onClick={() => alert('La función "Configuración" está en desarrollo.')}>
                <div className="card-icon purple">
                  <Settings size={26} color="#a78bfa" />
                </div>
                <h3>Configuración</h3>
                <p>Ajustes del sistema y conexión</p>
              </button>
            </div>
          </>
        )}

        {/* === EXPLORADOR === */}
        {vistaActual === 'explorador' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Archivos Subidos</h2>
              <span className="badge">{listaArchivos.length}</span>
            </div>

            {listaArchivos.length === 0 ? (
              <div className="empty-state">
                <Inbox size={48} />
                <p>No hay documentos en la bodega aún.</p>
              </div>
            ) : (
              renderFileList(listaArchivos)
            )}
          </div>
        )}

        {/* === BÚSQUEDA === */}
        {vistaActual === 'busqueda' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Buscar Documentos</h2>
            </div>

            <div className="search-bar">
              <Search size={20} />
              <input
                type="text"
                placeholder="Escribe el nombre del archivo..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {searching && <RefreshCcw size={16} className="spin-icon" style={{ color: 'var(--text-muted)', marginLeft: 8 }} />}
            </div>

            {!searchQuery.trim() ? (
              <div className="empty-state">
                <Search size={48} />
                <p>Escribe un término para buscar entre tus documentos.</p>
              </div>
            ) : searchResults.length === 0 && !searching ? (
              <div className="empty-state">
                <Inbox size={48} />
                <p>No se encontraron archivos con "{searchQuery}".</p>
              </div>
            ) : (
              renderFileList(searchResults)
            )}
          </div>
        )}
      </main>

      {/* GITHUB ACTIONS WIDGET */}
      <div
        onClick={loading ? undefined : checkGithub}
        className={`github-widget ${status?.connected ? 'connected' : 'disconnected'}`}
      >
        <Server size={20} color={status?.connected ? '#34d399' : '#f87171'} />
        <div>
          <div className="github-label">GitHub Actions</div>
          <div className={`github-status ${status?.connected ? 'ok' : 'fail'}`}>
            {loading ? 'Consultando...' : status?.connected ? 'Conectado' : 'Desconectado'}
            {status?.connected && !loading && <CheckCircle size={13} />}
            {!status?.connected && !loading && <XCircle size={13} />}
          </div>
        </div>
        <RefreshCcw size={14} color="var(--text-muted)" className={loading ? 'spin-icon' : ''} style={{ marginLeft: 8 }} />
      </div>
    </div>
  );
}

export default App;