import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock
} from 'lucide-react';
import Login from './Login';
import { auth } from './firebase';
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

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

type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [listaArchivos, setListaArchivos] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);

  // --- Estado de perfil ---
  const [displayName, setDisplayName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setDisplayName(user.displayName || '');
        setIsAuthenticated(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- SUBIDA DE ARCHIVOS ---
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('⚠️ Por favor, selecciona únicamente archivos PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('⚠️ El archivo es demasiado pesado.\nEl límite máximo permitido es de 10 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('documento', file);

    try {
      const response = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`✅ ¡Subida exitosa!\nArchivo: ${response.data.file}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 413) {
        alert('⚠️ El archivo es demasiado pesado.\nEl límite máximo permitido es de 10 MB.');
      } else {
        alert('❌ Hubo un error al intentar subir el archivo al servidor.');
      }
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

  // --- CONFIGURACIÓN ---
  const abrirConfiguracion = () => {
    setNewDisplayName(displayName);
    setNewEmail(auth.currentUser?.email || '');
    setNewPassword('');
    setCurrentPassword('');
    setSettingsSuccess('');
    setSettingsError('');
    setVistaActual('configuracion');
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');
    if (!auth.currentUser) return;

    try {
      const needsReauth = (newEmail !== auth.currentUser.email) || newPassword.length > 0;
      if (needsReauth) {
        if (!currentPassword) {
          setSettingsError('Debes ingresar tu contraseña actual para cambiar el correo o la contraseña.');
          return;
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      if (newDisplayName.trim() !== displayName) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName.trim() });
        setDisplayName(newDisplayName.trim());
      }

      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
      }

      if (newPassword.length > 0) {
        await updatePassword(auth.currentUser, newPassword);
      }

      setSettingsSuccess('✅ Perfil actualizado correctamente.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setSettingsError('La contraseña actual es incorrecta.');
      } else if (err.code === 'auth/email-already-in-use') {
        setSettingsError('Este correo electrónico ya está en uso.');
      } else if (err.code === 'auth/weak-password') {
        setSettingsError('La nueva contraseña debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/requires-recent-login') {
        setSettingsError('Por seguridad, cierra sesión y vuelve a iniciar antes de hacer este cambio.');
      } else {
        setSettingsError('Ocurrió un error al actualizar el perfil.');
        console.error(err);
      }
    }
  };

  // --- ELIMINAR ARCHIVO (doble confirmación) ---
  const handleDelete = async (filename: string) => {
    const primera = confirm(`¿Estás seguro de que deseas eliminar el archivo?\n\n"${filename}"`);
    if (!primera) return;

    const segunda = confirm('⚠️ Esta acción es irreversible.\n¿Confirmas que deseas eliminar el archivo permanentemente?');
    if (!segunda) return;

    try {
      await axios.delete(`${API_BASE}/api/files/${encodeURIComponent(filename)}`);
      alert('🗑️ Archivo eliminado correctamente.');
      const response = await axios.get(`${API_BASE}/api/files`);
      setListaArchivos(response.data);
    } catch {
      alert('❌ Error al intentar eliminar el archivo.');
    }
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
          <div className="file-actions">
            <button className="file-download" onClick={() => handleDownload(archivo.name)}>
              <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Descargar
            </button>
            <button className="file-delete" onClick={() => handleDelete(archivo.name)} title="Eliminar archivo">
              <Trash2 size={14} />
            </button>
          </div>
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
            {displayName && (
              <div className="welcome-banner">
                <span className="welcome-wave">👋</span>
                <span>Bienvenid@ <strong>{displayName}</strong></span>
              </div>
            )}
            <div className="section-title">Acciones Rápidas</div>
            <div className="card-grid">
              <button className="action-card" onClick={() => fileInputRef.current?.click()}>
                <div className="card-icon blue">
                  <UploadCloud size={26} color="#4f8cff" />
                </div>
                <h3>Subir Documento</h3>
                <p>Cargar nuevos archivos PDF al sistema (limite 10mb)</p>
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

              <button className="action-card" onClick={abrirConfiguracion}>
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

        {/* === CONFIGURACIÓN === */}
        {vistaActual === 'configuracion' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Configuración</h2>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">Perfil de Usuario</h3>

              {settingsSuccess && <div className="login-success">{settingsSuccess}</div>}
              {settingsError && <div className="login-error">{settingsError}</div>}

              <form onSubmit={handleUpdateProfile} className="settings-form">
                <div className="input-group">
                  <label>Nombre de Usuario</label>
                  <div className="input-wrapper">
                    <User size={18} />
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Correo Electrónico</label>
                  <div className="input-wrapper">
                    <Mail size={18} />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="ejemplo@ubiobio.cl"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Nueva Contraseña <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(dejar vacío para no cambiar)</span></label>
                  <div className="input-wrapper">
                    <Lock size={18} />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {(newEmail !== (auth.currentUser?.email || '') || newPassword.length > 0) && (
                  <div className="input-group">
                    <label>Contraseña Actual <span style={{ color: 'var(--accent-amber)', fontWeight: 400 }}>(requerida para confirmar cambios)</span></label>
                    <div className="input-wrapper">
                      <Lock size={18} />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                        required
                      />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-save">
                  <Save size={16} /> Guardar Cambios
                </button>
              </form>
            </div>
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