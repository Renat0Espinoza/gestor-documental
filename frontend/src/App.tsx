// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock, Filter, ShieldAlert, Eye
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase';
import {
  updateProfile, updateEmail, updatePassword, onAuthStateChanged,
  EmailAuthProvider, reauthenticateWithCredential, signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

type Vista = 'dashboard' | 'settings' | 'history';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'colaborador' | 'lector' | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [vista, setVista] = useState<Vista>('dashboard');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // HU1: Filtros de búsqueda avanzados
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filterExtension, setFilterExtension] = useState('all');
  const [filterSize, setFilterSize] = useState('all');

  // HU2: Mock de lista de usuarios para el panel de administración
  const [usersList, setUsersList] = useState([
    { uid: 'user-1', nombre: 'Carlos Mendoza', email: 'c.mendoza@gestorpro.cl', rol: 'admin' },
    { uid: 'user-2', nombre: 'Ana María Silva', email: 'a.silva@gestorpro.cl', rol: 'colaborador' },
    { uid: 'user-3', nombre: 'Pedro Balmaceda', email: 'p.balmaceda@gestorpro.cl', rol: 'lector' }
  ]);

  // HU4: Registro del historial de cambios (Auditoría)
  const [historyLogs, setHistoryLogs] = useState([
    { id: 1, usuario: 'Carlos Mendoza', accion: 'Subió el archivo', documento: 'Especificacion_Requerimientos_V2.pdf', fecha: '30 de may. de 2026, 14:32' },
    { id: 2, usuario: 'Ana María Silva', accion: 'Descargó el archivo', documento: 'Plano_Arquitectura_Final.dwg', fecha: '31 de may. de 2026, 09:15' },
    { id: 3, usuario: 'Carlos Mendoza', accion: 'Cambió rol de Pedro Balmaceda a', documento: 'LECTOR', fecha: '01 de jun. de 2026, 00:02' }
  ]);

  // Ajustes de perfil
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [updateMsg, setUpdateMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setNewName(currentUser.displayName || '');
        setNewEmail(currentUser.email || '');
        try {
          const docRef = doc(db, "usuarios", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserRole(docSnap.data().rol);
          } else {
            const initialRole = currentUser.email?.includes('admin') ? 'admin' : 'colaborador';
            setUserRole(initialRole);
            await setDoc(docRef, { rol: initialRole, email: currentUser.email, nombre: currentUser.displayName || 'Usuario' }, { merge: true });
          }
        } catch (e) {
          console.error("Error asignando rol:", e);
          setUserRole('colaborador');
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
    } catch (err) { console.error(err); }
  };

  const checkGithub = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:3001/api/github-status');
      setStatus(res.data);
    } catch (err) { setStatus({ connected: false }); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user) { fetchFiles(); checkGithub(); } }, [user]);

  const handleLogout = () => signOut(auth);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post('http://localhost:3001/api/upload', formData);
      fetchFiles();
      setHistoryLogs(prev => [{
        id: Date.now(),
        usuario: user?.displayName || user?.email || 'Usuario',
        accion: 'Subió el archivo',
        documento: file.name,
        fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }, ...prev]);
    } catch (err) { alert("Error al subir"); }
  };

  const handleDelete = async (fileName: string) => {
    if (userRole === 'lector') return;
    if (!confirm(`¿Eliminar ${fileName}?`)) return;
    try {
      await axios.delete(`http://localhost:3001/api/files/${fileName}`);
      fetchFiles();
      setHistoryLogs(prev => [{
        id: Date.now(),
        usuario: user?.displayName || user?.email || 'Usuario',
        accion: 'Eliminó el archivo',
        documento: fileName,
        fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }, ...prev]);
    } catch (err) { alert("Error al eliminar"); }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'colaborador' | 'lector') => {
    setUsersList(prev => prev.map(u => u.uid === userId ? { ...u, rol: newRole } : u));
    try {
      const userDocRef = doc(db, "usuarios", userId);
      await setDoc(userDocRef, { rol: newRole }, { merge: true });
      if (user && user.uid === userId) setUserRole(newRole);

      const targetUser = usersList.find(u => u.uid === userId);
      setHistoryLogs(prev => [{
        id: Date.now(),
        usuario: user?.displayName || 'Administrador',
        accion: `Cambió rol de ${targetUser?.nombre || 'Usuario'} a`,
        documento: newRole.toUpperCase(),
        fecha: new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }, ...prev]);
    } catch (err) { console.error(err); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateMsg({ type: '', text: '' });
    try {
      if (newName !== user.displayName) await updateProfile(user, { displayName: newName });
      if (newEmail !== user.email || newPassword) {
        if (!currentPassword) return setUpdateMsg({ type: 'error', text: 'Se requiere contraseña actual' });
        const cred = EmailAuthProvider.credential(user.email!, currentPassword);
        await reauthenticateWithCredential(user, cred);
        if (newEmail !== user.email) await updateEmail(user, newEmail);
        if (newPassword) await updatePassword(user, newPassword);
      }
      setUpdateMsg({ type: 'success', text: 'Perfil actualizado' });
      setCurrentPassword(''); setNewPassword('');
    } catch (err: any) { setUpdateMsg({ type: 'error', text: err.message }); }
  };

  if (loadingAuth) return <div className="loading-screen"><RefreshCcw className="spin-icon" /></div>;
  if (!user) return <Login onLoginSuccess={() => { }} />;

  // HU1: Lógica de Filtro avanzado
  const filteredFiles = files.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesExtension = true;
    if (filterExtension !== 'all') matchesExtension = f.name.toLowerCase().endsWith(`.${filterExtension}`);
    let matchesSize = true;
    if (filterSize !== 'all') {
      if (filterSize === 'small') matchesSize = f.size < 1024 * 1024;
      else if (filterSize === 'medium') matchesSize = f.size >= 1024 * 1024 && f.size <= 10 * 1024 * 1024;
      else if (filterSize === 'large') matchesSize = f.size > 10 * 1024 * 1024;
    }
    return matchesSearch && matchesExtension && matchesSize;
  });

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FolderOpen size={24} /></div>
          <span className="logo-text">Gestor Pro</span>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${vista === 'dashboard' ? 'active' : ''}`} onClick={() => setVista('dashboard')}>
            <Inbox size={20} /> <span>Panel Principal</span>
          </button>
          {userRole === 'admin' && (
            <button className={`nav-item ${vista === 'history' ? 'active' : ''}`} onClick={() => setVista('history')}>
              <FileText size={20} /> <span>Historial / Auditoría</span>
            </button>
          )}
          <button className={`nav-item ${vista === 'settings' ? 'active' : ''}`} onClick={() => setVista('settings')}>
            <Settings size={20} /> <span>Ajustes</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-avatar">{user.displayName?.charAt(0) || user.email?.charAt(0)}</div>
            <div className="user-info">
              <span className="user-name">{user.displayName || 'Usuario'}</span>
              <span className="user-role">
                {userRole === 'admin' ? 'Administrador' : userRole === 'colaborador' ? 'Colaborador' : 'Lector'}
              </span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout"><LogOut size={18} /> <span>Salir</span></button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="content">
        <header className="content-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            <div className="search-bar" style={{ width: '100%' }}>
              <Search size={18} />
              <input type="text" placeholder="Buscar documentos por criterios avanzados..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="action-btn"
                style={{ marginRight: '6px', background: showAdvanced ? 'rgba(79,140,255,0.15)' : 'transparent', color: showAdvanced ? 'var(--accent-blue)' : 'var(--text-secondary)' }}
                title="Filtros Avanzados"
              >
                <Filter size={16} />
              </button>
            </div>

            {showAdvanced && (
              <div style={{ display: 'flex', gap: '16px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Extensión:</span>
                  <select value={filterExtension} onChange={(e) => setFilterExtension(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--text-muted)', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', outline: 'none' }}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
                    <option value="png">.png</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tamaño:</span>
                  <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--text-muted)', borderRadius: '4px', padding: '2px 6px', fontSize: '12px', outline: 'none' }}>
                    <option value="all">Todos</option>
                    <option value="small">Pequeño (&lt; 1 MB)</option>
                    <option value="medium">Mediano (1 MB - 10 MB)</option>
                    <option value="large">Grande (&gt; 10 MB)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* HU3: Oculta por completo el botón de subida en la cabecera si es Lector */}
          {userRole !== 'lector' && (
            <>
              <input type="file" hidden ref={fileInputRef} onChange={handleUpload} />
              <button className="btn-upload" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={18} /> <span>Subir Archivo</span>
              </button>
            </>
          )}
        </header>

        {vista === 'dashboard' ? (
          <div>
            {/* VARIACIÓN DE LA VENTANA PRINCIPAL SEGÚN EL ROL */}

            {/* 1. VENTANA PRINCIPAL PARA EL ADMINISTRADOR */}
            {userRole === 'admin' && (
              <div className="dashboard">
                <div style={{ background: 'rgba(79,140,255,0.06)', border: '1px solid rgba(79,140,255,0.15)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-blue)', marginBottom: '4px', fontWeight: '600' }}>
                    <ShieldAlert size={20} /> Vista de Control de Administrador
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tienes acceso completo de auditoría y puedes revocar o asignar permisos desde el panel lateral de Ajustes.</p>
                </div>

                <div className="section-title">
                  <h2>Gestión Documental Global</h2>
                  <span className="count">{filteredFiles.length} recursos asignados</span>
                </div>
              </div>
            )}

            {/* 2. VENTANA PRINCIPAL PARA EL LECTOR (PROTECCIÓN DE ACCIDENTES) */}
            {userRole === 'lector' && (
              <div className="dashboard">
                <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-green)', marginBottom: '4px', fontWeight: '600' }}>
                    <Eye size={20} /> Modo de Solo Lectura Activado
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Estás explorando el sistema de forma protegida. Puedes consultar y descargar la información sin riesgo de alteración o pérdidas accidentales de datos.</p>
                </div>

                <div className="section-title">
                  <h2>Documentos Disponibles para Revisión</h2>
                  <span className="count">{filteredFiles.length} consultas</span>
                </div>
              </div>
            )}

            {/* 3. VENTANA PRINCIPAL PARA EL COLABORADOR */}
            {userRole === 'colaborador' && (
              <div className="dashboard">
                <div className="section-title">
                  <h2>Mi Unidad de Trabajo</h2>
                  <span className="count">{filteredFiles.length} documentos</span>
                </div>
              </div>
            )}

            {/* GRILLA DE ARCHIVOS (Modifica acciones según rol) */}
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
                      {/* HU3: Oculta el botón de borrado a nivel de tarjeta para el rol Lector */}
                      {userRole !== 'lector' && (
                        <button className="action-btn delete" title="Eliminar" onClick={() => handleDelete(file.name)}><Trash2 size={18} /></button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <Inbox size={48} />
                  <p>No se encontraron documentos bajo los filtros actuales</p>
                </div>
              )}
            </div>
          </div>
        ) : vista === 'history' ? (
          /* VISTA DE HISTORIAL (HU4) */
          <div className="settings-view">
            <header className="settings-header">
              <button onClick={() => setVista('dashboard')} className="btn-back"><ArrowLeft size={18} /> Volver</button>
              <h2>Historial de Cambios</h2>
            </header>
            <div className="settings-card" style={{ padding: '0px', overflowX: 'auto', background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Usuario</th>
                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Acción</th>
                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Documento / Recurso</th>
                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>Fecha y Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '14px 16px', color: 'var(--text-primary)', fontWeight: '500' }}>{log.usuario}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                          background: log.accion.includes('Eliminó') ? 'rgba(248,113,113,0.12)' : log.accion.includes('Subió') ? 'rgba(52,211,153,0.12)' : 'rgba(79,140,255,0.12)',
                          color: log.accion.includes('Eliminó') ? '#f87171' : log.accion.includes('Subió') ? '#34d399' : '#4f8cff'
                        }}>
                          {log.accion}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>{log.documento}</td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-muted)' }}>{log.fecha}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CONFIGURACIÓN */
          <div className="settings-view">
            <header className="settings-header">
              <button onClick={() => setVista('dashboard')} className="btn-back"><ArrowLeft size={18} /> Volver</button>
              <h2>Configuración de Perfil</h2>
            </header>
            <div className="settings-card">
              <form onSubmit={handleUpdateProfile} className="settings-form">
                {updateMsg.text && <div className={`alert ${updateMsg.type}`}>{updateMsg.text}</div>}
                <div className="input-group"><label><User size={16} /> Nombre Completo</label><input value={newName} onChange={(e) => setNewName(e.target.value)} /></div>
                <div className="input-group"><label><Mail size={16} /> Correo Electrónico</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                <div className="input-group"><label><Lock size={16} /> Nueva Contraseña</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
                {(newEmail !== user.email || newPassword) && (
                  <div className="input-group reauth-box"><label>Contraseña Actual</label><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>
                )}
                <button type="submit" className="btn-save"><Save size={16} /> Guardar Cambios</button>
              </form>
            </div>

            {/* HU2: Panel de gestión exclusivo del Admin */}
            {userRole === 'admin' && (
              <div className="settings-card" style={{ marginTop: '24px' }}>
                <h3 style={{ color: 'var(--text-primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                  <User size={18} style={{ color: 'var(--accent-blue)' }} /> Gestión de Permisos y Roles
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                  Asigna privilegios de Colaborador (Edición) o Lector (Solo lectura) para controlar la seguridad del sistema.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {usersList.map((u) => (
                    <div key={u.uid} style={{ display: 'flex', alignItems: 'center', justifyYontent: 'space-between', padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)', fontSize: '14px' }}>{u.nombre}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                      <select
                        value={u.rol}
                        onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--text-muted)', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="admin">Administrador</option>
                        <option value="colaborador">Colaborador</option>
                        <option value="lector">Lector</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* GITHUB ACTIONS WIDGET */}
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
        <RefreshCcw size={14} className={loading ? 'spin-icon' : ''} style={{ marginLeft: 8 }} />
      </div>
    </div>
  );
}