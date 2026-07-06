import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye, Phone, Loader2,
  Briefcase, Layers, MapPin, Plus, ChevronDown, ChevronRight,
  UserPlus, UserX, Tag, ToggleLeft, ToggleRight, AlertTriangle, Info,
  ClipboardList, MessageSquare, Send, Clock, Circle, X, Menu, Home
} from 'lucide-react';
import Login from './pages/Login';
import { auth, db } from './services/firebase';
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, addDoc, deleteDoc, serverTimestamp, query, orderBy, where, writeBatch, onSnapshot, setDoc } from 'firebase/firestore';

// ===== INTERFACES =====
interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
  proyectoId?: string;
  fsId?: string;
  estado?: 'activo' | 'papelera';
}

interface DocumentoFirestore {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  proyectoId: string;
  subidoPor: string;
  fechaCreacion: any;
  estado?: 'activo' | 'papelera';
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

interface AreaLector {
  uid: string;
  activo: boolean;
}

interface Area {
  id: string;
  nombre: string;
  colaboradores: string[];
  lectores?: AreaLector[];
  proyectoId: string;
}

interface ToastMsg {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

interface RequirementComment {
  id: string;
  text: string;
  userId: string;
  timestamp: string;
}

interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'Alta' | 'Media' | 'Baja';
  proyectoId: string;
  areaId?: string;
  colaboradores?: string[];
  lectores?: AreaLector[];
  createdBy: string;
  status: 'Abierto' | 'En Progreso' | 'Cerrado';
  comments: RequirementComment[];
  createdAt: string;
  updatedAt: string;
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
type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial' | 'proyectos' | 'proyecto-detalle' | 'categorias' | 'papelera' | 'requerimientos' | 'requerimiento-detalle';

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
  const [filterCategoriaId, setFilterCategoriaId] = useState('all');
  const [filterSubcategoriaId, setFilterSubcategoriaId] = useState('all');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

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
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [newAreaName, setNewAreaName] = useState('');

  // --- Modal Asignar Usuarios a Área ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignAreaId, setAssignAreaId] = useState<string | null>(null);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedReaders, setSelectedReaders] = useState<string[]>([]);
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());

  // --- Documentos en Firestore ---
  const [documentosFS, setDocumentosFS] = useState<DocumentoFirestore[]>([]);
  const [uploadProyectoId, setUploadProyectoId] = useState<string | null>(null);

  // --- Requerimientos ---
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [showCreateRequirement, setShowCreateRequirement] = useState(false);
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqDesc, setNewReqDesc] = useState('');
  const [newReqPriority, setNewReqPriority] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [newReqProjectId, setNewReqProjectId] = useState('');
  const [newReqAreaId, setNewReqAreaId] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [reqFilterStatus, setReqFilterStatus] = useState('all');

  // --- Previsualización de PDF ---
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  // --- Sidebar móvil ---
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // --- Subida múltiple ---
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; uploading: boolean }>({ current: 0, total: 0, uploading: false });

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
            setShowProfileModal(true);
          }
        } catch (error) {
          console.error("Error al obtener rol:", error);
          setUserRole('lector');
          setShowProfileModal(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Cargar metadatos globales (categorías y proyectos) en cuanto haya sesión
  useEffect(() => {
    if (isAuthenticated) {
      cargarCategorias();
      cargarProyectos();
      getDocs(collection(db, 'categorias')).then(snap => {
        const cats: Categoria[] = [];
        snap.forEach(d => cats.push({ id: d.id, ...d.data() } as Categoria));
        cargarTodasSubcategorias(cats);
      }).catch(err => console.error("Error al cargar datos globales", err));
    }
  }, [isAuthenticated]);

  // ===== AUDITORÍA =====
  const registrarAuditoria = async (accion: string, documento: string) => {
    try {
      await addDoc(collection(db, 'auditoria'), {
        usuario: auth.currentUser?.displayName || auth.currentUser?.email || 'Usuario',
        userId: auth.currentUser?.uid || 'unknown',
        accion,
        documento,
        fecha: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error al registrar auditoría:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoadingAudit(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const limitDateISO = thirtyDaysAgo.toISOString();

    const q = query(
      collection(db, 'auditoria'),
      where('fecha', '>=', limitDateISO),
      orderBy('fecha', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistoryLogs(logs);
      setLoadingAudit(false);
    }, (error) => {
      console.error('Error al cargar auditoría:', error);
      setLoadingAudit(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  const limpiarAuditoria = async () => {
    try {
      setLoadingAudit(true);
      const snapshot = await getDocs(collection(db, 'auditoria'));
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      showToast('success', '✅ Auditoría limpiada exitosamente.');
    } catch (error) {
      console.error('Error al limpiar auditoría:', error);
      showToast('error', 'Error al limpiar la auditoría.');
    } finally {
      setLoadingAudit(false);
    }
  };

  // ===== SUBIDA DE ARCHIVOS =====
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);

    // Validar que todos sean PDF
    const nonPdfFiles = files.filter(f => f.type !== 'application/pdf');
    if (nonPdfFiles.length > 0) {
      showToast('warning', `⚠️ ${nonPdfFiles.length} archivo(s) no son PDF y fueron ignorados.\nSolo se permiten archivos PDF.`);
    }
    const pdfFiles = files.filter(f => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validar tamaño individual
    const oversizedFiles = pdfFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      showToast('warning', `⚠️ ${oversizedFiles.length} archivo(s) superan el límite de 10 MB individual y fueron excluidos.`);
    }
    const validFiles = pdfFiles.filter(f => f.size <= MAX_FILE_SIZE);
    if (validFiles.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validar tamaño total
    const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      showToast('warning', `⚠️ El tamaño total de los archivos (${formatFileSize(totalSize)}) supera el límite de 50 MB.\nReduce la cantidad de archivos e inténtalo de nuevo.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Subir archivos uno a uno con progreso
    setUploadProgress({ current: 0, total: validFiles.length, uploading: true });
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      setUploadProgress({ current: i + 1, total: validFiles.length, uploading: true });

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

        registrarAuditoria('Subió el archivo', fileName || file.name);
        successCount++;
      } catch (err: unknown) {
        errorCount++;
        if (axios.isAxiosError(err) && err.response?.status === 413) {
          showToast('warning', `⚠️ "${file.name}" es demasiado pesado para el servidor.`);
        } else {
          showToast('error', `❌ Error al subir "${file.name}".`);
        }
      }
    }

    setUploadProgress({ current: 0, total: 0, uploading: false });

    // Resumen final
    if (successCount > 0) {
      showToast('success', `✅ ${successCount} archivo(s) subido(s) exitosamente.${errorCount > 0 ? `\n⚠️ ${errorCount} archivo(s) fallaron.` : ''}`);
    } else if (errorCount > 0) {
      showToast('error', `❌ No se pudo subir ningún archivo. ${errorCount} error(es).`);
    }

    // Recargar vistas
    if (vistaActual === 'explorador') {
      abrirExplorador();
    }
    if (vistaActual === 'proyecto-detalle') {
      abrirExploradorContexto();
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploadProyectoId(null);
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

      const mergedFiles: FileInfo[] = filesFromApi.map(f => {
        const fDoc = docs.find(d => d.filename === f.name);
        if (fDoc) {
          return { ...f, proyectoId: fDoc.proyectoId, fsId: fDoc.id, estado: (fDoc.estado || 'activo') as 'activo' | 'papelera' };
        }
        return { ...f, estado: 'activo' as 'activo' | 'papelera' };
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
        
        const mergedFiles: FileInfo[] = filesFromApi.map(f => {
          const fDoc = documentosFS.find(d => d.filename === f.name);
          if (fDoc) return { ...f, proyectoId: fDoc.proyectoId, fsId: fDoc.id, estado: (fDoc.estado || 'activo') as 'activo' | 'papelera' };
          return { ...f, estado: 'activo' as 'activo' | 'papelera' };
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
      if (f.estado === 'papelera') return false;

      let matchExt = true;
      if (filterExtension !== 'all') matchExt = f.name.toLowerCase().endsWith(`.${filterExtension}`);

      let matchSize = true;
      if (filterSize !== 'all') {
        if (filterSize === 'small') matchSize = f.size < 1024 * 1024;
        else if (filterSize === 'medium') matchSize = f.size >= 1024 * 1024 && f.size <= 5 * 1024 * 1024;
        else if (filterSize === 'large') matchSize = f.size > 5 * 1024 * 1024;
      }

      let matchCat = true;
      if (filterCategoriaId !== 'all' && f.proyectoId) {
        const proj = proyectos.find(p => p.id === f.proyectoId);
        matchCat = proj ? proj.categoriaId === filterCategoriaId : false;
      } else if (filterCategoriaId !== 'all' && !f.proyectoId) {
        matchCat = false;
      }

      let matchSub = true;
      if (filterSubcategoriaId !== 'all' && f.proyectoId) {
        const proj = proyectos.find(p => p.id === f.proyectoId);
        matchSub = proj ? proj.subcategoriaId === filterSubcategoriaId : false;
      } else if (filterSubcategoriaId !== 'all' && !f.proyectoId) {
        matchSub = false;
      }

      return matchExt && matchSize && matchCat && matchSub;
    });
  };

  const filteredSearchResults = aplicarFiltrosAvanzados(searchResults);
  const filteredExploradorResults = aplicarFiltrosAvanzados(listaArchivos);

  // Subcategorías filtradas por categoría seleccionada en filtro
  const subcategoriasParaFiltro = filterCategoriaId !== 'all'
    ? subcategorias.filter(s => s.categoriaId === filterCategoriaId)
    : subcategorias;

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

  // ===== ELIMINAR ARCHIVO (Soft Delete) =====
  const handleDelete = async (archivo: FileInfo) => {
    if (userRole === 'lector') return;

    if (!archivo.fsId) {
      // Si el archivo es huérfano, le creamos un registro en papelera
      showConfirm(
        'Mover a Papelera',
        `¿Estás seguro de que deseas enviar el archivo a la papelera?\n\n"${archivo.name}"`,
        async () => {
          try {
            await addDoc(collection(db, 'documentos'), {
              filename: archivo.name,
              originalName: archivo.name,
              size: archivo.size,
              proyectoId: '',
              subidoPor: auth.currentUser?.uid || '',
              fechaCreacion: serverTimestamp(),
              estado: 'papelera'
            });
            showToast('success', '🗑️ Archivo movido a la papelera.');
            registrarAuditoria('Movió archivo a papelera', archivo.name);
            if (vistaActual === 'explorador') abrirExplorador();
            else if (vistaActual === 'proyecto-detalle') abrirExploradorContexto();
            else {
              const response = await axios.get(`${API_BASE}/api/files`);
              setListaArchivos(response.data);
            }
          } catch {
            showToast('error', '❌ Error al mover a la papelera.');
          }
        },
        true,
        'Mover a papelera',
        'Cancelar'
      );
      return;
    }

    showConfirm(
      'Mover a Papelera',
      `¿Estás seguro de que deseas enviar el archivo a la papelera?\n\n"${archivo.name}"`,
      async () => {
        try {
          await updateDoc(doc(db, 'documentos', archivo.fsId!), { estado: 'papelera' });
          showToast('success', '🗑️ Archivo movido a la papelera.');
          registrarAuditoria('Movió archivo a papelera', archivo.name);
          if (vistaActual === 'explorador') abrirExplorador();
          else if (vistaActual === 'proyecto-detalle') abrirExploradorContexto();
          else {
            const response = await axios.get(`${API_BASE}/api/files`);
            setListaArchivos(response.data);
          }
        } catch {
          showToast('error', '❌ Error al mover a la papelera.');
        }
      },
      true,
      'Mover a papelera',
      'Cancelar'
    );
  };

  const handleRestore = async (archivo: FileInfo) => {
    if (!archivo.fsId) return;
    try {
      await updateDoc(doc(db, 'documentos', archivo.fsId), { estado: 'activo' });
      showToast('success', '♻️ Archivo restaurado.');
      registrarAuditoria('Restauró archivo', archivo.name);
      abrirExploradorContexto();
    } catch {
      showToast('error', '❌ Error al restaurar.');
    }
  };

  const handleHardDelete = async (archivo: FileInfo) => {
    showConfirm(
      'Eliminar Permanentemente',
      `⚠️ Esta acción es irreversible.\n¿Confirmas que deseas eliminar el archivo permanentemente?\n\n"${archivo.name}"`,
      async () => {
        try {
          await axios.delete(`${API_BASE}/api/files/${encodeURIComponent(archivo.name)}`);
          if (archivo.fsId) {
            await deleteDoc(doc(db, 'documentos', archivo.fsId));
          }
          showToast('success', '🗑️ Archivo eliminado permanentemente.');
          registrarAuditoria('Eliminó archivo permanentemente', archivo.name);
          abrirExploradorContexto();
        } catch {
          showToast('error', '❌ Error al intentar eliminar el archivo.');
        }
      },
      true,
      'Eliminar Permanentemente',
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

  const cambiarRol = async (userId: string, nuevoRol: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { rol: nuevoRol });
      cargarUsuarios();
      showToast('success', '✅ Rol actualizado correctamente.');
    } catch {
      showToast('error', "Error al cambiar el rol");
    }
  };

  // ===== ACTIVAR / DESACTIVAR USUARIO =====
  const toggleUserActive = async (userId: string, currentStatus: boolean | undefined) => {
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

  const crearCategoria = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categorias'), {
        nombre: newCategoryName,
        creadoPor: auth.currentUser?.uid
      });
      setNewCategoryName('');
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

  const crearSubcategoria = async (catId: string) => {
    if (!newSubcategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categorias', catId, 'subcategorias'), {
        nombre: newSubcategoryName,
        categoriaId: catId
      });
      setNewSubcategoryName('');
      setAddingSubcategoryTo(null);
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

  const crearProyecto = async () => {
    if (!newProjectName.trim() || !newProjectCatId || !newProjectSubcatId) {
      showToast('warning', '⚠️ Completa todos los campos obligatorios.');
      return;
    }
    try {
      await addDoc(collection(db, 'proyectos'), {
        nombre: newProjectName,
        descripcion: newProjectDesc,
        categoriaId: newProjectCatId,
        subcategoriaId: newProjectSubcatId,
        creadoPor: auth.currentUser?.uid,
        fechaCreacion: serverTimestamp(),
        estado: 'activo'
      });
      setNewProjectName('');
      setNewProjectDesc('');
      setNewProjectCatId('');
      setNewProjectSubcatId('');
      setShowCreateProject(false);
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

  const cargarTodasAreas = async () => {
    try {
      const areas: Area[] = [];
      for (const p of proyectos) {
        const snap = await getDocs(collection(db, 'proyectos', p.id, 'areas'));
        snap.forEach(d => areas.push({ id: d.id, ...d.data(), proyectoId: p.id } as Area));
      }
      setAllAreas(areas);
    } catch (err) {
      console.error('Error cargando todas las áreas:', err);
    }
  };

  const crearArea = async (proyectoId: string) => {
    if (!newAreaName.trim()) return;
    try {
      await addDoc(collection(db, 'proyectos', proyectoId, 'areas'), {
        nombre: newAreaName,
        colaboradores: [],
        lectores: []
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

  // ===== ASIGNAR USUARIOS AL ÁREA =====
  const openAssignModal = (areaId: string, currentCollabs: string[], currentReaders: AreaLector[]) => {
    setAssignAreaId(areaId);
    setSelectedCollaborators([...currentCollabs]);
    setSelectedReaders(currentReaders.map(l => l.uid));
    cargarUsuarios();
    setShowAssignModal(true);
  };

  const guardarAsignacion = async () => {
    if (!selectedProject || !assignAreaId) return;
    try {
      const area = projectAreas.find(a => a.id === assignAreaId);
      if (!area) return;

      const currentLectores = area.lectores || [];
      const newLectoresList: AreaLector[] = selectedReaders.map(uid => {
        const existing = currentLectores.find(l => l.uid === uid);
        return existing ? existing : { uid, activo: true };
      });

      const updates: any = {};
      if (userRole === 'admin') {
        updates.colaboradores = selectedCollaborators;
      }
      updates.lectores = newLectoresList;

      await updateDoc(doc(db, 'proyectos', selectedProject.id, 'areas', assignAreaId), updates);
      
      setShowAssignModal(false);
      setAssignAreaId(null);
      setSelectedCollaborators([]);
      setSelectedReaders([]);
      cargarAreas(selectedProject.id);
      showToast('success', '✅ Usuarios asignados correctamente.');
    } catch {
      showToast('error', '❌ Error al asignar usuarios.');
    }
  };

  const toggleLectorAreaActivo = async (areaId: string, lectorUid: string, currentActivo: boolean) => {
    if (!selectedProject) return;
    try {
      const area = projectAreas.find(a => a.id === areaId);
      if (!area) return;
      const updatedLectores = (area.lectores || []).map(l => 
        l.uid === lectorUid ? { ...l, activo: !currentActivo } : l
      );
      await updateDoc(doc(db, 'proyectos', selectedProject.id, 'areas', areaId), {
        lectores: updatedLectores
      });
      cargarAreas(selectedProject.id);
      showToast('success', `Lector ${!currentActivo ? 'activado' : 'desactivado'}.`);
    } catch {
      showToast('error', 'Error al cambiar estado del lector.');
    }
  };

  const eliminarLectorArea = async (areaId: string, lectorUid: string) => {
    if (!selectedProject) return;
    showConfirm('Eliminar Lector', '¿Eliminar este lector del área?', async () => {
      try {
        const area = projectAreas.find(a => a.id === areaId);
        if (!area) return;
        const updatedLectores = (area.lectores || []).filter(l => l.uid !== lectorUid);
        await updateDoc(doc(db, 'proyectos', selectedProject.id, 'areas', areaId), {
          lectores: updatedLectores
        });
        cargarAreas(selectedProject.id);
        showToast('success', 'Lector eliminado.');
      } catch {
        showToast('error', 'Error al eliminar lector.');
      }
    }, true);
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
    await cargarRequerimientos();
    await cargarTodasAreas();
    const snap = await getDocs(collection(db, 'categorias'));
    const cats: Categoria[] = [];
    snap.forEach(d => cats.push({ id: d.id, ...d.data() } as Categoria));
    await cargarTodasSubcategorias(cats);
    setVistaActual('proyectos');
  };

  // ===== REQUERIMIENTOS =====
  const cargarRequerimientos = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/requirements`);
      setRequirements(res.data);
    } catch (err) {
      console.error('Error cargando requerimientos:', err);
      showToast('error', '❌ Error al cargar los requerimientos.');
    }
  };

  const crearRequerimiento = async () => {
    if (!newReqTitle.trim()) {
      showToast('warning', '⚠️ El título es obligatorio.');
      return;
    }
    if (!newReqAreaId) {
      showToast('warning', '⚠️ Debes seleccionar un área.');
      return;
    }

    const area = projectAreas.find(a => a.id === newReqAreaId);
    if (!area) return;

    try {
      await axios.post(`${API_BASE}/api/requirements`, {
        title: newReqTitle,
        description: newReqDesc,
        priority: newReqPriority,
        proyectoId: newReqProjectId,
        areaId: newReqAreaId,
        colaboradores: area.colaboradores || [],
        lectores: area.lectores ? area.lectores.filter(l => l.activo) : [],
        createdBy: auth.currentUser?.uid || ''
      });
      setNewReqTitle('');
      setNewReqDesc('');
      setNewReqPriority('Media');
      setNewReqAreaId('');
      setShowCreateRequirement(false);
      cargarRequerimientos();
      registrarAuditoria('Creó requerimiento', newReqTitle);
      showToast('success', '✅ Requerimiento creado exitosamente.');
    } catch {
      showToast('error', '❌ Error al crear el requerimiento.');
    }
  };

  const eliminarRequerimiento = async (id: string) => {
    try {
      await axios.delete(`${API_BASE}/api/requirements/${id}`);
      cargarRequerimientos();
      registrarAuditoria('Eliminó requerimiento', `ID: ${id}`);
      showToast('success', '✅ Requerimiento eliminado.');
    } catch {
      showToast('error', '❌ Error al eliminar el requerimiento.');
    }
  };

  const actualizarEstadoReq = async (reqId: string, nuevoEstado: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/api/requirements/${reqId}/status`, { status: nuevoEstado });
      const updated: Requirement = res.data;
      setRequirements(prev => prev.map(r => r.id === reqId ? updated : r));
      if (selectedRequirement?.id === reqId) setSelectedRequirement(updated);
      registrarAuditoria(`Cambió estado de requerimiento a ${nuevoEstado}`, updated.title);
      showToast('success', `✅ Estado cambiado a "${nuevoEstado}".`);
    } catch {
      showToast('error', '❌ Error al cambiar el estado.');
    }
  };

  const actualizarPrioridadReq = async (reqId: string, nuevaPrioridad: string) => {
    try {
      const res = await axios.patch(`${API_BASE}/api/requirements/${reqId}/priority`, { priority: nuevaPrioridad });
      const updated: Requirement = res.data;
      setRequirements(prev => prev.map(r => r.id === reqId ? updated : r));
      if (selectedRequirement?.id === reqId) setSelectedRequirement(updated);
      registrarAuditoria(`Cambió prioridad de requerimiento a ${nuevaPrioridad}`, updated.title);
      showToast('success', `✅ Prioridad cambiada a "${nuevaPrioridad}".`);
    } catch {
      showToast('error', '❌ Error al cambiar la prioridad.');
    }
  };

  const agregarComentario = async (reqId: string) => {
    if (!newCommentText.trim()) return;
    try {
      await axios.post(`${API_BASE}/api/requirements/${reqId}/comments`, {
        text: newCommentText,
        userId: auth.currentUser?.uid || '',
        timestamp: new Date().toISOString()
      });
      setNewCommentText('');
      // Recargar el requerimiento actualizado
      const res = await axios.get(`${API_BASE}/api/requirements`);
      const allReqs: Requirement[] = res.data;
      setRequirements(allReqs);
      const updated = allReqs.find(r => r.id === reqId);
      if (updated) setSelectedRequirement(updated);
      showToast('success', '💬 Comentario agregado.');
    } catch {
      showToast('error', '❌ Error al agregar el comentario.');
    }
  };

  const abrirRequerimientos = async (_proyectoId?: string) => {
    await cargarRequerimientos();
    setVistaActual('requerimientos');
  };

  const abrirRequerimientoDetalle = (req: Requirement) => {
    setSelectedRequirement(req);
    setNewCommentText('');
    setVistaActual('requerimiento-detalle');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Abierto': return '#4f8cff';
      case 'En Progreso': return '#fbbf24';
      case 'Cerrado': return '#34d399';
      default: return '#8b92a8';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return '#f87171';
      case 'Media': return '#fbbf24';
      case 'Baja': return '#34d399';
      default: return '#8b92a8';
    }
  };

  const filteredRequirements = requirements
    .filter(req => selectedProject ? req.proyectoId === selectedProject.id : true)
    .filter(req => reqFilterStatus === 'all' ? true : req.status === reqFilterStatus);

  const abrirCategorias = async () => {
    await cargarCategorias();
    setVistaActual('categorias');
  };

  // ===== HELPER: obtener áreas visibles según rol =====
  const getAreasVisibles = () => {
    if (userRole === 'admin') return projectAreas;
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    return projectAreas.filter(area => 
      (area.colaboradores && area.colaboradores.includes(uid)) ||
      (area.lectores && area.lectores.some(l => l.uid === uid && l.activo))
    );
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
            const data = aDoc.data() as Area;
            if (data.colaboradores && data.colaboradores.includes(uid)) {
              isAssigned = true;
            }
            if (data.lectores && data.lectores.some(l => l.uid === uid && l.activo)) {
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
          <div className="file-icon" style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(archivo.name)}>
            <FileText size={20} color="#f87171" />
          </div>
          <div className="file-info">
            <div className="file-name" style={{ cursor: 'pointer' }} onClick={() => setPreviewFile(archivo.name)} title="Click para previsualizar">{archivo.name}</div>
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
            {vistaActual === 'papelera' ? (
              <>
                <button className="file-download" onClick={() => handleRestore(archivo)} style={{ color: '#34d399', border: '1px solid #34d399', background: 'rgba(52, 211, 153, 0.1)' }}>
                  <RefreshCcw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Restaurar
                </button>
                {userRole !== 'lector' && (
                  <button className="file-delete" onClick={() => handleHardDelete(archivo)} title="Eliminar definitivamente">
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="file-download" onClick={() => handleDownload(archivo.name)}>
                  <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Descargar
                </button>
                {userRole !== 'lector' && (
                  <button className="file-delete" onClick={() => handleDelete(archivo)} title="Mover a papelera">
                    <Trash2 size={14} />
                  </button>
                )}
              </>
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

      // Usamos setDoc con merge por si Login.tsx no pudo crear el documento inicialmente
      await setDoc(doc(db, 'users', user.uid), {
        nombre: profileName.trim(),
        telefono: profilePhone.trim(),
        correo: user.email || '',
        rol: 'lector',
        estado: 'Activo',
        perfilCompleto: true,
        fechaCreacion: new Date().toISOString()
      }, { merge: true });

      setDisplayName(profileName.trim());
      setShowProfileModal(false);
    } catch (err: any) {
      console.error('Error al completar perfil:', err);
      setProfileError('Error al guardar: ' + (err.message || 'Inténtalo de nuevo.'));
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

  const showSidebar = vistaActual !== 'dashboard';

  // Navegación del sidebar: navegar y cerrar sidebar móvil
  const sidebarNavigate = (vista: Vista, action?: () => void) => {
    setSidebarOpen(false);
    if (action) {
      action();
    } else {
      setVistaActual(vista);
    }
  };

  // Sidebar component
  const renderSidebar = () => (
    <aside className={`app-sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
      {/* Botón Inicio */}
      <button
        className="sidebar-home-btn"
        onClick={() => sidebarNavigate('dashboard')}
      >
        <Home size={16} /> Inicio
      </button>
      <div className="sidebar-divider" />

      {/* Gestión */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">
          <Briefcase size={10} /> Gestión
        </div>
        <button
          className={`sidebar-item${vistaActual === 'proyectos' || vistaActual === 'proyecto-detalle' ? ' active' : ''}`}
          onClick={() => sidebarNavigate('proyectos', abrirProyectos)}
          style={{ animationDelay: '0.04s' }}
        >
          <Briefcase size={18} /> Proyectos
        </button>
        {userRole === 'admin' && (
          <button
            className={`sidebar-item${vistaActual === 'categorias' ? ' active' : ''}`}
            onClick={() => sidebarNavigate('categorias', abrirCategorias)}
            style={{ animationDelay: '0.08s' }}
          >
            <Layers size={18} /> Categorías
          </button>
        )}
      </div>

      {/* Documentos */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">
          <FileText size={10} /> Documentos
        </div>
        <button
          className={`sidebar-item${vistaActual === 'explorador' ? ' active' : ''}`}
          onClick={() => sidebarNavigate('explorador', abrirExplorador)}
          style={{ animationDelay: '0.12s' }}
        >
          <FolderOpen size={18} /> Explorar Archivos
        </button>
        <button
          className={`sidebar-item${vistaActual === 'busqueda' ? ' active' : ''}`}
          onClick={() => sidebarNavigate('busqueda', abrirBusqueda)}
          style={{ animationDelay: '0.16s' }}
        >
          <Search size={18} /> Buscar
        </button>
      </div>

      {/* Administración (solo admin) */}
      {userRole === 'admin' && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">
            <Shield size={10} /> Administración
          </div>
          <button
            className={`sidebar-item${vistaActual === 'usuarios' ? ' active' : ''}`}
            onClick={() => sidebarNavigate('usuarios', () => { cargarUsuarios(); setVistaActual('usuarios'); })}
            style={{ animationDelay: '0.20s' }}
          >
            <Users size={18} /> Gestión Roles
          </button>
          <button
            className={`sidebar-item${vistaActual === 'historial' ? ' active' : ''}`}
            onClick={() => sidebarNavigate('historial', () => setVistaActual('historial'))}
            style={{ animationDelay: '0.24s' }}
          >
            <History size={18} /> Auditoría
          </button>
          <button
            className={`sidebar-item${vistaActual === 'papelera' ? ' active' : ''}`}
            onClick={() => sidebarNavigate('papelera', () => { setVistaActual('papelera'); abrirExploradorContexto(); })}
            style={{ animationDelay: '0.28s' }}
          >
            <Trash2 size={18} /> Papelera
          </button>
        </div>
      )}

      {/* Mi Cuenta */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">
          <User size={10} /> Mi Cuenta
        </div>
        <button
          className={`sidebar-item${vistaActual === 'configuracion' ? ' active' : ''}`}
          onClick={() => sidebarNavigate('configuracion', abrirConfiguracion)}
          style={{ animationDelay: '0.32s' }}
        >
          <Settings size={18} /> Configuración
        </button>
      </div>

      {/* Requerimientos (visible si hay proyecto seleccionado y estamos en contexto de reqs) */}
      {selectedProject && (vistaActual === 'requerimientos' || vistaActual === 'requerimiento-detalle') && (
        <div className="sidebar-section">
          <div className="sidebar-section-label">
            <ClipboardList size={10} /> Proyecto Actual
          </div>
          <button
            className="sidebar-item"
            onClick={() => sidebarNavigate('proyecto-detalle', () => abrirProyectoDetalle(selectedProject))}
            style={{ animationDelay: '0.36s' }}
          >
            <Briefcase size={18} /> {selectedProject.nombre}
          </button>
          <button
            className={`sidebar-item${vistaActual === 'requerimientos' ? ' active' : ''}`}
            onClick={() => sidebarNavigate('requerimientos', () => { cargarRequerimientos(); setVistaActual('requerimientos'); })}
            style={{ animationDelay: '0.40s' }}
          >
            <ClipboardList size={18} /> Requerimientos
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <div className="app-layout">
      {/* HEADER */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {showSidebar && (
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Menú de navegación"
            >
              <Menu size={20} />
            </button>
          )}
          <div>
            <h1>Gestión Documental</h1>
            <div className="header-sub">
              {userRole === 'admin' ? 'Panel de Administración' : userRole === 'colaborador' ? 'Panel de Colaborador' : 'Panel de Lector'}
            </div>
          </div>
        </div>
        <button onClick={() => { setIsAuthenticated(false); signOut(auth); }} className="btn-logout" title="Cerrar Sesión">
          <LogOut size={16} /> <span className="logout-text">Salir</span>
        </button>
      </header>

      {/* Sidebar overlay for mobile */}
      {showSidebar && (
        <div
          className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />
      )}


      <div className={showSidebar ? 'app-body-with-sidebar' : ''}>
        {showSidebar && renderSidebar()}
        <main className="app-main">
          {/* HIDDEN FILE INPUT */}
          <input type="file" accept="application/pdf" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

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

                  <button className="action-card" onClick={() => { setVistaActual('papelera'); abrirExploradorContexto(); }}>
                    <div className="card-icon" style={{ background: 'rgba(248, 113, 113, 0.1)' }}>
                      <Trash2 size={26} color="#f87171" />
                    </div>
                    <h3>Papelera de Reciclaje</h3>
                    <p>Ver y restaurar documentos eliminados</p>
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
              <div className="advanced-filters-panel">
                <div className="filter-group">
                  <span className="filter-label">Extensión</span>
                  <select className="filter-select" value={filterExtension} onChange={(e) => setFilterExtension(e.target.value)}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Tamaño</span>
                  <select className="filter-select" value={filterSize} onChange={(e) => setFilterSize(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="small">Pequeño (&lt; 1MB)</option>
                    <option value="medium">Mediano (1MB - 5MB)</option>
                    <option value="large">Grande (&gt; 5MB)</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Categoría</span>
                  <select className="filter-select" value={filterCategoriaId} onChange={(e) => { setFilterCategoriaId(e.target.value); setFilterSubcategoriaId('all'); }}>
                    <option value="all">Todas</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Subcategoría</span>
                  <select className="filter-select" value={filterSubcategoriaId} onChange={(e) => setFilterSubcategoriaId(e.target.value)}>
                    <option value="all">Todas</option>
                    {subcategoriasParaFiltro.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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

        {/* === PAPELERA === */}
        {vistaActual === 'papelera' && userRole === 'admin' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2 style={{ color: 'var(--accent-red)' }}>Papelera de Reciclaje</h2>
              <span className="badge">{listaArchivos.filter(f => f.estado === 'papelera').length}</span>
            </div>

            {listaArchivos.filter(f => f.estado === 'papelera').length === 0 ? (
              <div className="empty-state">
                <Trash2 size={48} />
                <p>La papelera está vacía.</p>
              </div>
            ) : (
              renderFileList(listaArchivos.filter(f => f.estado === 'papelera'))
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
              <div className="advanced-filters-panel">
                <div className="filter-group">
                  <span className="filter-label">Extensi&#243;n</span>
                  <select className="filter-select" value={filterExtension} onChange={(e) => setFilterExtension(e.target.value)}>
                    <option value="all">Todas</option>
                    <option value="pdf">.pdf</option>
                    <option value="docx">.docx</option>
                    <option value="xlsx">.xlsx</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Tama&#241;o</span>
                  <select className="filter-select" value={filterSize} onChange={(e) => setFilterSize(e.target.value)}>
                    <option value="all">Todos</option>
                    <option value="small">Peque&#241;o (&lt; 1MB)</option>
                    <option value="medium">Mediano (1MB - 5MB)</option>
                    <option value="large">Grande (&gt; 5MB)</option>
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Categor&#237;a</span>
                  <select className="filter-select" value={filterCategoriaId} onChange={(e) => { setFilterCategoriaId(e.target.value); setFilterSubcategoriaId('all'); }}>
                    <option value="all">Todas</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Subcategor&#237;a</span>
                  <select className="filter-select" value={filterSubcategoriaId} onChange={(e) => setFilterSubcategoriaId(e.target.value)}>
                    <option value="all">Todas</option>
                    {subcategoriasParaFiltro.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
                      <td data-label="Nombre / Correo" style={{ padding: '12px 16px' }}>
                        <div>{u.nombre || 'Sin nombre'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.correo || u.email}</div>
                      </td>
                      <td data-label="Teléfono" style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                        {u.telefono || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin registrar</span>}
                      </td>
                      <td data-label="Rol Actual" style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
                          backgroundColor: u.rol === 'admin' ? 'rgba(79, 140, 255, 0.15)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          color: u.rol === 'admin' ? '#4f8cff' : u.rol === 'colaborador' ? '#34d399' : '#8b92a8',
                          border: `1px solid ${u.rol === 'admin' ? 'rgba(79, 140, 255, 0.3)' : u.rol === 'colaborador' ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`
                        }}>{u.rol}</span>
                      </td>
                      <td data-label="Cambiar a" style={{ padding: '12px 16px' }}>
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
                      <td data-label="Estado" style={{ padding: '12px 16px' }}>
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
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2 style={{ margin: 0 }}>Historial y Auditoría <span className="badge">{historyLogs.length}</span></h2>
              <button 
                onClick={() => showConfirm('Limpiar Auditoría', '¿Estás seguro de que deseas eliminar todos los registros de auditoría? Esta acción no se puede deshacer.', limpiarAuditoria, true)}
                style={{ marginLeft: 'auto', background: 'rgba(248,113,113,0.1)', color: 'var(--accent-red)', border: '1px solid rgba(248,113,113,0.2)', padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }}
                disabled={loadingAudit || historyLogs.length === 0}
              >
                <Trash2 size={16} /> Limpiar Registros
              </button>
            </div>

            {loadingAudit ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <Loader2 className="spin-icon" size={24} style={{ margin: '0 auto 10px auto' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Cargando registros...</p>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="empty-state">
                <History size={48} />
                <p>No hay registros de auditoría en los últimos 30 días.</p>
              </div>
            ) : (
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
                      <td data-label="Fecha" style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{formatDate(log.fecha)}</td>
                      <td data-label="Usuario" style={{ padding: '12px 16px' }}>{log.usuario}</td>
                      <td data-label="Acción" style={{ padding: '12px 16px' }}>
                        <span style={{ color: log.accion.includes('Eliminó') ? '#f87171' : log.accion.includes('Subió') ? '#34d399' : 'var(--text-secondary)' }}>
                          {log.accion}
                        </span>
                      </td>
                      <td data-label="Documento" style={{ padding: '12px 16px', color: '#4f8cff' }}>{log.documento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
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

            {/* Gráfico de Requerimientos por Estado */}
            {userRole === 'admin' && (() => {
              const abiertos = requirements.filter(r => r.status === 'Abierto').length;
              const enProgreso = requirements.filter(r => r.status === 'En Progreso').length;
              const cerrados = requirements.filter(r => r.status === 'Cerrado').length;
              const total = requirements.length;
              const radius = 70;
              const strokeWidth = 22;
              const circumference = 2 * Math.PI * radius;
              
              const segments = [
                { label: 'Abiertos', count: abiertos, color: '#34d399', bgColor: 'rgba(52, 211, 153, 0.12)' },
                { label: 'En Progreso', count: enProgreso, color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.12)' },
                { label: 'Cerrados', count: cerrados, color: '#f87171', bgColor: 'rgba(248, 113, 113, 0.12)' },
              ];

              // Agrupar requerimientos por área
              const areaMap = new Map<string, { name: string; projectName: string; abiertos: number; enProgreso: number; cerrados: number; total: number }>();
              requirements.forEach(req => {
                const areaId = req.areaId || 'sin-area';
                const area = allAreas.find(a => a.id === areaId);
                const proyecto = proyectos.find(p => p.id === req.proyectoId);
                if (!areaMap.has(areaId)) {
                  areaMap.set(areaId, {
                    name: area?.nombre || 'Sin área',
                    projectName: proyecto?.nombre || '—',
                    abiertos: 0,
                    enProgreso: 0,
                    cerrados: 0,
                    total: 0
                  });
                }
                const entry = areaMap.get(areaId)!;
                entry.total++;
                if (req.status === 'Abierto') entry.abiertos++;
                else if (req.status === 'En Progreso') entry.enProgreso++;
                else if (req.status === 'Cerrado') entry.cerrados++;
              });
              const areaBreakdown = Array.from(areaMap.values()).sort((a, b) => b.total - a.total);

              let accumulatedOffset = 0;

              return (
                <div className="req-chart-container">
                  <div className="req-chart-header">
                    <ClipboardList size={16} />
                    <span>Estado de Requerimientos</span>
                    <span className="req-chart-total-badge">{total} total</span>
                  </div>
                  <div className="req-chart-body">
                    <div className="req-chart-donut-wrapper">
                      <svg viewBox="0 0 200 200" className="req-chart-svg">
                        {/* Background circle */}
                        <circle
                          cx="100" cy="100" r={radius}
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth={strokeWidth}
                        />
                        {/* Data segments */}
                        {total > 0 && segments.map((seg, i) => {
                          const segmentLength = (seg.count / total) * circumference;
                          const offset = accumulatedOffset;
                          accumulatedOffset += segmentLength;
                          if (seg.count === 0) return null;
                          return (
                            <circle
                              key={i}
                              cx="100" cy="100" r={radius}
                              fill="none"
                              stroke={seg.color}
                              strokeWidth={strokeWidth}
                              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                              strokeDashoffset={-offset}
                              strokeLinecap="round"
                              className="req-chart-segment"
                              style={{ 
                                transform: 'rotate(-90deg)', 
                                transformOrigin: '100px 100px',
                                animationDelay: `${i * 0.15}s`,
                                filter: `drop-shadow(0 0 6px ${seg.color}40)`
                              }}
                            />
                          );
                        })}
                      </svg>
                      <div className="req-chart-center-label">
                        <span className="req-chart-center-number">{total}</span>
                        <span className="req-chart-center-text">{total === 0 ? 'Sin datos' : 'Requerimientos'}</span>
                      </div>
                    </div>
                    <div className="req-chart-legend">
                      {segments.map((seg, i) => (
                        <div key={i} className="req-chart-legend-item">
                          <div className="req-chart-legend-dot" style={{ background: seg.color, boxShadow: `0 0 8px ${seg.color}50` }} />
                          <span className="req-chart-legend-label">{seg.label}</span>
                          <span className="req-chart-legend-count" style={{ color: seg.color }}>{seg.count}</span>
                          <span className="req-chart-legend-pct">
                            {total > 0 ? Math.round((seg.count / total) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Desglose por Áreas */}
                  {areaBreakdown.length > 0 && (
                    <div className="req-chart-areas">
                      <div className="req-chart-areas-header">
                        <MapPin size={14} />
                        <span>Desglose por Área</span>
                      </div>
                      <div className="req-chart-areas-table">
                        <div className="req-chart-areas-row req-chart-areas-row-header">
                          <span className="req-chart-area-name">Área</span>
                          <span className="req-chart-area-project">Proyecto</span>
                          <span className="req-chart-area-stat" style={{ color: '#34d399' }}>Abiertos</span>
                          <span className="req-chart-area-stat" style={{ color: '#fbbf24' }}>En Prog.</span>
                          <span className="req-chart-area-stat" style={{ color: '#f87171' }}>Cerrados</span>
                          <span className="req-chart-area-stat-total">Total</span>
                        </div>
                        {areaBreakdown.map((area, i) => (
                          <div key={i} className="req-chart-areas-row" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                            <span className="req-chart-area-name">
                              <MapPin size={12} style={{ opacity: 0.5 }} />
                              {area.name}
                            </span>
                            <span className="req-chart-area-project">
                              <Briefcase size={11} style={{ opacity: 0.4 }} />
                              {area.projectName}
                            </span>
                            <span className="req-chart-area-stat" style={{ color: '#34d399' }}>{area.abiertos}</span>
                            <span className="req-chart-area-stat" style={{ color: '#fbbf24' }}>{area.enProgreso}</span>
                            <span className="req-chart-area-stat" style={{ color: '#f87171' }}>{area.cerrados}</span>
                            <span className="req-chart-area-stat-total">{area.total}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
            
            <div style={{ marginTop: 24, marginBottom: 16 }}>
              <button 
                onClick={async () => {
                  if (selectedProject) {
                    await cargarRequerimientos();
                    setReqFilterStatus('all');
                    setNewReqProjectId(selectedProject.id);
                    setVistaActual('requerimientos');
                  }
                }} 
                className="btn-primary" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
              >
                <ClipboardList size={18} /> Ver Requerimientos del Proyecto
              </button>
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
                {getAreasVisibles().map(area => {
                  const isExpanded = expandedAreas.has(area.id);
                  const toggleExpand = () => {
                    setExpandedAreas(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(area.id)) newSet.delete(area.id);
                      else newSet.add(area.id);
                      return newSet;
                    });
                  };
                  return (
                    <div key={area.id} className="area-card" style={{ cursor: 'pointer' }} onClick={toggleExpand}>
                      <div className="area-card-header">
                        <div className="area-card-title">
                          <MapPin size={18} />
                          {area.nombre}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                          {(userRole === 'admin' || userRole === 'colaborador') && (
                            <button
                              className="btn-icon primary"
                              onClick={() => openAssignModal(area.id, area.colaboradores || [], area.lectores || [])}
                              title="Asignar Usuarios"
                              style={{ width: 34, height: 34 }}
                            >
                              <UserPlus size={16} />
                            </button>
                          )}
                          {userRole === 'admin' && (
                            <button
                              className="btn-icon danger"
                              onClick={() => eliminarArea(selectedProject.id, area.id, area.nombre)}
                              title="Eliminar área"
                              style={{ width: 34, height: 34 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div onClick={e => e.stopPropagation()} style={{ marginTop: 10 }}>
                          <h5 style={{ fontSize: 13, marginBottom: 5 }}>Colaboradores:</h5>
                          {(!area.colaboradores || area.colaboradores.length === 0) ? (
                            <p className="empty-collaborators" style={{ marginTop: 0 }}>Sin colaboradores asignados</p>
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

                          <h5 style={{ fontSize: 13, marginTop: 15, marginBottom: 5 }}>Lectores:</h5>
                          {(!area.lectores || area.lectores.length === 0) ? (
                            <p className="empty-collaborators" style={{ marginTop: 0 }}>Sin lectores asignados</p>
                          ) : (
                            <div className="collaborator-chips">
                              {area.lectores.map(l => (
                                <div key={l.uid} className="collaborator-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: l.activo ? 1 : 0.5 }}>
                                  <User size={12} />
                                  {getNombreUsuario(l.uid)}
                                  {(userRole === 'admin' || userRole === 'colaborador') && (
                                    <input 
                                      type="checkbox" 
                                      checked={l.activo} 
                                      onChange={() => toggleLectorAreaActivo(area.id, l.uid, l.activo)} 
                                      title={l.activo ? 'Desactivar lector' : 'Activar lector'}
                                    />
                                  )}
                                  {userRole === 'admin' && (
                                    <Trash2 size={12} style={{ cursor: 'pointer', color: 'var(--accent-red)' }} onClick={() => eliminarLectorArea(area.id, l.uid)} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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

        {/* === REQUERIMIENTOS === */}
        {vistaActual === 'requerimientos' && selectedProject && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('proyecto-detalle')}>
                <ArrowLeft size={16} /> Volver al Proyecto
              </button>
              <h2>Requerimientos: {selectedProject.nombre}</h2>
              <span className="badge">
                {requirements.filter(r => r.proyectoId === selectedProject.id).length}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <select
                  className="filter-select"
                  value={reqFilterStatus}
                  onChange={(e) => setReqFilterStatus(e.target.value)}
                  style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}
                >
                  <option value="all">Todos los estados</option>
                  <option value="Abierto">Abierto</option>
                  <option value="En Progreso">En Progreso</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
            </div>

            {/* Crear requerimiento */}
            {userRole === 'admin' && (
              <>
                {!showCreateRequirement ? (
                  <button className="btn-create" onClick={() => setShowCreateRequirement(true)} style={{ marginBottom: 20 }}>
                    <Plus size={16} /> Nuevo Requerimiento
                  </button>
                ) : (
                  <div className="create-form-card">
                    <h3><ClipboardList size={18} /> Nuevo Requerimiento</h3>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Título <span className="required-badge">Obligatorio</span></label>
                        <input
                          type="text"
                          placeholder="Ej: Implementar módulo de reportes"
                          value={newReqTitle}
                          onChange={(e) => setNewReqTitle(e.target.value)}
                          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit' }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Descripción</label>
                        <textarea
                          placeholder="Descripción detallada del requerimiento..."
                          value={newReqDesc}
                          onChange={(e) => setNewReqDesc(e.target.value)}
                          style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit', minHeight: '80px', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="input-group">
                        <label>Prioridad</label>
                        <select
                          value={newReqPriority}
                          onChange={(e) => setNewReqPriority(e.target.value as 'Alta' | 'Media' | 'Baja')}
                          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '14px', fontFamily: 'inherit' }}
                        >
                          <option value="Alta">Alta</option>
                          <option value="Media">Media</option>
                          <option value="Baja">Baja</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Área <span className="required-badge">Obligatorio</span></label>
                        <select
                          value={newReqAreaId}
                          onChange={(e) => setNewReqAreaId(e.target.value)}
                          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '14px', fontFamily: 'inherit' }}
                        >
                          <option value="">Seleccionar área...</option>
                          {projectAreas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <button className="btn-create" onClick={crearRequerimiento}>
                        <Plus size={14} /> Crear Requerimiento
                      </button>
                      <button className="btn-cancel" onClick={() => setShowCreateRequirement(false)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Lista de requerimientos */}
            {filteredRequirements.length === 0 ? (
              <div className="empty-state">
                <ClipboardList size={48} />
                <p>{requirements.length === 0 ? 'No hay requerimientos creados aún.' : 'No hay requerimientos con ese filtro.'}</p>
              </div>
            ) : (
              <div className="req-list">
                {filteredRequirements.map((req, index) => {
                  const project = proyectos.find(p => p.id === req.proyectoId);
                  return (
                    <div key={req.id} className="req-card" onClick={() => abrirRequerimientoDetalle(req)} style={{ animationDelay: `${index * 0.05}s` }}>
                      <div className="req-card-top">
                        <div className="req-card-title-row">
                          <h4 style={{ flex: 1 }}>{req.title}</h4>
                          <span className="req-status-badge" style={{ color: getStatusColor(req.status), borderColor: getStatusColor(req.status), background: `${getStatusColor(req.status)}15` }}>
                            <Circle size={8} fill={getStatusColor(req.status)} /> {req.status}
                          </span>
                          {userRole === 'admin' && (
                            <button 
                              className="btn-icon danger" 
                              onClick={(e) => {
                                e.stopPropagation();
                                showConfirm(
                                  'Eliminar Requerimiento', 
                                  '¿Estás seguro de que deseas eliminar este requerimiento?', 
                                  () => eliminarRequerimiento(req.id), 
                                  true
                                );
                              }}
                              title="Eliminar requerimiento"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        {req.description && <p className="req-card-desc">{req.description}</p>}
                      </div>
                      <div className="req-card-footer">
                        <span className="req-priority-badge" style={{ color: getPriorityColor(req.priority), borderColor: getPriorityColor(req.priority), background: `${getPriorityColor(req.priority)}15` }}>
                          {req.priority}
                        </span>
                        {project && (
                          <span className="project-meta-tag" style={{ fontSize: '11px', padding: '2px 8px' }}>
                            <Briefcase size={10} /> {project.nombre}
                          </span>
                        )}
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: '12px', marginLeft: 'auto' }}>
                          <MessageSquare size={12} /> {req.comments.length}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          {formatDate(req.createdAt)}
                        </span>
                      </div>
                      {/* Admin actions */}
                      {userRole !== 'lector' && (
                        <div className="req-card-actions" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={req.status}
                            onChange={(e) => actualizarEstadoReq(req.id, e.target.value)}
                            className="req-status-select"
                            style={{ borderColor: getStatusColor(req.status) }}
                          >
                            <option value="Abierto">Abierto</option>
                            <option value="En Progreso">En Progreso</option>
                            <option value="Cerrado">Cerrado</option>
                          </select>
                          {userRole === 'admin' && (
                            <button
                              className="btn-icon danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                showConfirm(
                                  'Eliminar Requerimiento', 
                                  '¿Estás seguro de que deseas eliminar este requerimiento?', 
                                  () => eliminarRequerimiento(req.id), 
                                  true
                                );
                              }}
                              title="Eliminar requerimiento"
                              style={{ width: 30, height: 30 }}
                            >
                              <Trash2 size={13} />
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

        {/* === REQUERIMIENTO DETALLE === */}
        {vistaActual === 'requerimiento-detalle' && selectedRequirement && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => { setVistaActual('requerimientos'); abrirRequerimientos(); }}>
                <ArrowLeft size={16} /> Volver a Requerimientos
              </button>
            </div>

            {/* Cabecera del requerimiento */}
            <div className="req-detail-header">
              <div className="req-detail-info">
                <h2>{selectedRequirement.title}</h2>
                {selectedRequirement.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, margin: '8px 0 16px 0' }}>
                    {selectedRequirement.description}
                  </p>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <span className="req-status-badge" style={{ color: getStatusColor(selectedRequirement.status), borderColor: getStatusColor(selectedRequirement.status), background: `${getStatusColor(selectedRequirement.status)}15`, fontSize: '13px', padding: '5px 14px' }}>
                    <Circle size={8} fill={getStatusColor(selectedRequirement.status)} /> {selectedRequirement.status}
                  </span>
                  <span className="req-priority-badge" style={{ color: getPriorityColor(selectedRequirement.priority), borderColor: getPriorityColor(selectedRequirement.priority), background: `${getPriorityColor(selectedRequirement.priority)}15`, fontSize: '13px', padding: '5px 14px' }}>
                    {selectedRequirement.priority}
                  </span>
                  {selectedRequirement.proyectoId && (
                    <span className="project-meta-tag">
                      <Briefcase size={12} /> {proyectos.find(p => p.id === selectedRequirement.proyectoId)?.nombre || '—'}
                    </span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    Creado: {formatDate(selectedRequirement.createdAt)}
                  </span>
                </div>
              </div>

              {/* Controles de estado */}
              {userRole !== 'lector' && (
                <div className="req-detail-actions">
                  <label style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cambiar Estado</label>
                  <div className="req-status-buttons">
                    {['Abierto', 'En Progreso', 'Cerrado'].map(st => (
                      <button
                        key={st}
                        className={`req-status-btn ${selectedRequirement.status === st ? 'active' : ''}`}
                        onClick={() => actualizarEstadoReq(selectedRequirement.id, st)}
                        style={{
                          borderColor: selectedRequirement.status === st ? getStatusColor(st) : 'var(--border-subtle)',
                          color: selectedRequirement.status === st ? getStatusColor(st) : 'var(--text-secondary)',
                          background: selectedRequirement.status === st ? `${getStatusColor(st)}15` : 'var(--bg-input)'
                        }}
                      >
                        <Circle size={8} fill={selectedRequirement.status === st ? getStatusColor(st) : 'transparent'} stroke={getStatusColor(st)} />
                        {st}
                      </button>
                    ))}
                  </div>
                  {userRole === 'admin' && (
                    <>
                      <div style={{ marginTop: 16 }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Cambiar Prioridad</label>
                        <div className="req-status-buttons" style={{ marginTop: 6 }}>
                          {['Alta', 'Media', 'Baja'].map(pr => (
                            <button
                              key={pr}
                              className={`req-status-btn ${selectedRequirement.priority === pr ? 'active' : ''}`}
                              onClick={() => actualizarPrioridadReq(selectedRequirement.id, pr)}
                              style={{
                                borderColor: selectedRequirement.priority === pr ? getPriorityColor(pr) : 'var(--border-subtle)',
                                color: selectedRequirement.priority === pr ? getPriorityColor(pr) : 'var(--text-secondary)',
                                background: selectedRequirement.priority === pr ? `${getPriorityColor(pr)}15` : 'var(--bg-input)',
                                padding: '6px 12px',
                                fontSize: '12px'
                              }}
                            >
                              {pr}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="btn-icon danger"
                        onClick={() => eliminarRequerimiento(selectedRequirement.id)}
                        title="Eliminar requerimiento"
                        style={{ width: 36, height: 36, marginTop: 16 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Equipo asignado */}
            <div className="section-divider" style={{ marginTop: '32px' }}>
              <h3><User size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Equipo Asignado</h3>
            </div>
            <div style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
              <h5 style={{ fontSize: 13, marginBottom: 5 }}>Colaboradores:</h5>
              {(!selectedRequirement.colaboradores || selectedRequirement.colaboradores.length === 0) ? (
                <p className="empty-collaborators" style={{ marginTop: 0 }}>Sin colaboradores asignados</p>
              ) : (
                <div className="collaborator-chips">
                  {selectedRequirement.colaboradores.map(uid => (
                    <span key={uid} className="collaborator-chip">
                      <User size={12} />
                      {getNombreUsuario(uid)}
                    </span>
                  ))}
                </div>
              )}

              <h5 style={{ fontSize: 13, marginTop: 15, marginBottom: 5 }}>Lectores:</h5>
              {(!selectedRequirement.lectores || selectedRequirement.lectores.length === 0) ? (
                <p className="empty-collaborators" style={{ marginTop: 0 }}>Sin lectores asignados</p>
              ) : (
                <div className="collaborator-chips">
                  {selectedRequirement.lectores.map(l => (
                    <div key={l.uid} className="collaborator-chip" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: l.activo ? 1 : 0.5 }}>
                      <User size={12} />
                      {getNombreUsuario(l.uid)}
                      {/* Aquí se podría agregar el toggle individual para el requerimiento si se desea */}
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{l.activo ? 'Activo' : 'Desactivado'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sección de Comentarios */}
            <div className="section-divider" style={{ marginTop: '32px' }}>
              <h3><MessageSquare size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Comentarios ({selectedRequirement.comments.length})</h3>
            </div>

            {/* Input de comentario */}
            {true && (
              <div className="comment-input-area">
                <div className="comment-avatar">
                  <User size={16} />
                </div>
                <div className="comment-input-wrapper">
                  <textarea
                    placeholder="Escribe un comentario..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        agregarComentario(selectedRequirement.id);
                      }
                    }}
                    rows={2}
                  />
                  <button
                    className="comment-send-btn"
                    onClick={() => agregarComentario(selectedRequirement.id)}
                    disabled={!newCommentText.trim()}
                    title="Enviar comentario"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Lista de comentarios */}
            {selectedRequirement.comments.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 20px' }}>
                <MessageSquare size={40} />
                <p>No hay comentarios aún. ¡Sé el primero en comentar!</p>
              </div>
            ) : (
              <div className="comments-list">
                {[...selectedRequirement.comments].reverse().map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <div className="comment-avatar">
                      <User size={14} />
                    </div>
                    <div className="comment-body">
                      <div className="comment-header">
                        <span className="comment-author">{getNombreUsuario(comment.userId) || 'Usuario'}</span>
                        <span className="comment-time">{formatDate(comment.timestamp)}</span>
                      </div>
                      <p className="comment-text">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </main>
      </div>

      {/* MODAL: ASIGNAR USUARIOS AL ÁREA */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3><UserPlus size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} />Asignar Usuarios al Área</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 20 }}>
              {/* Columna Colaboradores */}
              <div>
                <h4 style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>Colaboradores</h4>
                <div className="user-checkbox-list" style={{ maxHeight: 300 }}>
                  {usersList
                    .filter(u => u.rol === 'colaborador' && u.activo !== false)
                    .map(u => (
                      <label key={u.id} className="user-checkbox-item" style={{ opacity: userRole === 'admin' ? 1 : 0.5 }}>
                        <input
                          type="checkbox"
                          checked={selectedCollaborators.includes(u.id)}
                          disabled={userRole !== 'admin'}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedCollaborators(prev => [...prev, u.id]);
                            else setSelectedCollaborators(prev => prev.filter(id => id !== u.id));
                          }}
                        />
                        <div className="user-info">
                          <div className="name">{u.nombre || 'Sin nombre'}</div>
                          <div className="email">{u.correo || u.email}</div>
                        </div>
                      </label>
                    ))}
                  {usersList.filter(u => u.rol === 'colaborador' && u.activo !== false).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay colaboradores disponibles.</p>
                  )}
                </div>
              </div>

              {/* Columna Lectores */}
              <div>
                <h4 style={{ marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>Lectores</h4>
                <div className="user-checkbox-list" style={{ maxHeight: 300 }}>
                  {usersList
                    .filter(u => u.rol === 'lector' && u.activo !== false)
                    .map(u => (
                      <label key={u.id} className="user-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedReaders.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedReaders(prev => [...prev, u.id]);
                            else setSelectedReaders(prev => prev.filter(id => id !== u.id));
                          }}
                        />
                        <div className="user-info">
                          <div className="name">{u.nombre || 'Sin nombre'}</div>
                          <div className="email">{u.correo || u.email}</div>
                        </div>
                      </label>
                    ))}
                  {usersList.filter(u => u.rol === 'lector' && u.activo !== false).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay lectores disponibles.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn-cancel" onClick={() => setShowAssignModal(false)}>Cancelar</button>
              <button className="btn-create" onClick={guardarAsignacion}>
                <Save size={14} /> Guardar Cambios
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

      {/* === MODAL PREVISUALIZACIÓN PDF === */}
      {previewFile && (
        <div className="pdf-preview-overlay" onClick={() => setPreviewFile(null)}>
          <div className="pdf-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pdf-preview-header">
              <div className="pdf-preview-title">
                <FileText size={18} color="#f87171" />
                <span>{previewFile}</span>
              </div>
              <div className="pdf-preview-actions">
                <button className="pdf-preview-btn-download" onClick={() => handleDownload(previewFile)}>
                  <Download size={16} /> Descargar
                </button>
                <button className="pdf-preview-btn-close" onClick={() => setPreviewFile(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="pdf-preview-body">
              <iframe
                src={`${API_BASE}/api/files/${encodeURIComponent(previewFile)}?preview=true`}
                title={`Previsualización: ${previewFile}`}
                className="pdf-preview-iframe"
              />
            </div>
          </div>
        </div>
      )}

      {/* === OVERLAY PROGRESO DE SUBIDA === */}
      {uploadProgress.uploading && (
        <div className="upload-progress-overlay">
          <div className="upload-progress-box">
            <Loader2 className="spin-icon" size={32} color="#4f8cff" />
            <h3>Subiendo archivos…</h3>
            <p>Subiendo {uploadProgress.current} de {uploadProgress.total}...</p>
            <div className="upload-progress-bar-track">
              <div
                className="upload-progress-bar-fill"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
            <span className="upload-progress-pct">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
          </div>
        </div>
      )}

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
                className="confirm-btn-cancel" 
                onClick={() => setConfirmState({ ...confirmState, isOpen: false })}
              >
                {confirmState.cancelText}
              </button>
              <button 
                className={`confirm-btn-action ${confirmState.isDestructive ? 'destructive' : ''}`}
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