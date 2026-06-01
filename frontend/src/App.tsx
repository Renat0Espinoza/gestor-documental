// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase'; // Importamos db para Firestore
import {
  updateProfile, updateEmail, updatePassword, onAuthStateChanged,
  EmailAuthProvider, reauthenticateWithCredential, signOut
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Para obtener el rol del usuario

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

type Vista = 'dashboard' | 'settings';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null); // HU: Estado para el rol
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para ajustes de perfil
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [updateMsg, setUpdateMsg] = useState({ type: '', text: '' });

  // HU: Verificar autenticación y obtener Rol desde Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setNewName(currentUser.displayName || '');
        setNewEmail(currentUser.email || '');

        // Consultar el rol en la colección 'usuarios'
        try {
          const docRef = doc(db, "usuarios", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().rol);
          } else {
            setUserRole('user'); // Por defecto si no existe el doc
          }
        } catch (e) {
          console.error("Error obteniendo rol:", e);
          setUserRole('user');
        }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/files');
      setFiles(res.data);
    } catch (err) {
      console.error("Error al obtener archivos", err);
    }
  };

  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3001/api/github-status');
      setStatus(res.data);
    } catch (err) {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFiles();
      checkGithub();
    }
  }, [user]);

  const handleLogout = () => signOut(auth);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);

    try {
      await axios.post('http://localhost:3001/api/upload', formData);
      fetchFiles();
    } catch (err) {
      alert("Error al subir archivo");
    }
  };

  // HU: Lógica de eliminación (Solo Admin)
  const handleDelete = async (fileName: string) => {
    if (userRole !== 'admin') return;
    if (!confirm(`¿Estás seguro de eliminar ${fileName}?`)) return;
    try {
      await axios.delete(`http://localhost:3001/api/files/${fileName}`);
      fetchFiles();
    } catch (err) {
      alert("Error al eliminar");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMsg({ type: '', text: '' });
    try {
      if (newName !== user.displayName) {
        await updateProfile(user, { displayName: newName });
      }

      if (newEmail !== user.email || newPassword) {
        if (!currentPassword) {
          setUpdateMsg({ type: 'error', text: 'Se requiere contraseña actual para cambios sensibles.' });
          return;
        }
        const credential = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, credential);

        if (newEmail !== user.email) await updateEmail(user, newEmail);
        if (newPassword) await updatePassword(user, newPassword);
      }

      setUpdateMsg({ type: 'success', text: 'Perfil actualizado correctamente.' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setUpdateMsg({ type: 'error', text: err.message });
    }
  };

  if (loadingAuth) return <div className="loading-screen"><RefreshCcw className="spin-icon" /></div>;
  if (!user) return <Login onLoginSuccess={() => { }} />;

  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FolderOpen size={24} /></div>
          <span className="logo-text">Gestor Pro</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${vista === 'dashboard' ? 'active' : ''}`}
            onClick={() => setVista('dashboard')}
          >
            <Inbox size={20} /> <span>Mi Unidad</span>
          </button>
          <button
            className={`nav-item ${vista === 'settings' ? 'active' : ''}`}
            onClick={() => setVista('settings')}
          >
            <Settings size={20} /> <span>Ajustes</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.displayName?.charAt(0) || user.email?.charAt(0)}</div>
            <div className="user-info">
              <span className="user-name">{user.displayName || 'Usuario'}</span>
              <span className="user-role">{userRole === 'admin' ? 'Administrador' : 'Lector'}</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={18} /> <span>Salir</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="content">
        <header className="content-header">
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* HU: Botón de subida solo visible para Administradores */}
          {userRole === 'admin' && (
            <>
              <input type="file" hidden ref={fileInputRef} onChange={handleUpload} />
              <button className="btn-upload" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={18} /> <span>Subir Archivo</span>
              </button>
            </>
          )}
        </header>

        {vista === 'dashboard' ? (
          <div className="dashboard">
            <div className="section-title">
              <h2>Archivos Recientes</h2>
              <span className="count">{filteredFiles.length} documentos</span>
            </div>

            <div className="file-grid">
              {filteredFiles.length > 0 ? (
                filteredFiles.map((file, idx) => (
                  <div key={idx} className="file-card">
                    <div className="file-icon"><FileText size={32} /></div>
                    <div className="file-details">
                      <span className="file-name" title={file.name}>{file.name}</span>
                      <span className="file-meta">{formatFileSize(file.size)} • {formatDate(file.modified)}</span>
                    </div>
                    <div className="file-actions">
                      <button className="action-btn" title="Descargar"><Download size={18} /></button>

                      {/* HU: Icono de papelera solo para Administradores */}
                      {userRole === 'admin' && (
                        <button
                          className="action-btn delete"
                          title="Eliminar"
                          onClick={() => handleDelete(file.name)}
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Inbox size={48} />
                  <p>No se encontraron archivos</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="settings-view">
            <header className="settings-header">
              <button onClick={() => setVista('dashboard')} className="btn-back">
                <ArrowLeft size={18} /> Volver
              </button>
              <h2>Configuración de Perfil</h2>
            </header>

            <div className="settings-card">
              <form onSubmit={handleUpdateProfile} className="settings-form">
                {updateMsg.text && (
                  <div className={`alert ${updateMsg.type}`}>
                    {updateMsg.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {updateMsg.text}
                  </div>
                )}

                <div className="input-group">
                  <label><User size={16} /> Nombre Completo</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tu nombre" />
                </div>

                <div className="input-group">
                  <label><Mail size={16} /> Correo Electrónico</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>

                <div className="input-group">
                  <label><Lock size={16} /> Nueva Contraseña (opcional)</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>

                {(newEmail !== user.email || newPassword) && (
                  <div className="input-group reauth-box">
                    <label>Contraseña Actual</label>
                    <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Confirma para guardar cambios" required />
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