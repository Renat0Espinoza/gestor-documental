import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase';
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

interface FileInfo {
  id?: string;
  name: string;
  size: number;
  modified: string | null;
  categoria?: string;
  estado?: 'activo' | 'eliminado';
  subidoPor?: string;
}

interface UsuarioDB {
  uid: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'colaborador';
}

interface LogAuditoria {
  id?: string;
  accion: string;
  archivo: string;
  usuario: string;
  fecha: string;
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

type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial' | 'papelera';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [usuarioActual, setUsuarioActual] = useState<UsuarioDB | null>(null);
  const [autenticado, setAutenticado] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados generales del sistema
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [usuariosLista, setUsuariosLista] = useState<UsuarioDB[]>([]);
  const [historialLogs, setHistorialLogs] = useState<LogAuditoria[]>([]);
  const [categorias, setCategorias] = useState<string[]>(['General', 'Informes', 'Contratos', 'Facturas']);
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  const [vista, setVista] = useState<Vista>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtros Avanzados
  const [filtroExtension, setFiltroExtension] = useState('');
  const [filtroSizeMin, setFiltroSizeMin] = useState('');
  const [filtroSizeMax, setFiltroSizeMax] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');

  // Perfil e Inputs
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [perfilError, setPerfilError] = useState('');
  const [perfilSuccess, setPerfilSuccess] = useState('');

  // Carga de archivos
  const [selectedCategoria, setSelectedCategoria] = useState('General');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setNewName(currentUser.displayName || '');
        setNewEmail(currentUser.email || '');

        // Cargar el rol del usuario desde Firestore
        const docRef = doc(db, 'usuarios', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUsuarioActual(docSnap.data() as UsuarioDB);
        } else {
          // Fallback por si se creó directo en Auth
          const userObj: UsuarioDB = {
            uid: currentUser.uid,
            nombre: currentUser.displayName || 'Usuario',
            email: currentUser.email || '',
            rol: 'colaborador'
          };
          await setDoc(docRef, userObj);
          setUsuarioActual(userObj);
        }
        setAutenticado(true);
      } else {
        setUser(null);
        setUsuarioActual(null);
        setAutenticado(false);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const registrarLog = async (accion: string, archivo: string) => {
    try {
      await addDoc(collection(db, 'historial'), {
        accion,
        archivo,
        usuario: usuarioActual?.nombre || user?.displayName || user?.email || 'Desconocido',
        fecha: new Date().toISOString()
      });
      cargarHistorial();
    } catch (e) {
      console.error("Error guardando log: ", e);
    }
  };

  const cargarDatosFirestore = async () => {
    if (!autenticado) return;
    try {
      // 1. Cargar Archivos
      const querySnapFiles = await getDocs(collection(db, 'archivos'));
      const dbFiles: FileInfo[] = [];
      querySnapFiles.forEach((d) => {
        dbFiles.push({ id: d.id, ...d.data() } as FileInfo);
      });
      setFiles(dbFiles);

      // 2. Cargar Categorías personalizadas
      const querySnapCat = await getDocs(collection(db, 'categorias'));
      const dbCats: string[] = ['General', 'Informes', 'Contratos', 'Facturas'];
      querySnapCat.forEach((d) => {
        const c = d.data().nombre;
        if (!dbCats.includes(c)) dbCats.push(c);
      });
      setCategorias(dbCats);

      // 3. Cargar Usuarios si es Admin
      if (usuarioActual?.rol === 'admin') {
        const querySnapUsers = await getDocs(collection(db, 'usuarios'));
        const dbUsers: UsuarioDB[] = [];
        querySnapUsers.forEach((d) => {
          dbUsers.push(d.data() as UsuarioDB);
        });
        setUsuariosLista(dbUsers);
      }
    } catch (err) {
      console.error("Error cargando base de datos inicial: ", err);
    }
  };

  const cargarHistorial = async () => {
    if (usuarioActual?.rol !== 'admin') return;
    const querySnap = await getDocs(collection(db, 'historial'));
    const dbLogs: LogAuditoria[] = [];
    querySnap.forEach((d) => {
      dbLogs.push({ id: d.id, ...d.data() } as LogAuditoria);
    });
    // Ordenar por fecha descendente
    dbLogs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    setHistorialLogs(dbLogs);
  };

  useEffect(() => {
    if (autenticado && usuarioActual) {
      checkGithub();
      cargarDatosFirestore();
      if (usuarioActual.rol === 'admin') {
        cargarHistorial();
      }
    }
  }, [autenticado, usuarioActual]);

  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get('https://api.github.com/zen');
      if (res.status === 200) {
        setStatus({ connected: true });
      } else {
        setStatus({ connected: false });
      }
    } catch (error) {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const nuevoArchivo: FileInfo = {
      name: file.name,
      size: file.size,
      modified: new Date().toISOString(),
      categoria: selectedCategoria,
      estado: 'activo',
      subidoPor: usuarioActual?.nombre || user?.displayName || 'Usuario'
    };

    try {
      // Guardar metadatos en Firestore
      await addDoc(collection(db, 'archivos'), nuevoArchivo);
      await registrarLog("Subió un archivo", file.name);
      cargarDatosFirestore();
      alert("Archivo subido con éxito y registrado en su categoría.");
    } catch (error) {
      console.error(error);
      alert("Error al subir metadatos a Firestore");
    }
  };

  // Mover a la papelera en lugar de eliminar por completo
  const handleMoverAPapelera = async (id: string, name: string) => {
    try {
      const docRef = doc(db, 'archivos', id);
      await updateDoc(docRef, { estado: 'eliminado' });
      await registrarLog("Movió a la papelera", name);
      cargarDatosFirestore();
    } catch (error) {
      console.error(error);
    }
  };

  // Restaurar desde la papelera
  const handleRestaurarArchivo = async (id: string, name: string) => {
    try {
      const docRef = doc(db, 'archivos', id);
      await updateDoc(docRef, { estado: 'activo' });
      await registrarLog("Restauró un archivo", name);
      cargarDatosFirestore();
    } catch (error) {
      console.error(error);
    }
  };

  // Eliminación definitiva de Firestore
  const handleEliminarDefinitivo = async (id: string, name: string) => {
    if (window.confirm(`¿Estás completamente seguro de eliminar "${name}" permanentemente? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, 'archivos', id));
        await registrarLog("Eliminó permanentemente", name);
        cargarDatosFirestore();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleCambiarRol = async (uid: string, nuevoRol: 'admin' | 'colaborador') => {
    if (uid === usuarioActual?.uid) {
      alert("No puedes cambiarte el rango a ti mismo.");
      return;
    }
    try {
      const docRef = doc(db, 'usuarios', uid);
      await updateDoc(docRef, { rol: nuevoRol });
      await registrarLog(`Cambió el rol de usuario UID: ${uid}`, `Nuevo rol: ${nuevoRol}`);
      cargarDatosFirestore();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;
    try {
      await addDoc(collection(db, 'categorias'), { nombre: nuevaCategoria.trim() });
      setNuevaCategoria('');
      cargarDatosFirestore();
    } catch (error) {
      console.error(error);
    }
  };

  // Actualizar Configuraciones del perfil
  const handleActualizarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setPerfilError('');
    setPerfilSuccess('');

    try {
      // Si va a cambiar correo o contraseña requiere autenticarse de nuevo obligatoriamente
      if (newEmail !== user.email || newPassword) {
        if (!currentPassword) {
          setPerfilError("Se requiere ingresar la contraseña actual para realizar cambios sensibles de seguridad.");
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(auth, credential);
      }

      // 1. Cambiar Nombre de Perfil
      if (newName !== user.displayName) {
        await updateProfile(auth.currentUser!, { displayName: newName });
        await updateDoc(doc(db, 'usuarios', user.uid), { nombre: newName });
      }

      // 2. Cambiar Email
      if (newEmail !== user.email) {
        await updateEmail(auth.currentUser!, newEmail);
        await updateDoc(doc(db, 'usuarios', user.uid), { email: newEmail });
      }

      // 3. Cambiar Contraseña
      if (newPassword) {
        await updatePassword(auth.currentUser!, newPassword);
      }

      setPerfilSuccess("Datos de perfil y credenciales guardados de forma segura.");
      setCurrentPassword('');
      setNewPassword('');

      // Actualizar estado local
      setUsuarioActual(prev => prev ? { ...prev, nombre: newName, email: newEmail } : null);

    } catch (err: any) {
      console.error(err);
      setPerfilError("Error al actualizar los datos. Verifica tu contraseña actual.");
    }
  };

  const handleCerrarSesion = () => {
    signOut(auth);
  };

  // Filtrado de búsquedas y visualizaciones
  const archivosActivos = files.filter(f => f.estado !== 'eliminado');
  const archivosEliminados = files.filter(f => f.estado === 'eliminado');

  const archivosFiltrados = archivosActivos.filter(f => {
    const cumpleTexto = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const cumpleExt = filtroExtension ? f.name.toLowerCase().endsWith(filtroExtension.toLowerCase()) : true;
    const cumpleCat = filtroCategoria ? f.categoria === filtroCategoria : true;

    const sizeMinNum = filtroSizeMin ? parseFloat(filtroSizeMin) * 1024 * 1024 : 0;
    const sizeMaxNum = filtroSizeMax ? parseFloat(filtroSizeMax) * 1024 * 1024 : Infinity;
    const cumpleSize = f.size >= sizeMinNum && f.size <= sizeMaxNum;

    return cumpleTexto && cumpleExt && cumpleCat && cumpleSize;
  });

  if (loadingAuth) {
    return (
      <div className="loading-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f1117', color: '#fff' }}>
        <RefreshCcw className="spin-icon" size={32} />
      </div>
    );
  }

  if (!autenticado) {
    return <Login onLoginSuccess={() => setAutenticado(true)} />;
  }

  return (
    <div className="app-container">
      {/* MENÚ LATERAL */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Shield size={24} color="var(--accent-blue)" />
          <div>
            <h1>Gestor Documental</h1>
            <span className="user-role-badge">{usuarioActual?.rol.toUpperCase()}</span>
          </div>
        </div>

        <div className="user-profile-section">
          <div className="user-avatar">
            {usuarioActual?.nombre ? usuarioActual.nombre.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{usuarioActual?.nombre || 'Usuario'}</div>
            <div className="user-email">{usuarioActual?.email}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button onClick={() => setVista('dashboard')} className={vista === 'dashboard' ? 'active' : ''}>
            <FolderOpen size={18} /> Dashboard Principal
          </button>
          <button onClick={() => setVista('explorador')} className={vista === 'explorador' ? 'active' : ''}>
            <FileText size={18} /> Explorador de Archivos
          </button>
          <button onClick={() => setVista('busqueda')} className={vista === 'busqueda' ? 'active' : ''}>
            <Search size={18} /> Búsqueda Avanzada
          </button>
          <button onClick={() => setVista('papelera')} className={vista === 'papelera' ? 'active' : ''}>
            <Inbox size={18} /> Papelera de Reciclaje ({archivosEliminados.length})
          </button>
          <button onClick={() => setVista('configuracion')} className={vista === 'configuracion' ? 'active' : ''}>
            <Settings size={18} /> Ajustes de Perfil
          </button>

          {usuarioActual?.rol === 'admin' && (
            <>
              <div className="sidebar-divider">Administración</div>
              <button onClick={() => setVista('usuarios')} className={vista === 'usuarios' ? 'active' : ''}>
                <Users size={18} /> Control de Usuarios
              </button>
              <button onClick={() => setVista('historial')} className={vista === 'historial' ? 'active' : ''}>
                <History size={18} /> Logs de Auditoría
              </button>
            </>
          )}
        </nav>

        <button onClick={handleCerrarSesion} className="btn-logout">
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </aside>

      {/* CONTENIDO CENTRAL */}
      <main className="main-content">

        {/* VISTA: DASHBOARD */}
        {vista === 'dashboard' && (
          <div>
            <div className="view-header">
              <h2>Dashboard Principal</h2>
              <p>Resumen general del almacenamiento seguro de tus documentos.</p>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(79, 140, 255, 0.15)', color: 'var(--accent-blue)' }}><FileText size={22} /></div>
                <div className="stat-value">{archivosActivos.length}</div>
                <div className="stat-label">Documentos Activos</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: 'var(--accent-green)' }}><Inbox size={22} /></div>
                <div className="stat-value">{categorias.length}</div>
                <div className="stat-label">Categorías Creadas</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'var(--accent-amber)' }}><Trash2 size={22} /></div>
                <div className="stat-value">{archivosEliminados.length}</div>
                <div className="stat-label">En Papelera</div>
              </div>
            </div>

            {/* SECCIÓN DE SUBIDA INTEGRADA POR CATEGORÍAS */}
            <div className="dashboard-actions" style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
              <h3>Subir Nuevo Documento</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Asigna una categoría al documento antes de guardarlo de forma centralizada.</p>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label>Selecciona Categoría</label>
                  <select
                    value={selectedCategoria}
                    onChange={(e) => setSelectedCategoria(e.target.value)}
                    style={{ background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border-card)', padding: '10px 14px', borderRadius: 'var(--radius-md)' }}
                  >
                    {categorias.map((cat, index) => (
                      <option key={index} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div style={{ alignSelf: 'flex-end' }}>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} className="btn-save" style={{ margin: 0, height: 42 }}>
                    <UploadCloud size={16} /> Buscar y Subir Archivo
                  </button>
                </div>
              </div>
            </div>

            {/* GESTIÓN DE CATEGORÍAS PARA ADMINISTRADORES */}
            {usuarioActual?.rol === 'admin' && (
              <div style={{ marginTop: 24, padding: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
                <h3>Crear Nuevas Categorías (Panel Admin)</h3>
                <form onSubmit={handleCrearCategoria} style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                  <input
                    type="text"
                    value={nuevaCategoria}
                    onChange={(e) => setNuevaCategoria(e.target.value)}
                    placeholder="Ej. Finanzas, Recursos Humanos..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)', background: 'var(--bg-input)', color: '#fff' }}
                  />
                  <button type="submit" className="btn-save" style={{ margin: 0 }}>Añadir Categoría</button>
                </form>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  {categorias.map((c, i) => (
                    <span key={i} style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-card)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: 13, color: 'var(--text-primary)' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VISTA: EXPLORADOR */}
        {vista === 'explorador' && (
          <div>
            <div className="view-header">
              <h2>Explorador de Archivos</h2>
              <p>Listado general de todos los documentos activos en la organización.</p>
            </div>

            <div className="table-container">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Nombre del Archivo</th>
                    <th>Categoría</th>
                    <th>Tamaño</th>
                    <th>Subido Por</th>
                    <th>Fecha de Modificación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {archivosActivos.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        No hay archivos disponibles en el explorador.
                      </td>
                    </tr>
                  ) : (
                    archivosActivos.map((file) => (
                      <tr key={file.id}>
                        <td className="file-name-cell">
                          <FileText size={18} color="var(--accent-blue)" />
                          <span>{file.name}</span>
                        </td>
                        <td>
                          <span style={{ padding: '4px 8px', background: 'var(--bg-glass)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
                            {file.categoria || 'General'}
                          </span>
                        </td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{file.subidoPor || 'Sistema'}</td>
                        <td>{formatDate(file.modified)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="action-btn" title="Descargar" onClick={() => alert(`Simulando descarga del archivo: ${file.name}`)}>
                              <Download size={15} />
                            </button>
                            <button className="action-btn delete" title="Mover a Papelera" onClick={() => handleMoverAPapelera(file.id!, file.name)}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: BÚSQUEDA AVANZADA */}
        {vista === 'busqueda' && (
          <div>
            <div className="view-header">
              <h2>Búsqueda Avanzada</h2>
              <p>Utiliza filtros detallados de extensión, peso y clasificación para localizar documentos.</p>
            </div>

            {/* PANEL DE FILTROS AVANZADOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', marginBottom: 20 }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label>Nombre del Documento</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar texto..."
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Extensión (Ej: pdf, docx)</label>
                <input
                  type="text"
                  value={filtroExtension}
                  onChange={(e) => setFiltroExtension(e.target.value)}
                  placeholder="pdf, png, xlsx..."
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Categoría</label>
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} style={{ background: 'var(--bg-input)', color: '#fff', border: '1px solid var(--border-card)', padding: '10px', borderRadius: 'var(--radius-md)' }}>
                  <option value="">Todas</option>
                  {categorias.map((c, i) => <option key={i} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Tamaño Mínimo (MB)</label>
                <input
                  type="number"
                  value={filtroSizeMin}
                  onChange={(e) => setFiltroSizeMin(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label>Tamaño Máximo (MB)</label>
                <input
                  type="number"
                  value={filtroSizeMax}
                  onChange={(e) => setFiltroSizeMax(e.target.value)}
                  placeholder="Sin límite"
                />
              </div>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className="table-container">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Tamaño</th>
                    <th>Modificado</th>
                  </tr>
                </thead>
                <tbody>
                  {archivosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                        Ningún archivo coincide con los criterios de búsqueda avanzada.
                      </td>
                    </tr>
                  ) : (
                    archivosFiltrados.map((file) => (
                      <tr key={file.id}>
                        <td className="file-name-cell">
                          <FileText size={18} color="var(--accent-blue)" />
                          <span>{file.name}</span>
                        </td>
                        <td>{file.categoria || 'General'}</td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{formatDate(file.modified)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: PAPELERA DE RECICLAJE */}
        {vista === 'papelera' && (
          <div>
            <div className="view-header">
              <h2>Papelera de Reciclaje</h2>
              <p>Aquí se encuentran los archivos borrados de manera temporal. Puedes restaurarlos o eliminarlos permanentemente.</p>
            </div>

            <div className="table-container">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Nombre del Archivo</th>
                    <th>Categoría</th>
                    <th>Tamaño</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {archivosEliminados.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                        La papelera está vacía.
                      </td>
                    </tr>
                  ) : (
                    archivosEliminados.map((file) => (
                      <tr key={file.id}>
                        <td className="file-name-cell">
                          <Trash2 size={18} color="var(--text-muted)" />
                          <span>{file.name}</span>
                        </td>
                        <td>{file.categoria || 'General'}</td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="action-btn" title="Restaurar Archivo" onClick={() => handleRestaurarArchivo(file.id!, file.name)}>
                              <RefreshCcw size={14} />
                            </button>
                            <button className="action-btn delete" title="Eliminar Definitivamente" onClick={() => handleEliminarDefinitivo(file.id!, file.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: CONFIGURACIÓN / AJUSTES DE PERFIL */}
        {vista === 'configuracion' && (
          <div>
            <div className="view-header">
              <h2>Ajustes del Perfil de Usuario</h2>
              <p>Mantén tus datos y contraseñas de acceso al sistema actualizados de forma segura.</p>
            </div>

            <div className="card" style={{ maxWidth: '600px', background: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
              {perfilError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{perfilError}</div>}
              {perfilSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>{perfilSuccess}</div>}

              <form onSubmit={handleActualizarPerfil}>
                <div className="input-group">
                  <label>Nombre Completo</label>
                  <div className="input-wrapper">
                    <User size={18} />
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Correo Electrónico de Acceso</label>
                  <div className="input-wrapper">
                    <Mail size={18} />
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label>Nueva Contraseña (Dejar en blanco si no deseas cambiarla)</label>
                  <div className="input-wrapper">
                    <Lock size={18} />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>

                {/* Confirmación obligatoria con contraseña actual para cambios de Email/Pass */}
                {(newEmail !== user.email || newPassword) && (
                  <div className="input-group" style={{ borderTop: '1px solid var(--border-card)', paddingTop: '16px', marginTop: '16px' }}>
                    <label style={{ color: 'var(--accent-amber)' }}>Contraseña Actual Requerida</label>
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

        {/* VISTA: CONTROL DE USUARIOS (ADMIN) */}
        {vista === 'usuarios' && usuarioActual?.rol === 'admin' && (
          <div>
            <div className="view-header">
              <h2>Control de Usuarios y Permisos</h2>
              <p>Visualiza a los miembros y gestiona sus roles dentro del gestor.</p>
            </div>

            <div className="table-container">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Nombre Completo</th>
                    <th>Correo Electrónico</th>
                    <th>UID del Sistema</th>
                    <th>Rango / Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosLista.map((u) => (
                    <tr key={u.uid}>
                      <td style={{ fontWeight: 600 }}>{u.nombre}</td>
                      <td>{u.email}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{u.uid}</td>
                      <td>
                        <select
                          value={u.rol}
                          disabled={u.uid === usuarioActual?.uid}
                          onChange={(e) => handleCambiarRol(u.uid, e.target.value as 'admin' | 'colaborador')}
                          style={{
                            background: u.uid === usuarioActual?.uid ? 'var(--bg-glass)' : 'var(--bg-input)',
                            color: u.uid === usuarioActual?.uid ? 'var(--text-muted)' : '#fff',
                            border: '1px solid var(--border-card)',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-md)',
                            cursor: u.uid === usuarioActual?.uid ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <option value="colaborador">Colaborador</option>
                          <option value="admin">Administrador</option>
                        </select>
                        {u.uid === usuarioActual?.uid && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', block显示: 'block', marginTop: 4 }}>
                            (Tú mismo - Bloqueado)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA: HISTORIAL LOGS (ADMIN) */}
        {vista === 'historial' && usuarioActual?.rol === 'admin' && (
          <div>
            <div className="view-header">
              <h2>Logs de Auditoría</h2>
              <p>Historial y registro en tiempo real de eventos realizados en la plataforma.</p>
            </div>

            <div className="table-container">
              <table className="files-table">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Documento / Detalle</th>
                    <th>Usuario Responsable</th>
                    <th>Fecha del Suceso</th>
                  </tr>
                </thead>
                <tbody>
                  {historialLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
                        No se registran eventos de auditoría todavía.
                      </td>
                    </tr>
                  ) : (
                    historialLogs.map((log) => (
                      <tr key={log.id}>
                        <td style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{log.accion}</td>
                        <td>{log.archivo}</td>
                        <td>{log.usuario}</td>
                        <td>{formatDate(log.fecha)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* COMPONENTE INTERNO DEL WIDGET GITHUB */}
      <div
        onClick={loading ? undefined : checkGithub}
        className={`github-widget ${status?.connected ? 'connected' : 'disconnected'}`}
      >
        <Server size={20} color={status?.connected ? '#34d399' : '#f87171'} />
        <div>
          <div className="github-label">GitHub Actions</div>
          <div className={`github-status ${status?.connected ? 'ok' : 'fail'}`}>\
            {loading ? 'Consultando...' : status?.connected ? 'Conectado' : 'Desconectado'}
          </div>
        </div>
        <RefreshCcw size={14} color="var(--text-muted)" className={loading ? 'spin-icon' : ''} style={{ marginLeft: 8 }} />
      </div>
    </div>
  );
}