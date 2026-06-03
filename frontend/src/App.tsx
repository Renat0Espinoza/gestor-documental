import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye, Phone, Loader2,
  Briefcase, Layers, MapPin, Plus, ChevronDown, ChevronRight,
  UserPlus, UserX, Tag, ToggleLeft, ToggleRight, AlertTriangle, Info
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase';
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// ===== INTERFACES =====
interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
  proyectoId?: string;
  fsId?: string;
}

interface DocumentoFirestore {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  proyectoId: string;
  subidoPor: string;
  fechaCreacion: any;
}

interface Categoria {
  id: string;
  nombre: string;
  creadoPor: string;
}

interface Subcategoria {
  id: string;
  nombre: string;
  categoriaId: string;
}

interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  categoriaId: string;
  subcategoriaId: string;
  estado: 'activo' | 'finalizado';
  creadoPor: string;
}

interface Area {
  id: string;
  nombre: string;
  colaboradores: string[];
  proyectoId: string;
}

// ===== HELPERS =====
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

// ===== TIPOS DE VISTA =====
type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial' | 'proyectos' | 'proyecto-detalle' | 'categorias';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState<Vista>('dashboard');
  const [listaArchivos, setListaArchivos] = useState<FileInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileInfo[]>([]);
  const [searching, setSearching] = useState(false);

  // --- Roles, Filtros y Auditoría ---
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

  // --- Estado de desactivación ---
  const [isDeactivated, setIsDeactivated] = useState(false);

  // --- Categorías y Subcategorías ---
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);

  // --- Proyectos ---
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCatId, setNewProjectCatId] = useState('');
  const [newProjectSubcatId, setNewProjectSubcatId] = useState('');

  // --- Proyecto Detalle ---
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);
  const [projectAreas, setProjectAreas] = useState<Area[]>([]);
  const [newAreaName, setNewAreaName] = useState('');

  // --- Modal Asignar Colaboradores ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAreaId, setAssignAreaId] = useState<string | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);

  // --- Documentos en Firestore ---
  const [documentosFS, setDocumentosFS] = useState<DocumentoFirestore[]>([]);
  const [uploadProyectoId, setUploadProyectoId] = useState<string | null>(null);

  // --- UI Global ---
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const showToast = (type: ToastMsg['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const [confirmState, setConfirmState] = useState<ConfirmState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const showConfirm = (title: string, message: string, onConfirm: () => void, isDestructive = false, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    setConfirmState({ isOpen: true, title, message, onConfirm, isDestructive, confirmText, cancelText });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE = '';

  // ===== GITHUB STATUS =====
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

  // ===== AUTH STATE =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setDisplayName(user.displayName || '');
        setIsAuthenticated(true);

        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();

            // Verificar si usuario está desactivado
            if (data.activo === false) {
              setIsDeactivated(true);
              return;
            }
            setIsDeactivated(false);

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

  // ===== AUDITORÍA =====
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

  // ===== SUBIDA DE ARCHIVOS =====
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('warning', '⚠️ Por favor, selecciona únicamente archivos PDF.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast('warning', '⚠️ El archivo es demasiado pesado.\nEl límite máximo permitido es de 10 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('documento', file);

    try {
      const response = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const fileName = response.data.file;

      // Guardar metadatos en Firestore si se seleccionó un proyecto
      if (uploadProyectoId) {
        await addDoc(collection(db, 'documentos'), {
          filename: fileName,
          originalName: file.name,
          size: file.size,
          proyectoId: uploadProyectoId,
          subidoPor: auth.currentUser?.uid || '',
          fechaCreacion: serverTimestamp()
        });
      }

      showToast('success', `✅ ¡Subida exitosa!\nArchivo: ${fileName}`);
      registrarAuditoria('Subió el archivo', fileName || file.name);

      // Si estábamos en el explorador, recargarlo
      if (vistaActual === 'explorador') {
        abrirExplorador();
      }
      // Si estábamos en un proyecto, recargar el explorador interno actualizando la lista de archivos global
      if (vistaActual === 'proyecto-detalle') {
        abrirExploradorContexto();
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 413) {
        showToast('warning', '⚠️ El archivo es demasiado pesado.\nEl límite máximo permitido es de 10 MB.');
      } else {
        showToast('error', '❌ Hubo un error al intentar subir el archivo al servidor.');
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploadProyectoId(null);
    }
  };

  // ===== CARGAR METADATOS Y ARCHIVOS =====
  const abrirExploradorContexto = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/files`);
      const filesFromApi: FileInfo[] = response.data;
      
      const snap = await getDocs(collection(db, 'documentos'));
      const docs: DocumentoFirestore[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as DocumentoFirestore));
      setDocumentosFS(docs);

      const mergedFiles = filesFromApi.map(f => {
        const fDoc = docs.find(d => d.filename === f.name);
        if (fDoc) {
          return { ...f, proyectoId: fDoc.proyectoId, fsId: fDoc.id };
        }
        return f;
      });

      // Filtro para Colaboradores: Solo ver archivos de proyectos asignados
      let filteredFiles = mergedFiles;
      if (userRole !== 'admin') {
        const visibleProjectIds = proyectosVisibles.map(p => p.id);
        filteredFiles = mergedFiles.filter(f => f.proyectoId && visibleProjectIds.includes(f.proyectoId));
      }

      setListaArchivos(filteredFiles);
    } catch (err) {
      console.error(err);
    }
  };

  // ===== EXPLORADOR =====
  const abrirExplorador = async () => {
    try {
      await abrirExploradorContexto();
      setVistaActual('explorador');
    } catch {
      showToast('error', '❌ Error al conectar con el servidor para ver los archivos.');
    }
  };

  // ===== BÚSQUEDA =====
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
        const filesFromApi: FileInfo[] = res.data;
        
        const mergedFiles = filesFromApi.map(f => {
          const fDoc = documentosFS.find(d => d.filename === f.name);
          if (fDoc) return { ...f, proyectoId: fDoc.proyectoId, fsId: fDoc.id };
          return f;
        });

        let filteredFiles = mergedFiles;
        if (userRole !== 'admin') {
          const visibleProjectIds = proyectosVisibles.map(p => p.id);
          filteredFiles = mergedFiles.filter(f => f.proyectoId && visibleProjectIds.includes(f.proyectoId));
        }

        setSearchResults(filteredFiles);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // ===== FILTROS AVANZADOS =====
  const aplicarFiltrosAvanzados = (archivos: FileInfo[]) => {
    return archivos.filter(f => {
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
  };

  const filteredSearchResults = aplicarFiltrosAvanzados(searchResults);
  const filteredExploradorResults = aplicarFiltrosAvanzados(listaArchivos);

  const handleDownload = (filename: string) => {
    registrarAuditoria('Descargó el archivo', filename);
    window.open(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, '_blank');
  };

  // ===== CONFIGURACIÓN =====
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

  // ===== ELIMINAR ARCHIVO =====
  const handleDelete = async (archivo: FileInfo) => {
    if (userRole === 'lector') return;

    showConfirm(
      'Eliminar Archivo',
      `¿Estás seguro de que deseas eliminar el archivo?\n\n"${archivo.name}"`,
      () => {
        showConfirm(
          'Confirmación Irreversible',
          '⚠️ Esta acción es irreversible.\n¿Confirmas que deseas eliminar el archivo permanentemente?',
          async () => {
            try {
              // Eliminar del almacenamiento local
              await axios.delete(`${API_BASE}/api/files/${encodeURIComponent(archivo.name)}`);
              
              // Eliminar de Firestore si tiene registro
              if (archivo.fsId) {
                await deleteDoc(doc(db, 'documentos', archivo.fsId));
              }
              
              showToast('success', '🗑️ Archivo eliminado correctamente.');
              registrarAuditoria('Eliminó el archivo', archivo.name);
              
              if (vistaActual === 'explorador') {
                abrirExplorador();
              } else if (vistaActual === 'proyecto-detalle') {
                abrirExploradorContexto();
              } else {
                const response = await axios.get(`${API_BASE}/api/files`);
                setListaArchivos(response.data); // fallback
              }
            } catch {
              showToast('error', '❌ Error al intentar eliminar el archivo.');
            }
          },
          true,
          'Eliminar Permanentemente',
          'Cancelar'
        );
      },
      true,
      'Continuar',
      'Cancelar'
    );
  };

  // ===== USUARIOS =====
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

  const cambiarRolUsuario = async (userId: string, nuevoRol: 'admin' | 'colaborador' | 'lector') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: nuevoRol });
      cargarUsuarios();
      showToast('success', '✅ Rol actualizado correctamente.');
    } catch {
      showToast('error', "Error al cambiar el rol");
    }
  };

  // ===== ACTIVAR / DESACTIVAR USUARIO =====
  const toggleEstadoUsuario = async (userId: string, currentStatus: boolean | undefined) => {
    const action = currentStatus === false ? 'activar' : 'desactivar';
    const newStatus = currentStatus === false ? true : false;
    
    showConfirm(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Usuario`,
      `¿Estás seguro de que deseas ${action} a este usuario?`,
      async () => {
        try {
          await updateDoc(doc(db, 'users', userId), { activo: newStatus });
          cargarUsuarios();
          showToast('success', `✅ Usuario ${newStatus ? 'activado' : 'desactivado'} correctamente.`);
        } catch {
          showToast('error', '❌ Error al cambiar el estado del usuario.');
        }
      },
      !newStatus,
      'Confirmar',
      'Cancelar'
    );
  };

  // ===== CATEGORÍAS =====
  const cargarCategorias = async () => {
    try {
      const snap = await getDocs(collection(db, 'categorias'));
      const cats: Categoria[] = [];
      snap.forEach(d => cats.push({ id: d.id, ...d.data() } as Categoria));
      setCategorias(cats);
    } catch (err) {
      console.error('Error cargando categorías:', err);
    }
  };

  const cargarSubcategorias = async (categoriaId: string) => {
    try {
      const snap = await getDocs(collection(db, 'categorias', categoriaId, 'subcategorias'));
      const subs: Subcategoria[] = [];
      snap.forEach(d => subs.push({ id: d.id, nombre: d.data().nombre, categoriaId }));
      setSubcategorias(prev => {
        const filtered = prev.filter(s => s.categoriaId !== categoriaId);
        return [...filtered, ...subs];
      });
    } catch (err) {
      console.error('Error cargando subcategorías:', err);
    }
  };

  const cargarTodasSubcategorias = async (cats: Categoria[]) => {
    const allSubs: Subcategoria[] = [];
    for (const cat of cats) {
      try {
        const snap = await getDocs(collection(db, 'categorias', cat.id, 'subcategorias'));
        snap.forEach(d => allSubs.push({ id: d.id, nombre: d.data().nombre, categoriaId: cat.id }));
      } catch { /* skip */ }
    }
    setSubcategorias(allSubs);
  };

  const handleCreateCategoria = async () => {
    if (!newCategoria.trim()) return;
    try {
      await addDoc(collection(db, 'categorias'), {
        nombre: newCategoria,
        creadoPor: auth.currentUser?.uid
      });
      setNewCategoria('');
      cargarCategorias();
      showToast('success', '✅ Categoría creada exitosamente.');
    } catch {
      showToast('error', '❌ Error al crear la categoría.');
    }
  };

  const eliminarCategoria = async (catId: string, catName: string) => {
    const projectExists = proyectos.some(p => p.categoriaId === catId);
    if (projectExists) {
      showToast('warning', `No puedes eliminar la categoría "${catName}" porque tiene proyectos asociados.`);
      return;
    }

    showConfirm(
      'Eliminar Categoría',
      `¿Eliminar la categoría "${catName}" y todas sus subcategorías?`,
      async () => {
        try {
          const subsSnap = await getDocs(collection(db, 'categorias', catId, 'subcategorias'));
          for (const sDoc of subsSnap.docs) {
            await deleteDoc(doc(db, 'categorias', catId, 'subcategorias', sDoc.id));
          }
          await deleteDoc(doc(db, 'categorias', catId));
          cargarCategorias();
          showToast('success', '🗑️ Categoría eliminada.');
        } catch {
          showToast('error', '❌ Error al eliminar la categoría.');
        }
      },
      true,
      'Eliminar',
      'Cancelar'
    );
  };

  const handleCreateSubcategoria = async (catId: string) => {
    if (!newSubcategoria[catId]?.trim()) return;
    try {
      await addDoc(collection(db, 'categorias', catId, 'subcategorias'), {
        nombre: newSubcategoria[catId],
        categoriaId: catId
      });
      setNewSubcategoria({ ...newSubcategoria, [catId]: '' });
      cargarSubcategorias(catId);
      showToast('success', '✅ Subcategoría creada exitosamente.');
    } catch {
      showToast('error', '❌ Error al crear la subcategoría.');
    }
  };

  const eliminarSubcategoria = async (catId: string, subId: string, subName: string) => {
    showConfirm(
      'Eliminar Subcategoría',
      `¿Eliminar la subcategoría "${subName}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'categorias', catId, 'subcategorias', subId));
          cargarSubcategorias(catId);
          showToast('success', '🗑️ Subcategoría eliminada.');
        } catch {
          showToast('error', '❌ Error al eliminar.');
        }
      },
      true,
      'Eliminar',
      'Cancelar'
    );
  };

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) {
        next.delete(catId);
      } else {
        next.add(catId);
        cargarSubcategorias(catId);
      }
      return next;
    });
  };

  // ===== PROYECTOS =====
  const cargarProyectos = async () => {
    try {
      const snap = await getDocs(collection(db, 'proyectos'));
      const projs: Proyecto[] = [];
      snap.forEach(d => projs.push({ id: d.id, ...d.data() } as Proyecto));
      setProyectos(projs);
    } catch (err) {
      console.error('Error cargando proyectos:', err);
    }
  };

  const handleCreateProyecto = async () => {
    if (!newProjectName.trim() || !newProjectCat || !newProjectSubCat) {
      showToast('warning', '⚠️ Completa todos los campos obligatorios.');
      return;
    }
    try {
      await addDoc(collection(db, 'proyectos'), {
        nombre: newProjectName,
        descripcion: newProjectDesc,
        categoriaId: newProjectCat,
        subcategoriaId: newProjectSubCat,
        creadoPor: auth.currentUser?.uid,
        fechaCreacion: serverTimestamp(),
        estado: 'activo'
      });
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectCat('');
      setNewProjectSubCat('');
      cargarProyectos();
      showToast('success', '✅ Proyecto creado exitosamente.');
    } catch {
      showToast('error', '❌ Error al crear el proyecto.');
    }
  };

  const eliminarProyecto = async (proyecto: Proyecto) => {
    showConfirm(
      'Eliminar Proyecto',
      `¿Estás seguro de que deseas eliminar el proyecto "${proyecto.nombre}"?`,
      () => {
        showConfirm(
          'Confirmación Definitiva',
          '⚠️ Se eliminarán también todas las áreas y asignaciones de este proyecto.\n¿Confirmas la eliminación?',
          async () => {
            try {
              // Eliminar áreas del proyecto primero
              const areasSnap = await getDocs(collection(db, 'proyectos', proyecto.id, 'areas'));
              for (const aDoc of areasSnap.docs) {
                await deleteDoc(doc(db, 'proyectos', proyecto.id, 'areas', aDoc.id));
              }
              await deleteDoc(doc(db, 'proyectos', proyecto.id));
              cargarProyectos();
              registrarAuditoria('Eliminó proyecto', proyecto.nombre);
              showToast('success', '🗑️ Proyecto eliminado correctamente.');
            } catch {
              showToast('error', '❌ Error al eliminar el proyecto.');
            }
          },
          true,
          'Eliminar Permanentemente',
          'Cancelar'
        );
      },
      true,
      'Continuar',
      'Cancelar'
    );
  };

  const toggleEstadoProyecto = async (proyecto: Proyecto) => {
    const nuevoEstado = proyecto.estado === 'activo' ? 'finalizado' : 'activo';
    showConfirm(
      'Cambiar Estado del Proyecto',
      `¿Cambiar el estado del proyecto "${proyecto.nombre}" a ${nuevoEstado.toUpperCase()}?`,
      async () => {
        try {
          await updateDoc(doc(db, 'proyectos', proyecto.id), { estado: nuevoEstado });
          // Actualizar el proyecto seleccionado si estamos en detalle
          if (selectedProject?.id === proyecto.id) {
            setSelectedProject({ ...proyecto, estado: nuevoEstado as 'activo' | 'finalizado' });
          }
          cargarProyectos();
          registrarAuditoria(`Cambió estado de proyecto a ${nuevoEstado}`, proyecto.nombre);
          showToast('success', `✅ Estado cambiado a ${nuevoEstado}.`);
        } catch {
          showToast('error', '❌ Error al cambiar el estado del proyecto.');
        }
      },
      false,
      'Confirmar',
      'Cancelar'
    );
  };

  // ===== ÁREAS =====
  const cargarAreas = async (proyectoId: string) => {
    try {
      const snap = await getDocs(collection(db, 'proyectos', proyectoId, 'areas'));
      const areas: Area[] = [];
      snap.forEach(d => areas.push({ id: d.id, ...d.data(), proyectoId } as Area));
      setProjectAreas(areas);
    } catch (err) {
      console.error('Error cargando áreas:', err);
    }
  };

  const crearArea = async (proyectoId: string) => {
    if (!newAreaName.trim()) return;
    try {
      await addDoc(collection(db, 'proyectos', proyectoId, 'areas'), {
        nombre: newAreaName,
        colaboradores: []
      });
      setNewAreaName('');
      cargarAreas(proyectoId);
      showToast('success', '✅ Área creada exitosamente.');
    } catch {
      showToast('error', '❌ Error al crear el área.');
    }
  };

  const eliminarArea = async (proyectoId: string, areaId: string, areaName: string) => {
    showConfirm(
      'Eliminar Área',
      `¿Eliminar el área "${areaName}"?`,
      async () => {
        try {
          await deleteDoc(doc(db, 'proyectos', proyectoId, 'areas', areaId));
          cargarAreas(proyectoId);
          showToast('success', '🗑️ Área eliminada correctamente.');
        } catch {
          showToast('error', '❌ Error al eliminar el área.');
        }
      },
      true,
      'Eliminar',
      'Cancelar'
    );
  };

  // ===== ASIGNAR COLABORADORES =====
  const openAssignModal = (areaId: string, currentCollabs: string[]) => {
    setAssignAreaId(areaId);
    setSelectedCollaborators([...currentCollabs]);
    cargarUsuarios();
    setShowAssignModal(true);
  };

  const handleAssignCollaborators = async () => {
    if (!selectedProject || !assignAreaId) return;
    try {
      await updateDoc(doc(db, 'proyectos', selectedProject.id, 'areas', assignAreaId), {
        colaboradores: selectedCollaborators
      });
      setShowAssignModal(false);
      setAssignAreaId(null);
      setSelectedCollaborators([]);
      cargarAreas(selectedProject.id);
      showToast('success', '✅ Colaboradores asignados correctamente.');
    } catch {
      showToast('error', '❌ Error al asignar colaboradores.');
    }
  };

  const abrirProyectoDetalle = async (proyecto: Proyecto) => {
    setSelectedProject(proyecto);
    await cargarAreas(proyecto.id);
    await cargarUsuarios();
    await abrirExploradorContexto(); // Cargar metadata de archivos
    setVistaActual('proyecto-detalle');
  };

  const abrirProyectos = async () => {
    await cargarProyectos();
    await cargarCategorias();
    const snap = await getDocs(collection(db, 'categorias'));
    const cats: Categoria[] = [];
    snap.forEach(d => cats.push({ id: d.id, ...d.data() } as Categoria));
    await cargarTodasSubcategorias(cats);
    setVistaActual('proyectos');
  };

  const abrirCategorias = async () => {
    await cargarCategorias();
    setVistaActual('categorias');
  };

  // ===== HELPER: obtener áreas visibles según rol =====
  const getAreasVisibles = () => {
    if (userRole === 'admin') return projectAreas;
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return projectAreas.filter(area => area.colaboradores && area.colaboradores.includes(uid));
  };

  // Filtrado real se hace al cargar — pero para la vista de lista necesitamos una versión
  // que cargue las áreas de cada proyecto. Para simplificar, filtramos en el efecto.
  const [proyectosVisibles, setProyectosVisibles] = useState<Proyecto[]>([]);

  useEffect(() => {
    const filterProjects = async () => {
      if (userRole === 'admin') {
        setProyectosVisibles(proyectos);
        return;
      }
      const uid = auth.currentUser?.uid;
      if (!uid) { setProyectosVisibles([]); return; }

      const visible: Proyecto[] = [];
      for (const p of proyectos) {
        try {
          const areasSnap = await getDocs(collection(db, 'proyectos', p.id, 'areas'));
          let isAssigned = false;
          areasSnap.forEach(aDoc => {
            const data = aDoc.data();
            if (data.colaboradores && data.colaboradores.includes(uid)) {
              isAssigned = true;
            }
          });
          if (isAssigned) visible.push(p);
        } catch { /* skip */ }
      }
      setProyectosVisibles(visible);
    };
    filterProjects();
  }, [proyectos, userRole]);

  // ===== COMPONENTE DE LISTA DE ARCHIVOS =====
  const renderFileList = (files: FileInfo[]) => (
    <div className="file-list">
      {files.map((archivo, index) => {
        const fileProject = proyectos.find(p => p.id === archivo.proyectoId);
        
        return (
        <div key={index} className="file-item" style={{ animationDelay: `${index * 0.05}s` }}>
          <div className="file-icon">
            <FileText size={20} color="#f87171" />
          </div>
          <div className="file-info">
            <div className="file-name">{archivo.name}</div>
            <div className="file-meta">
              {formatFileSize(archivo.size)}
              {archivo.modified ? ` · ${formatDate(archivo.modified)}` : ''}
              
              {fileProject && (
                <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
                  <span className="project-meta-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
                    <Briefcase size={10} /> {fileProject.nombre}
                  </span>
                  <span className="project-meta-tag" style={{ fontSize: '10px', padding: '2px 8px' }}>
                    <Layers size={10} /> {getNombreCategoria(fileProject.categoriaId)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="file-actions">
            <button className="file-download" onClick={() => handleDownload(archivo.name)}>
              <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Descargar
            </button>
            {userRole !== 'lector' && (
              <button className="file-delete" onClick={() => handleDelete(archivo)} title="Eliminar archivo">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      )})}
    </div>
  );

  // ===== COMPLETAR PERFIL =====
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

    const phoneClean = profilePhone.replace(/[\s\-\+\(\)]/g, '');
    if (!/^\d{8,15}$/.test(phoneClean)) {
      setProfileError('Ingresa un número de teléfono válido (8-15 dígitos).');
      return;
    }

    setProfileLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;

      await updateProfile(user, { displayName: profileName.trim() });

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

  // ===== HELPER: nombre de categoría/subcategoría =====
  const getNombreCategoria = (id: string) => categorias.find(c => c.id === id)?.nombre || '—';
  const getNombreSubcategoria = (id: string) => subcategorias.find(s => s.id === id)?.nombre || '—';
  const getNombreUsuario = (uid: string) => {
    const u = usersList.find(u => u.id === uid);
    return u?.nombre || u?.correo || u?.email || uid;
  };

  // ===== AUTH GATE =====
  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  // ===== PANTALLA DE DESACTIVACIÓN =====
  if (isDeactivated) {
    return (
      <div className="deactivated-screen">
        <div className="deactivated-card">
          <div className="deactivated-icon">
            <UserX size={36} color="#f87171" />
          </div>
          <h2>Cuenta Desactivada</h2>
          <p>
            Tu cuenta ha sido desactivada por un administrador. 
            Si crees que esto es un error, contacta al administrador del sistema.
          </p>
          <button
            onClick={() => { setIsAuthenticated(false); setIsDeactivated(false); signOut(auth); }}
            className="btn-primary"
            style={{ width: '100%' }}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // ===== MODAL COMPLETAR PERFIL =====
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

            {/* SECCIÓN: GESTIÓN (Proyectos primero, más importante) */}
            <div className="dashboard-section">
              <div className="section-label">
                <Briefcase size={14} />
                Gestión
              </div>
              <div className="card-grid">
                <button className="action-card" onClick={abrirProyectos}>
                  <div className="card-icon" style={{ background: 'rgba(79, 140, 255, 0.1)' }}>
                    <Briefcase size={26} color="#4f8cff" />
                  </div>
                  <h3>Proyectos</h3>
                  <p>Ver y gestionar proyectos y áreas de trabajo</p>
                </button>

                {userRole === 'admin' && (
                  <button className="action-card" onClick={abrirCategorias}>
                    <div className="card-icon" style={{ background: 'rgba(167, 139, 250, 0.1)' }}>
                      <Layers size={26} color="#a78bfa" />
                    </div>
                    <h3>Categorías</h3>
                    <p>Gestionar categorías y subcategorías</p>
                  </button>
                )}
              </div>
            </div>

            {/* SECCIÓN: DOCUMENTOS */}
            <div className="dashboard-section">
              <div className="section-label">
                <FileText size={14} />
                Documentos
              </div>
              <div className="card-grid">
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
              </div>
            </div>

            {/* SECCIÓN: ADMINISTRACIÓN (solo admin) */}
            {userRole === 'admin' && (
              <div className="dashboard-section">
                <div className="section-label">
                  <Shield size={14} />
                  Administración
                </div>
                <div className="card-grid">
                  <button className="action-card" onClick={() => { cargarUsuarios(); setVistaActual('usuarios'); }}>
                    <div className="card-icon" style={{ background: 'rgba(244, 114, 182, 0.1)' }}>
                      <Users size={26} color="#f472b6" />
                    </div>
                    <h3>Gestión Roles</h3>
                    <p>Asignar permisos y activar/desactivar usuarios</p>
                  </button>

                  <button className="action-card" onClick={() => setVistaActual('historial')}>
                    <div className="card-icon" style={{ background: 'rgba(79, 140, 255, 0.1)' }}>
                      <History size={26} color="#4f8cff" />
                    </div>
                    <h3>Auditoría</h3>
                    <p>Historial de cambios del sistema</p>
                  </button>
                </div>
              </div>
            )}

            {/* SECCIÓN: MI CUENTA */}
            <div className="dashboard-section">
              <div className="section-label">
                <User size={14} />
                Mi Cuenta
              </div>
              <div className="card-grid">
                <button className="action-card" onClick={abrirConfiguracion}>
                  <div className="card-icon purple">
                    <Settings size={26} color="#a78bfa" />
                  </div>
                  <h3>Configuración</h3>
                  <p>Ajustes de perfil y conexión</p>
                </button>
              </div>
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
              
              <div style={{ marginLeft: 'auto' }}>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  title="Filtros Avanzados"
                  className="btn-secondary"
                  style={{ background: 'transparent', border: '1px solid var(--border-subtle)', padding: '6px 12px', color: showAdvancedFilters ? '#4f8cff' : 'var(--text-muted)' }}
                >
                  <Filter size={16} style={{ marginRight: 6 }} /> Filtros
                </button>
              </div>
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

            {filteredExploradorResults.length === 0 ? (
              <div className="empty-state">
                <Inbox size={48} />
                <p>No se encontraron documentos.</p>
              </div>
            ) : (
              renderFileList(filteredExploradorResults)
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

        {/* === USUARIOS (Solo Admin) === */}
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
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Estado</th>
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
                      <td style={{ padding: '12px 16px' }}>
                        {u.rol === 'admin' ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                        ) : (
                          <label className="toggle-switch" title={u.activo !== false ? 'Activo — clic para desactivar' : 'Desactivado — clic para activar'}>
                            <input
                              type="checkbox"
                              checked={u.activo !== false}
                              onChange={() => toggleUserActive(u.id, u.activo !== false)}
                            />
                            <span className="toggle-slider"></span>
                          </label>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === HISTORIAL (Solo Admin) === */}
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

        {/* === CATEGORÍAS (Solo Admin) === */}
        {vistaActual === 'categorias' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Categorías y Subcategorías</h2>
            </div>

            {/* Formulario crear categoría */}
            <div className="inline-form" style={{ marginTop: 0, marginBottom: 24 }}>
              <Layers size={18} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Nueva categoría..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && crearCategoria()}
              />
              <button className="btn-icon primary" onClick={crearCategoria} title="Crear categoría">
                <Plus size={18} />
              </button>
            </div>

            {/* Listado de categorías */}
            {categorias.length === 0 ? (
              <div className="empty-state">
                <Layers size={48} />
                <p>No hay categorías creadas aún.</p>
              </div>
            ) : (
              <div className="category-list">
                {categorias.map(cat => {
                  const isExpanded = expandedCategories.has(cat.id);
                  const catSubs = subcategorias.filter(s => s.categoriaId === cat.id);
                  return (
                    <div key={cat.id} className="category-card">
                      <div className="category-header" onClick={() => toggleCategory(cat.id)}>
                        <div className="category-header-left">
                          {isExpanded ? <ChevronDown size={18} color="var(--accent-blue)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
                          <h4>{cat.nombre}</h4>
                          <span className="category-count">{catSubs.length} subcategorías</span>
                        </div>
                        <button
                          className="btn-icon danger"
                          onClick={(e) => { e.stopPropagation(); eliminarCategoria(cat.id, cat.nombre); }}
                          title="Eliminar categoría"
                          style={{ width: 32, height: 32 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="category-body">
                          {catSubs.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '0 0 12px 0' }}>
                              Sin subcategorías aún.
                            </p>
                          ) : (
                            <div className="subcategory-list">
                              {catSubs.map(sub => (
                                <div key={sub.id} className="subcategory-item">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Tag size={14} color="var(--accent-amber)" />
                                    {sub.nombre}
                                  </div>
                                  <button
                                    className="btn-icon danger"
                                    onClick={() => eliminarSubcategoria(cat.id, sub.id, sub.nombre)}
                                    title="Eliminar subcategoría"
                                    style={{ width: 28, height: 28 }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Formulario agregar subcategoría */}
                          {addingSubcategoryTo === cat.id ? (
                            <div className="inline-form">
                              <input
                                type="text"
                                placeholder="Nombre de subcategoría..."
                                value={newSubcategoryName}
                                onChange={(e) => setNewSubcategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && crearSubcategoria(cat.id)}
                                autoFocus
                              />
                              <button className="btn-icon green" onClick={() => crearSubcategoria(cat.id)} title="Crear">
                                <Plus size={16} />
                              </button>
                              <button className="btn-icon" onClick={() => { setAddingSubcategoryTo(null); setNewSubcategoryName(''); }} title="Cancelar">
                                <XCircle size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn-create"
                              onClick={() => setAddingSubcategoryTo(cat.id)}
                              style={{ marginTop: 12 }}
                            >
                              <Plus size={14} /> Agregar Subcategoría
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === PROYECTOS === */}
        {vistaActual === 'proyectos' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Proyectos</h2>
              <span className="badge">{proyectosVisibles.length}</span>
            </div>

            {/* Formulario crear proyecto (solo admin) */}
            {userRole === 'admin' && (
              <>
                {!showCreateProject ? (
                  <button className="btn-create" onClick={() => setShowCreateProject(true)} style={{ marginBottom: 20 }}>
                    <Plus size={16} /> Crear Proyecto
                  </button>
                ) : (
                  <div className="create-form-card">
                    <h3><Briefcase size={18} /> Nuevo Proyecto</h3>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Nombre del Proyecto</label>
                        <input
                          type="text"
                          placeholder="Ej: Edificio Central"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Descripción</label>
                        <textarea
                          placeholder="Descripción breve del proyecto..."
                          value={newProjectDesc}
                          onChange={(e) => setNewProjectDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Categoría</label>
                        <select value={newProjectCatId} onChange={(e) => { setNewProjectCatId(e.target.value); setNewProjectSubcatId(''); }}>
                          <option value="">Seleccionar categoría...</option>
                          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Subcategoría</label>
                        <select value={newProjectSubcatId} onChange={(e) => setNewProjectSubcatId(e.target.value)} disabled={!newProjectCatId}>
                          <option value="">Seleccionar subcategoría...</option>
                          {subcategorias.filter(s => s.categoriaId === newProjectCatId).map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button className="btn-create" onClick={crearProyecto}>
                        <Plus size={14} /> Crear Proyecto
                      </button>
                      <button className="btn-cancel" onClick={() => setShowCreateProject(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Listado de proyectos */}
            {proyectosVisibles.length === 0 ? (
              <div className="empty-state">
                <Briefcase size={48} />
                <p>{userRole === 'admin' ? 'No hay proyectos creados aún.' : 'No estás asignado a ningún proyecto.'}</p>
              </div>
            ) : (
              <div className="project-grid">
                {proyectosVisibles.map(p => (
                  <div key={p.id} className="project-card" onClick={() => abrirProyectoDetalle(p)}>
                    <div className="project-card-header">
                      <h4 className="project-card-title">{p.nombre}</h4>
                      <span className={`status-badge ${p.estado === 'activo' ? 'active' : 'finished'}`}>
                        {p.estado === 'activo' ? '● Activo' : '○ Finalizado'}
                      </span>
                    </div>
                    {p.descripcion && <p className="project-card-desc">{p.descripcion}</p>}
                    <div className="project-card-meta">
                      <span className="project-meta-tag">
                        <Layers size={12} /> {getNombreCategoria(p.categoriaId)}
                      </span>
                      <span className="project-meta-tag">
                        <Tag size={12} /> {getNombreSubcategoria(p.subcategoriaId)}
                      </span>
                    </div>
                    {/* Botones de acción admin sobre tarjeta */}
                    {userRole === 'admin' && (
                      <div className="project-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`btn-status-toggle ${p.estado === 'activo' ? 'finalizar' : 'activar'}`}
                          onClick={() => toggleEstadoProyecto(p)}
                          title={p.estado === 'activo' ? 'Finalizar proyecto' : 'Reactivar proyecto'}
                        >
                          {p.estado === 'activo' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                          {p.estado === 'activo' ? 'Finalizar' : 'Reactivar'}
                        </button>
                        <button
                          className="btn-icon danger"
                          onClick={() => eliminarProyecto(p)}
                          title="Eliminar proyecto"
                          style={{ width: 32, height: 32 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === PROYECTO DETALLE === */}
        {vistaActual === 'proyecto-detalle' && selectedProject && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => { setVistaActual('proyectos'); abrirProyectos(); }}>
                <ArrowLeft size={16} /> Volver a Proyectos
              </button>
            </div>

            <div className="project-detail-header">
              <div className="project-detail-info">
                <h2>{selectedProject.nombre}</h2>
                {selectedProject.descripcion && <p>{selectedProject.descripcion}</p>}
                <div className="project-detail-tags">
                  <span className="project-meta-tag">
                    <Layers size={12} /> {getNombreCategoria(selectedProject.categoriaId)}
                  </span>
                  <span className="project-meta-tag">
                    <Tag size={12} /> {getNombreSubcategoria(selectedProject.subcategoriaId)}
                  </span>
                  <span className={`status-badge ${selectedProject.estado === 'activo' ? 'active' : 'finished'}`}>
                    {selectedProject.estado === 'activo' ? '● Activo' : '○ Finalizado'}
                  </span>
                </div>
              </div>
              {/* Acciones de proyecto (admin) */}
              {userRole === 'admin' && (
                <div className="project-detail-actions">
                  <button
                    className={`btn-status-toggle ${selectedProject.estado === 'activo' ? 'finalizar' : 'activar'}`}
                    onClick={() => toggleEstadoProyecto(selectedProject)}
                    title={selectedProject.estado === 'activo' ? 'Finalizar proyecto' : 'Reactivar proyecto'}
                  >
                    {selectedProject.estado === 'activo' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {selectedProject.estado === 'activo' ? 'Finalizar' : 'Reactivar'}
                  </button>
                  <button
                    className="btn-icon danger"
                    onClick={() => { eliminarProyecto(selectedProject).then(() => { setVistaActual('proyectos'); abrirProyectos(); }); }}
                    title="Eliminar proyecto"
                    style={{ width: 36, height: 36 }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Áreas */}
            <div className="section-divider">
              <h3><MapPin size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Áreas{userRole !== 'admin' && ' asignadas'}</h3>
            </div>

            {/* Crear área (solo admin) */}
            {userRole === 'admin' && (
              <div className="inline-form" style={{ marginTop: 0, marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="Nombre del área nueva..."
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && crearArea(selectedProject.id)}
                />
                <button className="btn-icon primary" onClick={() => crearArea(selectedProject.id)} title="Crear área">
                  <Plus size={18} />
                </button>
              </div>
            )}

            {getAreasVisibles().length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px' }}>
                <MapPin size={40} />
                <p>{userRole === 'admin' ? 'No hay áreas creadas en este proyecto.' : 'No estás asignado a ningún área de este proyecto.'}</p>
              </div>
            ) : (
              <div className="area-list">
                {getAreasVisibles().map(area => (
                  <div key={area.id} className="area-card">
                    <div className="area-card-header">
                      <div className="area-card-title">
                        <MapPin size={18} />
                        {area.nombre}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {userRole === 'admin' && (
                          <>
                            <button
                              className="btn-icon primary"
                              onClick={() => openAssignModal(area.id, area.colaboradores || [])}
                              title="Asignar colaboradores"
                              style={{ width: 34, height: 34 }}
                            >
                              <UserPlus size={16} />
                            </button>
                            <button
                              className="btn-icon danger"
                              onClick={() => eliminarArea(selectedProject.id, area.id, area.nombre)}
                              title="Eliminar área"
                              style={{ width: 34, height: 34 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      {(!area.colaboradores || area.colaboradores.length === 0) ? (
                        <p className="empty-collaborators">Sin colaboradores asignados</p>
                      ) : (
                        <div className="collaborator-chips">
                          {area.colaboradores.map(uid => (
                            <span key={uid} className="collaborator-chip">
                              <User size={12} />
                              {getNombreUsuario(uid)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Documentos del Proyecto */}
            <div className="section-divider" style={{ marginTop: '32px' }}>
              <h3><FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Documentos del Proyecto</h3>
            </div>

            {userRole !== 'lector' && (
              <button 
                className="btn-create" 
                style={{ marginBottom: 16 }}
                onClick={() => {
                  setUploadProyectoId(selectedProject.id);
                  fileInputRef.current?.click();
                }}
              >
                <UploadCloud size={16} /> Subir Documento a este Proyecto
              </button>
            )}

            {listaArchivos.filter(f => f.proyectoId === selectedProject.id).length === 0 ? (
              <div className="empty-state" style={{ padding: '20px' }}>
                <Inbox size={40} />
                <p>No hay documentos asociados a este proyecto.</p>
              </div>
            ) : (
              <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                {renderFileList(listaArchivos.filter(f => f.proyectoId === selectedProject.id))}
              </div>
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

      {/* MODAL: ASIGNAR COLABORADORES */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3><UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Asignar Colaboradores</h3>
            <div className="user-checkbox-list">
              {usersList
                .filter(u => u.rol === 'colaborador' && u.activo !== false)
                .map(u => (
                  <label key={u.id} className="user-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedCollaborators.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCollaborators(prev => [...prev, u.id]);
                        } else {
                          setSelectedCollaborators(prev => prev.filter(id => id !== u.id));
                        }
                      }}
                    />
                    <div className="user-info">
                      <div className="name">{u.nombre || 'Sin nombre'}</div>
                      <div className="email">{u.correo || u.email}</div>
                    </div>
                  </label>
                ))}
              {usersList.filter(u => u.rol === 'colaborador' && u.activo !== false).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  No hay colaboradores activos disponibles.
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAssignModal(false)}>Cancelar</button>
              <button className="btn-create" onClick={guardarAsignacion}>
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

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
      {/* ===== GLOBAL UI ===== */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' && <CheckCircle size={18} color="var(--accent-green)" />}
              {t.type === 'error' && <XCircle size={18} color="var(--accent-red)" />}
              {t.type === 'warning' && <AlertTriangle size={18} color="var(--accent-amber)" />}
              {t.type === 'info' && <Info size={18} color="var(--accent-blue)" />}
            </div>
            <div className="toast-content">{t.message}</div>
          </div>
        ))}
      </div>

      {confirmState.isOpen && (
        <div className="confirm-overlay" style={{ zIndex: 99999 }}>
          <div className="confirm-box">
            <h3>
              {confirmState.isDestructive ? <AlertTriangle size={22} color="var(--accent-red)" /> : <Info size={22} color="var(--accent-blue)" />}
              {confirmState.title}
            </h3>
            <p>{confirmState.message}</p>
            <div className="confirm-actions">
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmState({ ...confirmState, isOpen: false })}
              >
                {confirmState.cancelText}
              </button>
              <button 
                className="btn-primary"
                style={confirmState.isDestructive ? { background: 'var(--accent-red)', color: 'white', borderColor: 'var(--accent-red)' } : {}}
                onClick={() => {
                  setConfirmState({ ...confirmState, isOpen: false });
                  confirmState.onConfirm();
                }}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;