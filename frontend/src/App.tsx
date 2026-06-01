import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
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

type Vista = 'dashboard' | 'archivos' | 'configuracion' | 'usuarios' | 'historial' | 'categorias' | 'papelera';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'colaborador' | 'lector'>('lector');
  const [listaUsuarios, setListaUsuarios] = useState<UserInfo[]>([]);

  // Archivos y Papelera
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [papelera, setPapelera] = useState<FileInfo[]>([]);

  // Categorías
  const [categorias, setCategorias] = useState<string[]>(['General', 'Planificaciones', 'Informes Técnicos', 'Finanzas']);
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  // Búsqueda y Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterExt, setFilterExt] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [filterCat, setFilterCat] = useState('all');

  // Historial
  const [historyLogs, setHistoryLogs] = useState([
    { id: 1, usuario: 'Sistema', accion: 'Sistema iniciado', documento: 'N/A', fecha: new Date().toISOString() }
  ]);

  const [status, setStatus] = useState<{ connected: boolean, message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Configuración de Perfil
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const checkGithub = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/github/status');
      setStatus(response.data);
    } catch (error) {
      setStatus({ connected: false, message: 'No se pudo conectar' });
    }
  };

  useEffect(() => {
    checkGithub();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Resuelve el problema del nombre al extraer los datos actualizados directo de Firestore
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserRole(userData.rol || 'lector');
            setDisplayName(userData.nombre || currentUser.displayName || '');
            setEmail(userData.correo || currentUser.email || '');
          } else {
            await setDoc(docRef, { nombre: currentUser.displayName, correo: currentUser.email, rol: 'lector' });
            setUserRole('lector');
            setDisplayName(currentUser.displayName || '');
            setEmail(currentUser.email || '');
          }
        } catch (e) {
          console.error("Error obteniendo rol:", e);
        }
      } else {
        setUser(null);
        setUserRole('lector');
      }
      setLoading(false);
    });

    setFiles([
      { name: 'documento_requisitos_v2.pdf', size: 2450000, modified: new Date().toISOString(), categoria: 'Informes Técnicos' },
      { name: 'acta_reunion_cliente.docx', size: 1024000, modified: new Date(Date.now() - 86400000).toISOString(), categoria: 'General' },
      { name: 'presupuesto_2024.xlsx', size: 512000, modified: new Date(Date.now() - 172800000).toISOString(), categoria: 'Finanzas' }
    ]);

    return () => unsub();
  }, []);

  const cargarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users: UserInfo[] = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() } as UserInfo);
      });
      setListaUsuarios(users);
    } catch (err) { console.error(err); }
  };

  const cambiarRol = async (id: string, nuevoRol: string) => {
    if (id === user?.uid) {
      alert("No puedes modificar tu propio rango jerárquico por seguridad.");
      return;
    }
    try {
      await updateDoc(doc(db, 'users', id), { rol: nuevoRol });
      cargarUsuarios();
      registrarAuditoria(`Cambió rol a ${nuevoRol.toUpperCase()}`, `User ID: ${id}`);
    } catch (err) { alert("Error al cambiar el rol"); }
  };

  const registrarAuditoria = (accion: string, documento: string) => {
    const newLog = {
      id: Date.now(),
      usuario: displayName || user?.email || 'Usuario',
      accion,
      documento,
      fecha: new Date().toISOString()
    };
    setHistoryLogs(prev => [newLog, ...prev]);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (userRole === 'lector') return;
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (userRole === 'lector') return;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) handleFiles(e.target.files);
  };

  const handleFiles = (newFiles: FileList) => {
    setUploading(true);
    setTimeout(() => {
      const newFilesArray = Array.from(newFiles).map(file => {
        registrarAuditoria('Subió el archivo', file.name);
        return { name: file.name, size: file.size, modified: new Date().toISOString(), categoria: 'General' };
      });
      setFiles(prev => [...newFilesArray, ...prev]);
      setUploading(false);
      setVista('archivos');
    }, 1500);
  };

  const cambiarCategoriaArchivo = (fileName: string, nuevaCategoria: string) => {
    setFiles(prev => prev.map(f => f.name === fileName ? { ...f, categoria: nuevaCategoria } : f));
    registrarAuditoria(`Asignó categoría ${nuevaCategoria}`, fileName);
  };

  const agregarCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    if (!categorias.includes(nuevaCategoria.trim())) {
      setCategorias(prev => [...prev, nuevaCategoria.trim()]);
      registrarAuditoria('Creó nueva categoría', nuevaCategoria.trim());
      setNuevaCategoria('');
    } else {
      alert("La categoría ya existe.");
    }
  };

  // Papelera de reciclaje
  const moverAPapelera = (fileName: string) => {
    if (userRole === 'lector') return;
    if (confirm(`¿Deseas enviar "${fileName}" a la papelera?`)) {
      const archivo = files.find(f => f.name === fileName);
      if (archivo) {
        setFiles(prev => prev.filter(f => f.name !== fileName));
        setPapelera(prev => [archivo, ...prev]);
        registrarAuditoria('Movió a la papelera', fileName);
      }
    }
  };

  const restaurarArchivo = (fileName: string) => {
    const archivo = papelera.find(f => f.name === fileName);
    if (archivo) {
      setPapelera(prev => prev.filter(f => f.name !== fileName));
      setFiles(prev => [archivo, ...prev]);
      registrarAuditoria('Restauró desde la papelera', fileName);
    }
  };

  const eliminarDefinitivo = (fileName: string) => {
    if (confirm(`⚠️ ALERTA DEFINITIVA: ¿Estás seguro de eliminar ${fileName} para siempre? Esta acción no se puede deshacer.`)) {
      setPapelera(prev => prev.filter(f => f.name !== fileName));
      registrarAuditoria('Eliminó permanentemente', fileName);
    }
  };

  const filteredFiles = files.filter(f => {
    const matchQuery = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchExt = true;
    if (filterExt !== 'all') matchExt = f.name.toLowerCase().endsWith(`.${filterExt}`);
    let matchCat = true;
    if (filterCat !== 'all') matchCat = f.categoria === filterCat;
    let matchSize = true;
    if (filterSize !== 'all') {
      if (filterSize === 'small') matchSize = f.size < 1024 * 1024;
      else if (filterSize === 'medium') matchSize = f.size >= 1024 * 1024 && f.size <= 5 * 1024 * 1024;
      else if (filterSize === 'large') matchSize = f.size > 5 * 1024 * 1024;
    }
    return matchQuery && matchExt && matchCat && matchSize;
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    if (!auth.currentUser) return;

    try {
      // Si cambia email exige reautenticación
      if (email !== auth.currentUser.email) {
        if (!currentPassword) {
          setProfileError('Debes ingresar tu contraseña actual para cambiar el correo.');
          return;
        }
        const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updateEmail(auth.currentUser, email);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { correo: email });
      }

      if (displayName !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, { displayName });
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { nombre: displayName });
      }

      setProfileSuccess('✅ Perfil actualizado correctamente.');
      setCurrentPassword('');
    } catch (err: any) {
      setProfileError('Error al actualizar datos. Verifica tu contraseña.');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(''); setProfileSuccess('');
    if (!auth.currentUser) return;
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setProfileSuccess('✅ Contraseña cambiada con éxito.');
      setCurrentPassword(''); setNewPassword('');
    } catch (err) {
      setProfileError('La contraseña actual es incorrecta o hay un error.');
    }
  };

  if (loading) return <div className="loading-screen" style={{ color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>Cargando Gestor...</div>;
  if (!user) return <Login onLoginSuccess={() => { }} />;

  return (
    <div className="app-layout">
      {/* ===== SIDEBAR ORIGINAL INTACTO ===== */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"><FileText size={24} color="#fff" /></div>
          <span>Gestor UBB</span>
        </div>

        <nav className="sidebar-nav">
          <button onClick={() => setVista('dashboard')} className={`nav-item ${vista === 'dashboard' ? 'active' : ''}`}>
            <FolderOpen size={20} /><span>Dashboard</span>
          </button>
          <button onClick={() => setVista('archivos')} className={`nav-item ${vista === 'archivos' ? 'active' : ''}`}>
            <UploadCloud size={20} /><span>Mis Archivos</span>
          </button>
          <button onClick={() => setVista('papelera')} className={`nav-item ${vista === 'papelera' ? 'active' : ''}`}>
            <Trash2 size={20} /><span>Papelera ({papelera.length})</span>
          </button>

          {/* Opciones exclusivas de Admin */}
          {userRole === 'admin' && (
            <>
              <button onClick={() => { setVista('usuarios'); cargarUsuarios(); }} className={`nav-item ${vista === 'usuarios' ? 'active' : ''}`}>
                <Users size={20} /><span>Gestión de Usuarios</span>
              </button>
              <button onClick={() => setVista('categorias')} className={`nav-item ${vista === 'categorias' ? 'active' : ''}`}>
                <Bookmark size={20} /><span>Categorías</span>
              </button>
              <button onClick={() => setVista('historial')} className={`nav-item ${vista === 'historial' ? 'active' : ''}`}>
                <History size={20} /><span>Historial y Auditoría</span>
              </button>
            </>
          )}

          <div className="nav-divider"></div>
          <button onClick={() => { setVista('configuracion'); setActiveTab('profile'); }} className={`nav-item ${vista === 'configuracion' ? 'active' : ''}`}>
            <Settings size={20} /><span>Configuración</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ cursor: 'pointer' }} onClick={() => { setVista('configuracion'); setActiveTab('profile'); }}>
            <div className="user-name">{displayName}</div>
            <div className="user-role" style={{ fontSize: '11px', color: 'var(--accent-blue)', textTransform: 'uppercase', fontWeight: 700 }}>
              {userRole}
            </div>
          </div>
          <button onClick={() => signOut(auth)} className="btn-icon" title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* ===== CONTENIDO PRINCIPAL ORIGINAL INTACTO ===== */}
      <main className="main-content">
        <header className="main-header">
          {/* Búsqueda Avanzada Inyectada en el buscador original */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="search-bar" style={{ marginBottom: 0 }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Buscar documentos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-icon"
                style={{ background: showFilters ? 'rgba(79,140,255,0.1)' : 'transparent', color: showFilters ? 'var(--accent-blue)' : 'var(--text-muted)' }}
              >
                <Filter size={18} />
              </button>
            </div>

            {showFilters && (
              <div style={{ display: 'flex', gap: '15px', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Extensión:</span>
                  <select value={filterExt} onChange={(e) => setFilterExt(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Categoría:</span>
                  <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="all">Todas</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Tamaño:</span>
                  <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="all">Todos</option>
                    <option value="small">Pequeño (&lt; 1MB)</option>
                    <option value="medium">Mediano (1MB - 5MB)</option>
                    <option value="large">Grande (&gt; 5MB)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {userRole !== 'lector' && (
            <div className="header-actions" style={{ marginLeft: '20px' }}>
              <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={18} style={{ marginRight: '8px' }} />
                Subir Archivo
              </button>
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileInput} multiple />
            </div>
          )}
        </header>

        {vista === 'dashboard' && (
          <div className="view-container">
            <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2>Bienvenido, {displayName}</h2>
                <p>Aquí tienes un resumen de tu actividad reciente.</p>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: userRole === 'admin' ? 'rgba(79, 140, 255, 0.1)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${userRole === 'admin' ? 'rgba(79, 140, 255, 0.3)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                padding: '8px 16px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600
              }}>
                {userRole === 'admin' ? <Shield size={18} color="var(--accent-blue)" /> : userRole === 'colaborador' ? <User size={18} color="var(--accent-green)" /> : <Eye size={18} color="var(--text-secondary)" />}
                Vista de {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </div>
            </div>

            {userRole !== 'lector' ? (
              <div
                className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-wrapper">
                  {uploading ? <RefreshCcw size={32} className="spin-icon" color="var(--accent-blue)" /> : <Inbox size={32} color="var(--text-muted)" />}
                </div>
                <h3>{uploading ? 'Subiendo archivos...' : 'Sube un archivo a tu espacio'}</h3>
                <p>Arrastra y suelta tus archivos aquí o haz clic para explorar</p>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '24px', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Eye size={32} style={{ opacity: 0.5, marginBottom: '10px' }} />
                <h3>Modo de Lectura Activo</h3>
                <p style={{ fontSize: '14px' }}>Tienes acceso para visualizar y descargar documentos de forma segura sin modificar datos.</p>
              </div>
            )}
          </div>
        )}

        {vista === 'archivos' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Mis Archivos</h2>
              <p>Gestiona todos tus documentos ({filteredFiles.length} resultados)</p>
            </div>

            <div className="files-grid">
              {filteredFiles.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-icon"><FileText size={24} color="var(--accent-blue)" /></div>
                  <div className="file-info">
                    <h4>{file.name}</h4>
                    <p>{formatFileSize(file.size)} • {formatDate(file.modified)}</p>
                    {/* Control de Categorías */}
                    {userRole !== 'lector' ? (
                      <select
                        value={file.categoria || 'General'}
                        onChange={(e) => cambiarCategoriaArchivo(file.name, e.target.value)}
                        style={{ marginTop: '8px', background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', outline: 'none' }}
                      >
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', color: 'var(--accent-blue)' }}>📂 {file.categoria || 'General'}</span>
                    )}
                  </div>
                  <div className="file-actions">
                    <button className="btn-icon" title="Descargar" onClick={() => { registrarAuditoria('Descargó el archivo', file.name); alert('Iniciando descarga simulada...'); }}><Download size={16} /></button>
                    {userRole !== 'lector' && (
                      <button className="btn-icon danger" title="Mover a papelera" onClick={() => moverAPapelera(file.name)}><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              ))}
              {filteredFiles.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>No se encontraron archivos.</div>
              )}
            </div>
          </div>
        )}

        {/* --- NUEVA VISTA: PAPELERA DE RECICLAJE --- */}
        {vista === 'papelera' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Papelera de Reciclaje</h2>
              <p>Restaurar o eliminar permanentemente tus documentos ({papelera.length} resultados).</p>
            </div>
            <div className="files-grid">
              {papelera.map((file, index) => (
                <div key={index} className="file-card" style={{ opacity: 0.8 }}>
                  <div className="file-icon"><Trash2 size={24} color="var(--text-muted)" /></div>
                  <div className="file-info">
                    <h4 style={{ textDecoration: 'line-through' }}>{file.name}</h4>
                    <p>{formatFileSize(file.size)} • 📂 {file.categoria || 'General'}</p>
                  </div>
                  <div className="file-actions">
                    <button className="btn-icon" title="Restaurar" onClick={() => restaurarArchivo(file.name)}>
                      <RotateCcw size={16} color="var(--accent-green)" />
                    </button>
                    <button className="btn-icon danger" title="Eliminar definitivamente" onClick={() => eliminarDefinitivo(file.name)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {papelera.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>La papelera está vacía.</div>
              )}
            </div>
          </div>
        )}

        {/* --- NUEVA VISTA: CATEGORÍAS (ADMIN) --- */}
        {vista === 'categorias' && userRole === 'admin' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Gestión de Categorías</h2>
              <p>Añade nuevas categorías para la clasificación de los documentos.</p>
            </div>

            <form onSubmit={agregarCategoria} style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
              <input
                type="text"
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
                placeholder="Escribe una nueva categoría..."
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'var(--bg-input)', color: '#fff', flex: 1, outline: 'none' }}
                required
              />
              <button type="submit" className="btn-primary" style={{ height: '44px' }}>Añadir</button>
            </form>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {categorias.map(cat => (
                <div key={cat} style={{ padding: '10px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-card)', borderRadius: '20px', color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bookmark size={16} color="var(--accent-blue)" /> {cat}
                </div>
              ))}
            </div>
          </div>
        )}

        {vista === 'usuarios' && userRole === 'admin' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Gestión de Usuarios</h2>
              <p>Administra los roles y niveles de acceso del sistema</p>
            </div>
            <div className="files-grid" style={{ display: 'block' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)' }}>
                    <th style={{ padding: '15px' }}>Nombre</th>
                    <th style={{ padding: '15px' }}>Correo Electrónico</th>
                    <th style={{ padding: '15px' }}>Rol Actual</th>
                    <th style={{ padding: '15px' }}>Cambiar a</th>
                  </tr>
                </thead>
                <tbody>
                  {listaUsuarios.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '15px', fontWeight: 500 }}>{u.nombre}</td>
                      <td style={{ padding: '15px', color: 'var(--text-secondary)' }}>{u.correo}</td>
                      <td style={{ padding: '15px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: u.rol === 'admin' ? 'rgba(79, 140, 255, 0.15)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.rol === 'admin' ? '#4f8cff' : u.rol === 'colaborador' ? '#34d399' : '#8b92a8',
                          border: `1px solid ${u.rol === 'admin' ? 'rgba(79, 140, 255, 0.3)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>{u.rol}</span>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <select
                          value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value)}
                          disabled={u.id === user?.uid}
                          style={{ background: 'var(--bg-input)', color: u.id === user?.uid ? 'var(--text-muted)' : 'white', border: '1px solid var(--border-card)', padding: '6px 12px', borderRadius: '6px', cursor: u.id === user?.uid ? 'not-allowed' : 'pointer', outline: 'none' }}
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

        {vista === 'historial' && userRole === 'admin' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Historial y Auditoría</h2>
              <p>Trazabilidad de todos los cambios realizados en el sistema.</p>
            </div>
            <div className="files-grid" style={{ display: 'block', overflow: 'hidden', padding: 0 }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'var(--bg-secondary)' }}>
                    <th style={{ padding: '15px' }}>Fecha</th>
                    <th style={{ padding: '15px' }}>Usuario</th>
                    <th style={{ padding: '15px' }}>Acción</th>
                    <th style={{ padding: '15px' }}>Documento / Recurso</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '15px', color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(log.fecha)}</td>
                      <td style={{ padding: '15px', fontWeight: 500 }}>{log.usuario}</td>
                      <td style={{ padding: '15px' }}>
                        <span style={{ color: log.accion.includes('Eliminó') ? '#f87171' : log.accion.includes('Subió') ? '#34d399' : 'var(--text-secondary)' }}>
                          {log.accion}
                        </span>
                      </td>
                      <td style={{ padding: '15px', color: 'var(--accent-blue)' }}>{log.documento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- CONFIGURACIÓN DE PERFIL INTACTA --- */}
        {vista === 'configuracion' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Configuración de Cuenta</h2>
              <p>Administra tu información personal y seguridad</p>
            </div>
            <div className="settings-container">
              <div className="settings-tabs">
                <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><User size={18} /> Información Personal</button>
                <button className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`} onClick={() => setActiveTab('security')}><Lock size={18} /> Seguridad</button>
              </div>

              {profileError && <div style={{ color: '#f87171', background: 'rgba(248, 113, 113, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px', marginTop: '15px' }}>{profileError}</div>}
              {profileSuccess && <div style={{ color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', padding: '10px', borderRadius: '4px', marginBottom: '15px', marginTop: '15px' }}>{profileSuccess}</div>}

              <form className="settings-content" onSubmit={activeTab === 'profile' ? handleProfileUpdate : handlePasswordUpdate}>
                {activeTab === 'profile' ? (
                  <div className="settings-form">
                    <div className="input-group">
                      <label>Nombre a mostrar</label>
                      <div className="input-wrapper"><User size={18} /><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /></div>
                    </div>
                    <div className="input-group">
                      <label>Correo electrónico</label>
                      <div className="input-wrapper"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                    </div>
                    {(email !== auth.currentUser?.email) && (
                      <div className="input-group">
                        <label style={{ color: 'var(--accent-amber)' }}>Contraseña Actual Requerida (para cambios de correo)</label>
                        <div className="input-wrapper"><Lock size={18} /><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="settings-form">
                    <div className="input-group">
                      <label>Contraseña Actual</label>
                      <div className="input-wrapper"><Lock size={18} /><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
                    </div>
                    <div className="input-group">
                      <label>Nueva Contraseña</label>
                      <div className="input-wrapper"><Lock size={18} /><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
                    </div>
                  </div>
                )}
                <button type="submit" className="btn-save"><Save size={16} /> Guardar Cambios</button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ===== GITHUB WIDGET ORIGINAL INTACTO ===== */}
      <div onClick={loading ? undefined : checkGithub} className={`github-widget ${status?.connected ? 'connected' : 'disconnected'}`}>
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