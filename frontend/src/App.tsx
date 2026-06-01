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
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';

interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
}

interface UsuarioInfo {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'usuario';
  fechaCreacion?: string;
}

interface HistorialInfo {
  id: string;
  usuario: string;
  accion: string;
  detalles: string;
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

type Vista = 'dashboard' | 'papelera' | 'usuarios' | 'historial' | 'configuracion';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userRol, setUserRol] = useState<'admin' | 'usuario'>('usuario');
  const [vista, setVista] = useState<Vista>('dashboard');

  // Estados de archivos
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<FileInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados de Admin
  const [usuarios, setUsuarios] = useState<UsuarioInfo[]>([]);
  const [historial, setHistorial] = useState<HistorialInfo[]>([]);

  // Estados de Configuración de Perfil
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Estado del widget de GitHub
  const [status, setStatus] = useState<{ connected: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Escuchar estado de autenticación y cargar rol de Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setDisplayName(user.displayName || '');
        setEmail(user.email || '');

        try {
          const docRef = doc(db, 'usuarios', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRol(docSnap.data().rol || 'usuario');
          }
        } catch (e) {
          console.error("Error al obtener rol del usuario:", e);
        }
      } else {
        setIsAuthenticated(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Consultar estado de GitHub Actions API local
  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3000/api/github-status');
      setStatus(res.data);
    } catch (err) {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkGithub();
      cargarDatosSimulados();
    }
  }, [isAuthenticated]);

  const cargarDatosSimulados = () => {
    // Archivos activos de prueba
    setFiles([
      { name: 'Planificacion_Presupuesto_2026.pdf', size: 2450000, modified: new Date().toISOString() },
      { name: 'Manual_Procedimientos_Sistemas.docx', size: 1240000, modified: new Date(Date.now() - 86400000).toISOString() },
      { name: 'Logo_Empresa_AltaResolucion.png', size: 5400000, modified: new Date(Date.now() - 172800000).toISOString() }
    ]);

    // Papelera de reciclaje vacía inicialmente
    setDeletedFiles([]);

    // Usuarios del sistema para vista Admin
    setUsuarios([
      { id: '1', nombre: 'Carlos Mendoza', email: 'carlos@empresa.com', rol: 'admin', fechaCreacion: '2025-03-15T10:00:00Z' },
      { id: '2', nombre: 'Ana María Silva', email: 'ana.silva@empresa.com', rol: 'usuario', fechaCreacion: '2025-06-20T14:30:00Z' }
    ]);

    // Historial para vista Admin
    setHistorial([
      { id: 'h1', usuario: 'Carlos Mendoza', accion: 'Subida', detalles: 'Planificacion_Presupuesto_2026.pdf', fecha: new Date().toISOString() },
      { id: 'h2', usuario: 'Ana María Silva', accion: 'Descarga', detalles: 'Manual_Procedimientos_Sistemas.docx', fecha: new Date(Date.now() - 3600000).toISOString() }
    ]);
  };

  // Manejadores de Archivos
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const nuevoFile = e.target.files[0];
      const yaExiste = files.some(f => f.name === nuevoFile.name);

      if (yaExiste) {
        alert('Ya existe un archivo con ese nombre.');
        return;
      }

      const fileInfo: FileInfo = {
        name: nuevoFile.name,
        size: nuevoFile.size,
        modified: new Date().toISOString()
      };
      setFiles([fileInfo, ...files]);

      // Registrar en historial si somos admin o guardamos local
      const nuevoLog: HistorialInfo = {
        id: 'h_' + Date.now(),
        usuario: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuario',
        accion: 'Subida',
        detalles: nuevoFile.name,
        fecha: new Date().toISOString()
      };
      setHistorial([nuevoLog, ...historial]);
    }
  };

  const moverAPapelera = (name: string) => {
    const file = files.find(f => f.name === name);
    if (file) {
      setFiles(files.filter(f => f.name !== name));
      setDeletedFiles([file, ...deletedFiles]);
    }
  };

  const restaurarArchivo = (name: string) => {
    const file = deletedFiles.find(f => f.name === name);
    if (file) {
      setDeletedFiles(deletedFiles.filter(f => f.name !== name));
      setFiles([file, ...files]);
    }
  };

  const eliminarPermanente = (name: string) => {
    setDeletedFiles(deletedFiles.filter(f => f.name !== name));
  };

  // Guardar Cambios del Perfil
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    const user = auth.currentUser;
    if (!user) return;

    try {
      // Reautenticar si se cambia email o contraseña
      if ((email !== user.email || newPassword) && !currentPassword) {
        setProfileError('Se requiere tu contraseña actual para realizar cambios críticos de cuenta.');
        return;
      }

      if (currentPassword) {
        const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
        // Sincronizar en Firestore
        await updateDoc(doc(db, 'usuarios', user.uid), { nombre: displayName });
      }

      if (email !== user.email && email) {
        await updateEmail(user, email);
        await updateDoc(doc(db, 'usuarios', user.uid), { email });
      }

      if (newPassword) {
        await updatePassword(user, newPassword);
      }

      setProfileSuccess('¡Perfil actualizado con éxito!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      console.error(err);
      setProfileError('Error al actualizar: Contraseña incorrecta o formato inválido.');
    }
  };

  const cambiarRolUsuario = async (id: string, nuevoRol: 'admin' | 'usuario') => {
    setUsuarios(usuarios.map(u => u.id === id ? { ...u, rol: nuevoRol } : u));
    // Si fuera producción real, actualizaríamos el documento en Firestore usando el id del usuario
  };

  const handleLogout = () => signOut(auth);

  if (isAuthenticated === null) {
    return (
      <div className="loading-screen">
        <RefreshCcw className="spin-icon" size={40} color="var(--accent-blue)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <FolderOpen size={24} color="var(--accent-blue)" />
          <span>MiGestor <span className="badge-role">{userRol}</span></span>
        </div>

        <nav className="sidebar-menu">
          <button className={`menu-item ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => setVista('dashboard')}>
            <FolderOpen size={18} /> Mis Archivos
          </button>
          <button className={`menu-item ${vista === 'papelera' ? 'active' : ''}`} onClick={() => setVista('papelera')}>
            <Inbox size={18} /> Papelera
          </button>

          {userRol === 'admin' && (
            <>
              <div className="menu-divider">Administración</div>
              <button className={`menu-item ${vista === 'usuarios' ? 'active' : ''}`} onClick={() => setVista('usuarios')}>
                <Users size={18} /> Usuarios
              </button>
              <button className={`menu-item ${vista === 'historial' ? 'active' : ''}`} onClick={() => setVista('historial')}>
                <History size={18} /> Historial de Auditoría
              </button>
            </>
          )}

          <div className="menu-divider">Usuario</div>
          <button className={`menu-item ${vista === 'configuracion' ? 'active' : ''}`} onClick={() => setVista('configuracion')}>
            <Settings size={18} /> Mi Perfil
          </button>
          <button className="menu-item logout" onClick={handleLogout}>
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </nav>
      </aside>

      {/* CUERPO PRINCIPAL */}
      <main className="main-content">
        <header className="content-header">
          <div>
            <h1>
              {vista === 'dashboard' && 'Mis Archivos'}
              {vista === 'papelera' && 'Papelera de Reciclaje'}
              {vista === 'usuarios' && 'Gestión de Usuarios'}
              {vista === 'historial' && 'Historial de Auditoría Global'}
              {vista === 'configuracion' && 'Configuración de Mi Cuenta'}
            </h1>
            <p className="subtitle">Bienvenido, {auth.currentUser?.displayName || auth.currentUser?.email}</p>
          </div>
        </header>

        {/* CONTENIDO INTERNO SEGÚN LA VISTA */}
        {vista === 'dashboard' && (
          <div className="view-card animate-fade">
            <div className="action-bar">
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Buscar archivos por nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button className="btn-primary" onClick={handleUploadClick}>
                <UploadCloud size={18} /> Subir Archivo
              </button>
            </div>

            <div className="table-responsive">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Nombre del Archivo</th>
                    <th>Tamaño</th>
                    <th>Modificado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No se encontraron archivos en este directorio.
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((file, idx) => (
                      <tr key={idx}>
                        <td className="file-name-cell">
                          <FileText size={20} color="var(--accent-blue)" />
                          <span>{file.name}</span>
                        </td>
                        <td>{formatFileSize(file.size)}</td>
                        <td>{formatDate(file.modified)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions">
                            <button className="icon-button" title="Descargar" onClick={() => alert(`Descargando de manera simulada: ${file.name}`)}>
                              <Download size={16} />
                            </button>
                            <button className="icon-button delete" title="Mover a papelera" onClick={() => moverAPapelera(file.name)}>
                              <Trash2 size={16} />
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

        {vista === 'papelera' && (
          <div className="view-card animate-fade">
            <div className="table-responsive">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Archivo Eliminado</th>
                    <th>Tamaño</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedFiles.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        La papelera está vacía.
                      </td>
                    </tr>
                  ) : (
                    deletedFiles.map((file, idx) => (
                      <tr key={idx}>
                        <td className="file-name-cell">
                          <FileText size={20} color="var(--text-muted)" />
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{file.name}</span>
                        </td>
                        <td>{formatFileSize(file.size)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions">
                            <button className="icon-button" title="Restaurar" onClick={() => restaurarArchivo(file.name)}>
                              <ArrowLeft size={16} />
                            </button>
                            <button className="icon-button delete" title="Eliminar definitivamente" onClick={() => eliminarPermanente(file.name)}>
                              <Trash2 size={16} />
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

        {vista === 'usuarios' && userRol === 'admin' && (
          <div className="view-card animate-fade">
            <div className="table-responsive">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol actual</th>
                    <th style={{ textAlign: 'right' }}>Cambiar Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => (
                    <tr key={u.id}>
                      <td className="file-name-cell">
                        <User size={18} />
                        <strong>{u.nombre}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`badge-role ${u.rol}`}>
                          {u.rol === 'admin' ? <Shield size={12} style={{ marginRight: 4 }} /> : null}
                          {u.rol.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <select
                          className="select-role"
                          value={u.rol}
                          onChange={(e) => cambiarRolUsuario(u.id, e.target.value as 'admin' | 'usuario')}
                        >
                          <option value="usuario">Usuario Estándar</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === 'historial' && userRol === 'admin' && (
          <div className="view-card animate-fade">
            <div className="table-responsive">
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Fecha/Hora</th>
                    <th>Operador</th>
                    <th>Acción</th>
                    <th>Elemento / Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h) => (
                    <tr key={h.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{formatDate(h.fecha)}</td>
                      <td><strong>{h.usuario}</strong></td>
                      <td>
                        <span className={`badge-action ${h.accion.toLowerCase()}`}>
                          {h.accion}
                        </span>
                      </td>
                      <td><code>{h.detalles}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {vista === 'configuracion' && (
          <div className="view-card animate-fade" style={{ maxWidth: '600px' }}>
            <div className="profile-box">
              {profileError && <div className="alert alert-error">{profileError}</div>}
              {profileSuccess && <div className="alert alert-success">{profileSuccess}</div>}

              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label>Nombre Público</label>
                  <div className="input-wrapper">
                    <User size={16} />
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Correo Electrónico de Cuenta</label>
                  <div className="input-wrapper">
                    <Mail size={16} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Nueva Contraseña (Dejar en blanco si no deseas cambiarla)</label>
                  <div className="input-wrapper">
                    <Lock size={16} />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  </div>
                </div>

                {(email !== auth.currentUser?.email || newPassword) && (
                  <div className="form-group alert-confirm-pass">
                    <label style={{ color: 'var(--accent-amber)' }}>Confirma tu Contraseña Actual para guardar cambios</label>
                    <div className="input-wrapper">
                      <Lock size={16} />
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

                <button type="submit" className="btn-save" style={{ marginTop: '10px' }}>
                  <Save size={16} /> Guardar Cambios de Perfil
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* WIDGET DE GITHUB ACTIONS */}
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