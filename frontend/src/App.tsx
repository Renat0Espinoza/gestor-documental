import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock, Users
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase'; // INYECTADO: db para Firestore
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
// INYECTADO: Funciones de Firestore
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';

interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
}

// INYECTADO: Interfaz para los usuarios de la base de datos
interface UserInfo {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  estado: string;
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

// INYECTADO: Se añadió 'usuarios' a los tipos de vista
type Vista = 'dashboard' | 'archivos' | 'configuracion' | 'perfil' | 'usuarios';

export default function App() {
  const [user, setUser] = useState<any>(null);

  // INYECTADO: Estados para manejar roles y la lista de usuarios
  const [userRole, setUserRole] = useState('lector');
  const [listaUsuarios, setListaUsuarios] = useState<UserInfo[]>([]);

  const [status, setStatus] = useState<{ connected: boolean, message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Estados de Configuración
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const checkGithub = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3000/api/github/status');
      setStatus(response.data);
    } catch (error) {
      setStatus({ connected: false, message: 'No se pudo conectar con el servidor local' });
    }
    setLoading(false);
  };

  useEffect(() => {
    checkGithub();

    // INYECTADO: Modificado para obtener el rol del usuario desde Firestore
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || '');
        setEmail(currentUser.email || '');

        // Obtener rol desde la base de datos
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().rol || 'lector');
          }
        } catch (e) {
          console.error("Error obteniendo rol:", e);
        }

      } else {
        setUser(null);
        setUserRole('lector');
      }
    });

    // Mock initial files
    setFiles([
      { name: 'documento_requisitos_v2.pdf', size: 2450000, modified: new Date().toISOString() },
      { name: 'acta_reunion_cliente.docx', size: 1024000, modified: new Date(Date.now() - 86400000).toISOString() },
      { name: 'presupuesto_2024.xlsx', size: 512000, modified: new Date(Date.now() - 172800000).toISOString() }
    ]);

    return () => unsub();
  }, []);

  // INYECTADO: Función para cargar usuarios si eres admin
  const cargarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users: UserInfo[] = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() } as UserInfo);
      });
      setListaUsuarios(users);
    } catch (err) {
      console.error("Error cargando usuarios:", err);
    }
  };

  // INYECTADO: Función para que el admin cambie los roles
  const cambiarRol = async (id: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { rol: nuevoRol });
      cargarUsuarios(); // Recarga la tabla para ver el cambio instantáneo
    } catch (err) {
      console.error("Error cambiando rol:", err);
      alert("Error al cambiar el rol");
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (newFiles: FileList) => {
    setUploading(true);
    setTimeout(() => {
      const newFilesArray = Array.from(newFiles).map(file => ({
        name: file.name,
        size: file.size,
        modified: new Date().toISOString()
      }));
      setFiles(prev => [...newFilesArray, ...prev]);
      setUploading(false);
      setVista('archivos');
    }, 1500);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    try {
      if (auth.currentUser) {
        if (displayName !== auth.currentUser.displayName) {
          await updateProfile(auth.currentUser, { displayName });
        }
        if (email !== auth.currentUser.email) {
          await updateEmail(auth.currentUser, email);
        }
        setProfileSuccess('Perfil actualizado correctamente');
      }
    } catch (error: any) {
      setProfileError('Error al actualizar el perfil: ' + error.message);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!currentPassword) {
      setProfileError('Debes ingresar tu contraseña actual');
      return;
    }

    try {
      if (auth.currentUser && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setProfileSuccess('Contraseña actualizada correctamente');
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (error: any) {
      setProfileError('Error al actualizar la contraseña: ' + error.message);
    }
  };

  if (!user) {
    return <Login onLoginSuccess={() => { }} />;
  }

  return (
    <div className="app-layout">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon"><FileText size={24} color="#fff" /></div>
          <span>Gestor UBB</span>
        </div>

        <nav className="sidebar-nav">
          <button
            onClick={() => setVista('dashboard')}
            className={`nav-item ${vista === 'dashboard' ? 'active' : ''}`}
          >
            <FolderOpen size={20} />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setVista('archivos')}
            className={`nav-item ${vista === 'archivos' ? 'active' : ''}`}
          >
            <UploadCloud size={20} />
            <span>Mis Archivos</span>
          </button>

          {/* INYECTADO: Botón de gestión de usuarios exclusivo para el admin */}
          {userRole === 'admin' && (
            <button
              onClick={() => { setVista('usuarios'); cargarUsuarios(); }}
              className={`nav-item ${vista === 'usuarios' ? 'active' : ''}`}
            >
              <Users size={20} />
              <span>Gestión de Usuarios</span>
            </button>
          )}

          <div className="nav-divider"></div>
          <button
            onClick={() => { setVista('configuracion'); setActiveTab('profile'); }}
            className={`nav-item ${vista === 'configuracion' ? 'active' : ''}`}
          >
            <Settings size={20} />
            <span>Configuración</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-info" style={{ cursor: 'pointer' }} onClick={() => setVista('perfil')}>
            <div className="user-name">{user.displayName || 'Usuario'}</div>
            {/* INYECTADO: Muestra el rol actual del usuario en la barra lateral */}
            <div className="user-role" style={{ fontSize: '11px', color: '#4f8cff', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
              {userRole}
            </div>
          </div>
          <button onClick={() => auth.signOut()} className="btn-icon" title="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        <header className="main-header">
          <div className="search-bar">
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="Buscar documentos, carpetas o usuarios..." />
          </div>
          <div className="header-actions">
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud size={18} style={{ marginRight: '8px' }} />
              Subir Archivo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileInput}
              multiple
            />
          </div>
        </header>

        {vista === 'dashboard' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Bienvenido, {user.displayName}</h2>
              <p>Aquí tienes un resumen de tu actividad reciente.</p>
            </div>

            <div
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon-wrapper">
                {uploading ? <RefreshCcw size={32} className="spin-icon" color="var(--accent-blue)" /> : <Inbox size={32} color="var(--text-muted)" />}
              </div>
              <h3>{uploading ? 'Subiendo archivos...' : 'Sube un archivo a tu espacio'}</h3>
              <p>Arrastra y suelta tus archivos aquí o haz clic para explorar</p>
            </div>
          </div>
        )}

        {vista === 'archivos' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Mis Archivos</h2>
              <p>Gestiona todos tus documentos subidos</p>
            </div>

            <div className="files-grid">
              {files.map((file, index) => (
                <div key={index} className="file-card">
                  <div className="file-icon">
                    <FileText size={24} color="var(--accent-blue)" />
                  </div>
                  <div className="file-info">
                    <h4>{file.name}</h4>
                    <p>{formatFileSize(file.size)} • {formatDate(file.modified)}</p>
                  </div>
                  <div className="file-actions">
                    <button className="btn-icon" title="Descargar"><Download size={16} /></button>
                    <button className="btn-icon danger" title="Eliminar"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
                  No tienes archivos subidos todavía.
                </div>
              )}
            </div>
          </div>
        )}

        {/* INYECTADO: Vista del Administrador de Usuarios */}
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
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: u.rol === 'admin' ? 'rgba(79, 140, 255, 0.15)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.rol === 'admin' ? '#4f8cff' : u.rol === 'colaborador' ? '#34d399' : '#8b92a8',
                          border: `1px solid ${u.rol === 'admin' ? 'rgba(79, 140, 255, 0.3)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>
                          {u.rol}
                        </span>
                      </td>
                      <td style={{ padding: '15px' }}>
                        <select
                          value={u.rol}
                          onChange={(e) => cambiarRol(u.id, e.target.value)}
                          style={{
                            background: 'var(--bg-input)',
                            color: 'white',
                            border: '1px solid var(--border-card)',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                        >
                          <option value="admin">admin</option>
                          <option value="colaborador">colaborador</option>
                          <option value="lector">lector</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                  {listaUsuarios.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                        Cargando usuarios...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(vista === 'configuracion' || vista === 'perfil') && (
          <div className="view-container">
            <div className="view-header">
              {vista === 'perfil' && (
                <button onClick={() => setVista('dashboard')} className="btn-icon" style={{ marginBottom: '15px' }}>
                  <ArrowLeft size={20} /> Volver
                </button>
              )}
              <h2>{vista === 'perfil' ? 'Mi Perfil' : 'Configuración de Cuenta'}</h2>
              <p>Administra tu información personal y seguridad</p>
            </div>

            <div className="settings-container">
              <div className="settings-tabs">
                <button
                  className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                  onClick={() => setActiveTab('profile')}
                >
                  <User size={18} /> Información Personal
                </button>
                <button
                  className={`tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  <Lock size={18} /> Seguridad
                </button>
              </div>

              <form
                className="settings-content"
                onSubmit={activeTab === 'profile' ? handleProfileUpdate : handlePasswordUpdate}
              >
                {profileSuccess && <div className="login-success" style={{ marginBottom: '20px' }}>{profileSuccess}</div>}
                {profileError && <div className="login-error" style={{ marginBottom: '20px' }}>{profileError}</div>}

                {activeTab === 'profile' ? (
                  <div className="settings-form">
                    <div className="input-group">
                      <label>Nombre a mostrar</label>
                      <div className="input-wrapper">
                        <User size={18} />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Tu nombre completo"
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Correo electrónico</label>
                      <div className="input-wrapper">
                        <Mail size={18} />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tu@correo.com"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="settings-form">
                    <div className="input-group">
                      <label>Nueva Contraseña</label>
                      <div className="input-wrapper">
                        <Lock size={18} />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          required
                        />
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Contraseña Actual (Requerida para confirmar)</label>
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