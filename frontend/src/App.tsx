// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye, Bookmark, RotateCcw
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase';
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, setDoc } from 'firebase/firestore';

interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
  categoria?: string;
}

interface UserInfo {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
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

type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial' | 'categorias' | 'papelera';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [listaArchivos, setListaArchivos] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);

  // --- NUEVOS ESTADOS COMPLETOS (Roles, Filtros, Categorías y Papelera) ---
  const [userRole, setUserRole] = useState<'admin' | 'colaborador' | 'lector'>('lector');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterExtension, setFilterExtension] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [usersList, setUsersList] = useState<UserInfo[]>([]);
  const [categorias, setCategorias] = useState<string[]>(['General', 'Planificaciones', 'Informes Técnicos', 'Finanzas']);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('General');
  const [papelera, setPapelera] = useState<FileInfo[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([
    { id: 1, usuario: 'Sistema', accion: 'Auditoría inicializada', documento: 'N/A', fecha: new Date().toISOString() }
  ]);

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
    try {
      const res = await axios.get(`${API_BASE}/api/github-status`);
      setStatus(res.data);
    } catch {
      setStatus({ connected: false, message: 'Error al contactar GitHub' });
    }
  };

  useEffect(() => {
    if (isAuthenticated) checkGithub();
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setDisplayName(user.displayName || user.email || 'Usuario');
        setNewDisplayName(user.displayName || '');
        setNewEmail(user.email || '');
        setIsAuthenticated(true);

        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().rol) {
            setUserRole(docSnap.data().rol);
          } else {
            await setDoc(docRef, { nombre: user.displayName || user.email, correo: user.email, rol: 'lector' }, { merge: true });
            setUserRole('lector');
          }
        } catch (error) {
          console.error("Error al obtener rol de Firestore:", error);
          setUserRole('lector');
        }
      } else {
        setIsAuthenticated(false);
      }
      setLoading(false);
    });

    // Mocks iniciales de archivos con categorías incorporadas
    setListaArchivos([
      { name: 'especificacion_requerimientos.pdf', size: 2450000, modified: new Date().toISOString(), categoria: 'Informes Técnicos' },
      { name: 'plan_desarrollo_software.pdf', size: 1024000, modified: new Date(Date.now() - 86400000).toISOString(), categoria: 'Planificaciones' },
      { name: 'balance_mensual_bodega.pdf', size: 512000, modified: new Date(Date.now() - 172800000).toISOString(), categoria: 'Finanzas' }
    ]);

    return () => unsubscribe();
  }, []);

  const registrarAuditoria = (accion: string, documento: string) => {
    const newLog = {
      id: Date.now(),
      usuario: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuario',
      accion,
      documento,
      fecha: new Date().toISOString()
    };
    setHistoryLogs(prev => [newLog, ...prev]);
  };

  // --- SUBIDA DE ARCHIVOS CON CATEGORÍA ---
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
      // Simulación o petición real
      const response = await axios.post(`${API_BASE}/api/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => ({ data: { file: file.name } }));

      const nuevoArchivo: FileInfo = {
        name: response.data.file || file.name,
        size: file.size,
        modified: new Date().toISOString(),
        categoria: categoriaSeleccionada
      };

      setListaArchivos(prev => [nuevoArchivo, ...prev]);
      alert(`✅ ¡Subida exitosa en la categoría: ${categoriaSeleccionada}!`);
      registrarAuditoria(`Subió archivo (Categoría: ${categoriaSeleccionada})`, nuevoArchivo.name);
      setVistaActual('explorador');
    } catch (err) {
      alert('❌ Hubo un error al intentar subir el archivo.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- SISTEMA DE PAPELERA DE RECICLAJE (HU PAPELERA) ---
  const moverALaPapelera = (filename: string) => {
    if (userRole === 'lector') return;
    const archivo = listaArchivos.find(f => f.name === filename) || searchResults.find(f => f.name === filename);
    if (!archivo) return;

    if (confirm(`¿Seguro que deseas enviar a la papelera el archivo "${filename}"?`)) {
      setListaArchivos(prev => prev.filter(f => f.name !== filename));
      setSearchResults(prev => prev.filter(f => f.name !== filename));
      setPapelera(prev => [archivo, ...prev]);
      registrarAuditoria('Movió a la papelera', filename);
    }
  };

  const restaurarArchivo = (filename: string) => {
    const archivo = papelera.find(f => f.name === filename);
    if (!archivo) return;
    setPapelera(prev => prev.filter(f => f.name !== filename));
    setListaArchivos(prev => [archivo, ...prev]);
    registrarAuditoria('Restauró desde papelera', filename);
    alert('✅ Archivo restaurado correctamente.');
  };

  const eliminarPermanente = (filename: string) => {
    if (confirm(`⚠️ ALERTA DEFINITIVA: ¿Deseas eliminar permanentemente "${filename}"?\nEsta acción no se puede deshacer.`)) {
      setPapelera(prev => prev.filter(f => f.name !== filename));
      registrarAuditoria('Eliminó de forma permanente', filename);
      alert('🗑️ Archivo borrado para siempre del sistema.');
    }
  };

  // --- ASIGNACIÓN DE CATEGORÍAS (ADMIN Y COLABORADOR) ---
  const actualizarCategoriaArchivo = (filename: string, nuevaCat: string) => {
    setListaArchivos(prev => prev.map(f => f.name === filename ? { ...f, categoria: nuevaCat } : f));
    setSearchResults(prev => prev.map(f => f.name === filename ? { ...f, categoria: nuevaCat } : f));
    registrarAuditoria(`Cambió categoría a [${nuevaCat}]`, filename);
  };

  const agregarCategoriaNueva = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    if (categorias.includes(nuevaCategoria.trim())) {
      alert('Esta categoría ya existe.');
      return;
    }
    setCategorias(prev => [...prev, nuevaCategoria.trim()]);
    registrarAuditoria('Creó nueva categoría', nuevaCategoria.trim());
    setNuevaCategoria('');
    alert('✅ Categoría añadida exitosamente.');
  };

  // --- BÚSQUEDA Y FILTRADO AVANZADO (HU1) ---
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(() => {
      // Filtrado interactivo inmediato sobre los archivos
      const resultados = listaArchivos.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
      setSearchResults(resultados);
      setSearching(false);
    }, 250);
  };

  const filteredSearchResults = (searchQuery.trim() ? searchResults : listaArchivos).filter(f => {
    let matchExt = true;
    if (filterExtension !== 'all') matchExt = f.name.toLowerCase().endsWith(`.${filterExtension}`);

    let matchSize = true;
    if (filterSize !== 'all') {
      if (filterSize === 'small') matchSize = f.size < 1024 * 1024;
      else if (filterSize === 'medium') matchSize = f.size >= 1024 * 1024 && f.size <= 5 * 1024 * 1024;
      else if (filterSize === 'large') matchSize = f.size > 5 * 1024 * 1024;
    }
    return matchExt && matchSize;
  });

  // --- CONFIGURACIÓN DE DATOS DEL PERFIL ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccess('');
    setSettingsError('');
    if (!auth.currentUser) return;

    try {
      const exigeReautenticacion = (newEmail !== auth.currentUser.email) || newPassword.length > 0;
      if (exigeReautenticacion) {
        if (!currentPassword) {
          setSettingsError('Se requiere ingresar tu contraseña actual para cambiar el correo o la clave.');
          return;
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      }

      if (newDisplayName.trim() !== displayName) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName.trim() });
        setDisplayName(newDisplayName.trim());
        // Sincronizamos en Firestore también
        await setDoc(doc(db, 'users', auth.currentUser.uid), { nombre: newDisplayName.trim() }, { merge: true });
      }

      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
        await setDoc(doc(db, 'users', auth.currentUser.uid), { correo: newEmail }, { merge: true });
      }

      if (newPassword.length > 0) {
        await updatePassword(auth.currentUser, newPassword);
      }

      setSettingsSuccess('✅ Datos de perfil actualizados correctamente.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setSettingsError(err.message || 'Error al intentar actualizar la configuración.');
    }
  };

  // --- GESTIÓN DE USUARIOS Y ROLES (HU2) ---
  const cargarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const listado: UserInfo[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        listado.push({
          id: docSnap.id,
          nombre: data.nombre || 'Sin nombre cargado',
          correo: data.correo || 'Sin correo',
          rol: data.rol || 'lector'
        });
      });
      setUsersList(listado);
    } catch (err) {
      console.error(err);
    }
  };

  const cambiarRol = async (id: string, nuevoRol: string) => {
    if (id === auth.currentUser?.uid) {
      alert('⚠️ Seguridad del Sistema: No está permitido modificar tu propio rango jerárquico.');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', id), { rol: nuevoRol });
      cargarUsuarios();
      registrarAuditoria(`Cambió rol de usuario a ${nuevoRol.toUpperCase()}`, `ID: ${id}`);
      alert('✅ Privilegios actualizados correctamente.');
    } catch (err) {
      alert("Error al intentar cambiar el rol.");
    }
  };

  const renderFileList = (filesToRender: FileInfo[]) => (
    <div className="file-list">
      {filesToRender.map((archivo, index) => (
        <div key={index} className="file-item">
          <div className="file-icon"><FileText size={20} color="#f87171" /></div>
          <div className="file-info">
            <div className="file-name">{archivo.name}</div>
            <div className="file-meta">
              {formatFileSize(archivo.size)} · {formatDate(archivo.modified)}
              <span style={{ marginLeft: '10px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                📂 {archivo.categoria || 'General'}
              </span>
            </div>
          </div>
          <div className="file-actions">
            {/* Control dinámico de Categorías por Documento para Admin y Colaborador */}
            {userRole !== 'lector' && (
              <select
                value={archivo.categoria || 'General'}
                onChange={(e) => actualizarCategoriaArchivo(archivo.name, e.target.value)}
                style={{ background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '3px', fontSize: '11px', marginRight: '8px' }}
              >
                {categorias.map((cat, ci) => <option key={ci} value={cat}>{cat}</option>)}
              </select>
            )}

            <button className="file-download" onClick={() => { registrarAuditoria('Descargó archivo', archivo.name); alert('Iniciando descarga...'); }}>
              <Download size={14} style={{ marginRight: 4 }} /> Descargar
            </button>
            {userRole !== 'lector' && (
              <button className="file-delete" onClick={() => moverALaPapelera(archivo.name)} title="Mover a la papelera">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) return <div className="loading-screen" style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>Cargando Gestor...</div>;
  if (!isAuthenticated) return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;

  return (
    <div className="app-layout">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>Gestión Documental</h1>
          <div className="header-sub">Panel Universitario de Control</div>
        </div>
        <button onClick={() => { setIsAuthenticated(false); signOut(auth); }} className="btn-logout">
          <LogOut size={16} /> Salir
        </button>
      </header>

      <main className="app-main">
        {/* === DASHBOARD PRINCIPAL === */}
        {vistaActual === 'dashboard' && (
          <>
            <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="welcome-wave">👋</span>
                <span>Bienvenid@ <strong>{displayName}</strong></span>
              </div>

              {/* LEYENDA DERECHA DE ROL REQUERIDA */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: userRole === 'admin' ? 'rgba(79, 140, 255, 0.1)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${userRole === 'admin' ? 'rgba(79, 140, 255, 0.3)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                padding: '6px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 'bold'
              }}>
                {userRole === 'admin' ? <Shield size={16} color="#4f8cff" /> : userRole === 'colaborador' ? <User size={16} color="#34d399" /> : <Eye size={16} color="#8b92a8" />}
                Vista de {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </div>
            </div>

            {/* Selector de Categoría Previa a Carga para Admin/Colaborador */}
            {userRole !== 'lector' && (
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-card)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}><Bookmark size={14} style={{ display: 'inline', marginRight: '4px' }} /> Cargar archivos en la categoría:</span>
                <select value={categoriaSeleccionada} onChange={(e) => setCategoriaSeleccionada(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', padding: '6px 10px', border: '1px solid var(--border-card)', borderRadius: '6px' }}>
                  {categorias.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}

            <div className="section-title">Acciones Rápidas del Sistema</div>
            <div className="card-grid">
              {userRole !== 'lector' && (
                <button className="action-card" onClick={() => fileInputRef.current?.click()}>
                  <div className="card-icon blue"><UploadCloud size={26} color="#4f8cff" /></div>
                  <h3>Subir Documento</h3>
                  <p>Subir nuevos archivos PDF asociados a la categoría</p>
                </button>
              )}
              <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

              <button className="action-card" onClick={() => setVistaActual('explorador')}>
                <div className="card-icon green"><FolderOpen size={26} color="#34d399" /></div>
                <h3>Explorar Bodega</h3>
                <p>Ver y filtrar el listado de documentos</p>
              </button>

              <button className="action-card" onClick={abrirBusqueda}>
                <div className="card-icon amber"><Search size={26} color="#fbbf24" /></div>
                <h3>Búsqueda Avanzada</h3>
                <p>Filtros específicos de extensión y peso</p>
              </button>

              <button className="action-card" onClick={() => setVistaActual('papelera')}>
                <div className="card-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><Trash2 size={26} color="#ef4444" /></div>
                <h3>Papelera ({papelera.length})</h3>
                <p>Restaurar o purgar elementos del repositorio</p>
              </button>

              <button className="action-card" onClick={abrirConfiguracion}>
                <div className="card-icon purple"><Settings size={26} color="#a78bfa" /></div>
                <h3>Ajustes de Perfil</h3>
                <p>Modificar contraseña y datos personales</p>
              </button>

              {userRole === 'admin' && (
                <>
                  <button className="action-card" onClick={() => { setVistaActual('usuarios'); cargarUsuarios(); }}>
                    <div className="card-icon" style={{ background: 'rgba(244, 114, 182, 0.1)' }}><Users size={26} color="#f472b6" /></div>
                    <h3>Control de Permisos</h3>
                    <p>Gestionar y alterar rangos institucionales</p>
                  </button>

                  <button className="action-card" onClick={() => { setVistaActual('categorias'); }}>
                    <div className="card-icon" style={{ background: 'rgba(45, 212, 191, 0.1)' }}><Bookmark size={26} color="#2dd4bf" /></div>
                    <h3>Crear Categorías</h3>
                    <p>Agregar etiquetas globales de clasificación</p>
                  </button>

                  <button className="action-card" onClick={() => setVistaActual('historial')}>
                    <div className="card-icon" style={{ background: 'rgba(79, 140, 255, 0.1)' }}><History size={26} color="#4f8cff" /></div>
                    <h3>Auditoría Global</h3>
                    <p>Trazabilidad histórica de requerimientos</p>
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {/* === EXPLORADOR DE ARCHIVOS GENERAL === */}
        {vistaActual === 'explorador' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Bodega Central de Documentos</h2>
              <span className="badge">{listaArchivos.length}</span>
            </div>
            {listaArchivos.length === 0 ? (
              <div className="empty-state"><Inbox size={48} /><p>Bodega completamente vacía.</p></div>
            ) : renderFileList(listaArchivos)}
          </div>
        )}

        {/* === BUSQUEDA CON FILTROS AVANZADOS (HU1) === */}
        {vistaActual === 'busqueda' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Buscador Avanzado de Requerimientos</h2>
            </div>

            <div className="search-bar">
              <Search size={20} />
              <input type="text" placeholder="Escribe el nombre del documento..." value={searchQuery} onChange={(e) => handleSearch(e.target.value)} />
              <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: showAdvancedFilters ? '#4f8cff' : 'var(--text-muted)' }}><Filter size={20} /></button>
              {searching && <RefreshCcw size={16} className="spin-icon" style={{ marginLeft: 8 }} />}
            </div>

            {showAdvancedFilters && (
              <div style={{ display: 'flex', gap: '15px', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>Formato/Extensión:</span>
                  <select value={filterExtension} onChange={(e) => setFilterExtension(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', padding: '4px', borderRadius: '4px' }}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>Volumen/Tamaño:</span>
                  <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', padding: '4px', borderRadius: '4px' }}>
                    <option value="all">Todos</option>
                    <option value="small">Pequeño (&lt; 1MB)</option>
                    <option value="medium">Mediano (1MB - 5MB)</option>
                    <option value="large">Grande (&gt; 5MB)</option>
                  </select>
                </div>
              </div>
            )}

            {filteredSearchResults.length === 0 ? (
              <div className="empty-state"><Inbox size={48} /><p>Ningún archivo coincide con los criterios avanzados fijados.</p></div>
            ) : renderFileList(filteredSearchResults)}
          </div>
        )}

        {/* === VISTA PAPELERA DE RECICLAJE === */}
        {vistaActual === 'papelera' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Papelera de Reciclaje Protegida</h2>
              <span className="badge" style={{ background: '#ef4444' }}>{papelera.length}</span>
            </div>
            {papelera.length === 0 ? (
              <div className="empty-state"><Inbox size={48} /><p>La papelera se encuentra vacía.</p></div>
            ) : (
              <div className="file-list">
                {papelera.map((archivo, index) => (
                  <div key={index} className="file-item">
                    <div className="file-icon"><FileText size={20} color="#6b7280" /></div>
                    <div className="file-info">
                      <div className="file-name" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{archivo.name}</div>
                      <div className="file-meta">Clasificación: {archivo.categoria || 'Sin categoría'}</div>
                    </div>
                    <div className="file-actions">
                      <button className="file-download" style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }} onClick={() => restaurarArchivo(archivo.name)}>
                        <RotateCcw size={14} style={{ marginRight: 4 }} /> Restaurar
                      </button>
                      <button className="file-delete" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }} onClick={() => eliminarPermanente(archivo.name)} title="Eliminar para siempre">
                        <Trash2 size={14} /> Purgar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === CATEGORIAS (ADMIN) === */}
        {vistaActual === 'categorias' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Estructura de Categorías del Repositorio</h2>
            </div>
            <div className="settings-section">
              <form onSubmit={agregarCategoriaNueva} className="settings-form" style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label>Nombre de la Nueva Categoría Institucional</label>
                  <div className="input-wrapper"><Bookmark size={18} /><input type="text" value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Ej: Acreditaciones 2026" required /></div>
                </div>
                <button type="submit" className="btn-save" style={{ height: '42px' }}><Save size={16} /> Crear</button>
              </form>
              <div className="file-list">
                {categorias.map((cat, idx) => (
                  <div key={idx} className="file-item" style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600 }}>📂 {cat}</span>
                    <span className="badge" style={{ fontSize: '11px' }}>Válida</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === LISTADO DE USUARIOS CORREGIDO CON NOMBRE REAL (HU2) === */}
        {vistaActual === 'usuarios' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Asignación de Roles y Permisos</h2>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'var(--bg-glass)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Nombre del Colaborador / Correo</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Nivel de Acceso</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Acción Jerárquica</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      {/* CORRECCIÓN: Muestra el nombre real en vez del ID */}
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 600 }}>{u.nombre}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.correo}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: u.rol === 'admin' ? 'rgba(79, 140, 255, 0.15)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.rol === 'admin' ? '#4f8cff' : u.rol === 'colaborador' ? '#34d399' : '#8b92a8',
                          border: `1px solid ${u.rol === 'admin' ? 'rgba(79, 140, 255, 0.3)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>{u.rol.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {/* CORRECCIÓN: Se deshabilita el selector de rango si coincide con el usuario activo */}
                        <select
                          value={u.rol}
                          onChange={(e) => cambiarRol(u.id, e.target.value)}
                          disabled={u.id === auth.currentUser?.uid}
                          style={{
                            background: 'var(--bg-primary)',
                            color: u.id === auth.currentUser?.uid ? 'var(--text-muted)' : 'white',
                            border: '1px solid var(--border-card)',
                            padding: '6px 10px',
                            borderRadius: '4px',
                            outline: 'none',
                            fontSize: '13px',
                            cursor: u.id === auth.currentUser?.uid ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="admin">Administrador</option>
                          <option value="colaborador">Colaborador</option>
                          <option value="lector">Lector</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === HISTORIAL DE AUDITORÍA (HU4) === */}
        {vistaActual === 'historial' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Historial y Auditoría Global</h2>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'var(--bg-glass)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Fecha / Hora</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Operador</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Acción</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>Documento Implicado</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{formatDate(log.fecha)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{log.usuario}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: log.accion.includes('Eliminó') || log.accion.includes('papelera') ? '#f87171' : log.accion.includes('Subió') ? '#34d399' : 'var(--text-secondary)' }}>
                          {log.accion}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#4f8cff' }}>{log.documento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === TAB PANEL DE CONFIGURACIÓN OPERATIVO === */}
        {vistaActual === 'configuracion' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}><ArrowLeft size={16} /> Volver</button>
              <h2>Configuración del Perfil</h2>
            </div>

            <div className="settings-section">
              <h3 className="settings-section-title">Actualizar Datos de Cuenta</h3>

              {settingsSuccess && <div className="login-success">{settingsSuccess}</div>}
              {settingsError && <div className="login-error">{settingsError}</div>}

              <form onSubmit={handleUpdateProfile} className="settings-form">
                <div className="input-group">
                  <label>Nombre Institucional Visible</label>
                  <div className="input-wrapper">
                    <User size={18} />
                    <input type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Correo Electrónico de Contacto</label>
                  <div className="input-wrapper">
                    <Mail size={18} />
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="input-group">
                  <label>Nueva Contraseña <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Dejar en blanco para no modificar)</span></label>
                  <div className="input-wrapper">
                    <Lock size={18} />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>

                {(newEmail !== (auth.currentUser?.email || '') || newPassword.length > 0) && (
                  <div className="input-group">
                    <label>Contraseña Actual <span style={{ color: 'var(--accent-amber)', fontWeight: 400 }}>(Requerida para confirmar cambios críticos)</span></label>
                    <div className="input-wrapper">
                      <Lock size={18} />
                      <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirma tu clave actual" required />
                    </div>
                  </div>
                )}

                <button type="submit" className="btn-save"><Save size={16} /> Guardar Cambios</button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* GITHUB ACTIONS WIDGET */}
      <div onClick={checkGithub} className={`github-widget ${status?.connected ? 'connected' : 'disconnected'}`}>
        <Server size={20} color={status?.connected ? '#34d399' : '#f87171'} />
        <div>
          <div className="github-label">GitHub Actions</div>
          <div className={`github-status ${status?.connected ? 'ok' : 'fail'}`}>
            {status?.connected ? 'Conectado' : 'Desconectado'}
            {status?.connected && <CheckCircle size={13} />}
          </div>
        </div>
        <RefreshCcw size={14} color="var(--text-muted)" style={{ marginLeft: 8 }} />
      </div>
    </div>
  );
}