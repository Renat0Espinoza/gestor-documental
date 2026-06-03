import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye, Phone, Loader2
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase'; // <-- Modificado para incluir db
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore'; // <-- Funciones de Firestore

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

// <-- Modificado: Añadidas las vistas del admin
type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [listaArchivos, setListaArchivos] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);

  // --- NUEVOS ESTADOS (Roles, Filtros y Auditoría) ---
  const [userRole, setUserRole] = useState<'admin' | 'colaborador' | 'lector'>('lector');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterExtension, setFilterExtension] = useState('all');
  const [filterSize, setFilterSize] = useState('all');
  const [usersList, setUsersList] = useState<any[]>([]);
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
  const [phone, setPhone] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // --- Estado de completar perfil (primer inicio de sesión) ---
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

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
    // <-- Modificado a función asíncrona para obtener el rol de Firestore
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setDisplayName(user.displayName || '');
        setIsAuthenticated(true);

        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.rol) {
              setUserRole(data.rol);
            } else {
              setUserRole('lector');
            }
            // Verificar si el perfil está completo
            if (data.perfilCompleto === false || (!data.nombre && !user.displayName)) {
              setShowProfileModal(true);
            } else {
              setShowProfileModal(false);
              // Actualizar displayName desde Firestore si existe
              if (data.nombre) {
                setDisplayName(data.nombre);
              }
              if (data.telefono) {
                setPhone(data.telefono);
              }
            }
          } else {
            setUserRole('lector');
          }
        } catch (error) {
          console.error("Error al obtener rol:", error);
          setUserRole('lector');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- REGISTRO DE AUDITORÍA (HU4) ---
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
      registrarAuditoria('Subió el archivo', response.data.file || file.name); // <-- Registro de subida
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

  // --- LÓGICA FILTROS AVANZADOS (HU1) ---
  const filteredSearchResults = searchResults.filter(f => {
    let matchExt = true;
    if (filterExtension !== 'all') matchExt = f.name.toLowerCase().endsWith(`.${filterExtension}`);

    let matchSize = true;
    if (filterSize !== 'all') {
      if (filterSize === 'small') matchSize = f.size < 1024 * 1024; // < 1MB
      else if (filterSize === 'medium') matchSize = f.size >= 1024 * 1024 && f.size <= 5 * 1024 * 1024; // 1-5MB
      else if (filterSize === 'large') matchSize = f.size > 5 * 1024 * 1024; // > 5MB
    }
    return matchExt && matchSize;
  });

  const handleDownload = (filename: string) => {
    registrarAuditoria('Descargó el archivo', filename); // <-- Registro de descarga
    window.open(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, '_blank');
  };

  const abrirConfiguracion = async () => {
    setNewDisplayName(displayName);
    setNewEmail(auth.currentUser?.email || '');
    setNewPassword('');
    setCurrentPassword('');
    setSettingsSuccess('');
    setSettingsError('');

    if (auth.currentUser) {
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setPhone(data.telefono || '');
          setNewPhone(data.telefono || '');
        }
      } catch (err) {
        console.error("Error al obtener teléfono:", err);
      }
    }
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

      if (newPhone.trim() !== phone) {
        const phoneClean = newPhone.replace(/[\s\-\+\(\)]/g, '');
        if (!/^\d{8,15}$/.test(phoneClean)) {
          setSettingsError('Ingresa un número de teléfono válido (8-15 dígitos).');
          return;
        }
      }

      const updates: any = {};

      if (newDisplayName.trim() !== displayName) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName.trim() });
        setDisplayName(newDisplayName.trim());
        updates.nombre = newDisplayName.trim();
      }

      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
        updates.correo = newEmail;
      }

      if (newPassword.length > 0) {
        await updatePassword(auth.currentUser, newPassword);
      }

      if (newPhone.trim() !== phone) {
        updates.telefono = newPhone.trim();
        setPhone(newPhone.trim());
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), updates);
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
    if (userRole === 'lector') return; // Bloqueo de seguridad

    const primera = confirm(`¿Estás seguro de que deseas eliminar el archivo?\n\n"${filename}"`);
    if (!primera) return;

    const segunda = confirm('⚠️ Esta acción es irreversible.\n¿Confirmas que deseas eliminar el archivo permanentemente?');
    if (!segunda) return;

    try {
      await axios.delete(`${API_BASE}/api/files/${encodeURIComponent(filename)}`);
      alert('🗑️ Archivo eliminado correctamente.');
      registrarAuditoria('Eliminó el archivo', filename); // <-- Registro
      const response = await axios.get(`${API_BASE}/api/files`);
      setListaArchivos(response.data);
    } catch {
      alert('❌ Error al intentar eliminar el archivo.');
    }
  };

  // --- FUNCIONES ADMIN (HU2) ---
  const cargarUsuarios = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const users: any[] = [];
      querySnapshot.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      setUsersList(users);
    } catch (err) {
      console.error(err);
    }
  };

  const cambiarRol = async (id: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { rol: nuevoRol });
      cargarUsuarios();
      registrarAuditoria(`Cambió rol a ${nuevoRol.toUpperCase()}`, `Usuario ID: ${id}`);
      alert('✅ Rol actualizado correctamente.');
    } catch (err) {
      alert("Error al cambiar el rol");
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
            {/* HU3: Ocultar botón eliminar para Lectores */}
            {userRole !== 'lector' && (
              <button className="file-delete" onClick={() => handleDelete(archivo.name)} title="Eliminar archivo">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // --- COMPLETAR PERFIL (primer inicio de sesión) ---
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    if (!profileName.trim()) {
      setProfileError('El nombre es obligatorio.');
      return;
    }
    if (!profilePhone.trim()) {
      setProfileError('El número de teléfono es obligatorio.');
      return;
    }

    // Validar formato básico de teléfono (solo números, al menos 8 dígitos)
    const phoneClean = profilePhone.replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{8,15}$/.test(phoneClean)) {
      setProfileError('Ingresa un número de teléfono válido (8-15 dígitos).');
      return;
    }

    setProfileLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Actualizar perfil de Firebase Auth
      await updateProfile(user, { displayName: profileName.trim() });

      // Actualizar documento en Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        nombre: profileName.trim(),
        telefono: profilePhone.trim(),
        perfilCompleto: true
      });

      setDisplayName(profileName.trim());
      setShowProfileModal(false);
    } catch (err) {
      console.error('Error al completar perfil:', err);
      setProfileError('Ocurrió un error al guardar tu perfil. Inténtalo de nuevo.');
    } finally {
      setProfileLoading(false);
    }
  };

  // --- AUTH GATE ---
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // --- MODAL OBLIGATORIO: Completar Perfil ---
  if (showProfileModal) {
    return (
      <div className="profile-modal-overlay">
        <div className="profile-modal">
          <div className="profile-modal-icon">
            <User size={32} color="#4f8cff" />
          </div>
          <h2>Completa tu Perfil</h2>
          <p className="subtitle">
            Para continuar, necesitamos algunos datos adicionales.
          </p>

          {profileError && <div className="login-error">{profileError}</div>}

          <form onSubmit={handleCompleteProfile} className="login-form">
            <div className="input-group">
              <label>Nombre Completo <span className="required-badge">Obligatorio</span></label>
              <div className="input-wrapper">
                <User size={18} />
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ingresa tu nombre completo"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label>Número de Teléfono <span className="required-badge">Obligatorio</span></label>
              <div className="input-wrapper">
                <Phone size={18} />
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="+56 9 1234 5678"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={profileLoading}>
              {profileLoading ? <Loader2 className="spin-icon" size={20} /> : 'Guardar y Continuar'}
            </button>
          </form>

          <button
            onClick={() => { setIsAuthenticated(false); signOut(auth); }}
            className="btn-link"
            style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* HEADER */}
      <header className="app-header">
        <div>
          <h1>Gestión Documental</h1>
          <div className="header-sub">Panel de Administración</div>
        </div>
        <button onClick={() => { setIsAuthenticated(false); signOut(auth); }} className="btn-logout" title="Cerrar Sesión">
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
              <div className="welcome-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="welcome-wave">👋</span>
                  <span>Bienvenid@ <strong>{displayName}</strong></span>
                </div>
                {/* LEYENDA VISTA DE ROL */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: userRole === 'admin' ? 'rgba(79, 140, 255, 0.1)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${userRole === 'admin' ? 'rgba(79, 140, 255, 0.3)' : userRole === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                  padding: '6px 14px', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 'bold'
                }}>
                  {userRole === 'admin' ? <Shield size={16} /> : userRole === 'colaborador' ? <User size={16} /> : <Eye size={16} />}
                  Vista de {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                </div>
              </div>
            )}
            <div className="section-title">Acciones Rápidas</div>
            <div className="card-grid">

              {/* HU3: Ocultar Tarjeta Subir para Lectores */}
              {userRole !== 'lector' && (
                <button className="action-card" onClick={() => fileInputRef.current?.click()}>
                  <div className="card-icon blue">
                    <UploadCloud size={26} color="#4f8cff" />
                  </div>
                  <h3>Subir Documento</h3>
                  <p>Cargar nuevos archivos PDF al sistema (limite 10mb)</p>
                </button>
              )}

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

              {/* HU2 y HU4: Tarjetas Exclusivas Administrador */}
              {userRole === 'admin' && (
                <>
                  <button className="action-card" onClick={() => { cargarUsuarios(); setVistaActual('usuarios'); }}>
                    <div className="card-icon" style={{ background: 'rgba(244, 114, 182, 0.1)' }}>
                      <Users size={26} color="#f472b6" />
                    </div>
                    <h3>Gestión Roles</h3>
                    <p>Asignar permisos a usuarios</p>
                  </button>

                  <button className="action-card" onClick={() => setVistaActual('historial')}>
                    <div className="card-icon" style={{ background: 'rgba(79, 140, 255, 0.1)' }}>
                      <History size={26} color="#4f8cff" />
                    </div>
                    <h3>Auditoría</h3>
                    <p>Historial de cambios del sistema</p>
                  </button>
                </>
              )}
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

        {/* === BÚSQUEDA Y FILTROS AVANZADOS === */}
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
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                title="Filtros Avanzados"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: showAdvancedFilters ? '#4f8cff' : 'var(--text-muted)' }}
              >
                <Filter size={20} />
              </button>
              {searching && <RefreshCcw size={16} className="spin-icon" style={{ color: 'var(--text-muted)', marginLeft: 8 }} />}
            </div>

            {showAdvancedFilters && (
              <div style={{ display: 'flex', gap: '15px', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Extensión:</span>
                  <select value={filterExtension} onChange={(e) => setFilterExtension(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
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

            {!searchQuery.trim() && !showAdvancedFilters ? (
              <div className="empty-state">
                <Search size={48} />
                <p>Escribe un término para buscar entre tus documentos.</p>
              </div>
            ) : filteredSearchResults.length === 0 && !searching ? (
              <div className="empty-state">
                <Inbox size={48} />
                <p>No se encontraron archivos con esos filtros y término.</p>
              </div>
            ) : (
              renderFileList(filteredSearchResults)
            )}
          </div>
        )}

        {/* === USUARIOS (HU2 - Solo Admin) === */}
        {vistaActual === 'usuarios' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Gestión de Permisos</h2>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'var(--bg-glass)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Nombre / Correo</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Teléfono</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Rol Actual</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cambiar a</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div>{u.nombre || 'Sin nombre'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.correo || u.email}</div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                        {u.telefono || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin registrar</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: u.rol === 'admin' ? 'rgba(79, 140, 255, 0.15)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.rol === 'admin' ? '#4f8cff' : u.rol === 'colaborador' ? '#34d399' : '#8b92a8',
                          border: `1px solid ${u.rol === 'admin' ? 'rgba(79, 140, 255, 0.3)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>{u.rol}</span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {u.rol === 'admin' ? (
                          <select
                            value="admin"
                            disabled
                            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-card)', padding: '6px 10px', borderRadius: '4px', outline: 'none', fontSize: '13px', cursor: 'not-allowed' }}
                          >
                            <option value="admin">Administrador</option>
                          </select>
                        ) : (
                          <select
                            value={u.rol}
                            onChange={(e) => cambiarRol(u.id, e.target.value)}
                            style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', padding: '6px 10px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                          >
                            <option value="colaborador">Colaborador</option>
                            <option value="lector">Lector</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === HISTORIAL (HU4 - Solo Admin) === */}
        {vistaActual === 'historial' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Historial y Auditoría</h2>
            </div>
            <div style={{ background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', color: 'var(--text-primary)', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'var(--bg-glass)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Usuario</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Acción</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map(log => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{formatDate(log.fecha)}</td>
                      <td style={{ padding: '12px 16px' }}>{log.usuario}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ color: log.accion.includes('Eliminó') ? '#f87171' : log.accion.includes('Subió') ? '#34d399' : 'var(--text-secondary)' }}>
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
                  <label>Número de Teléfono</label>
                  <div className="input-wrapper">
                    <Phone size={18} />
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+56 9 1234 5678"
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