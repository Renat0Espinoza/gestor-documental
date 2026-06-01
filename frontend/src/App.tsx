import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Server, CheckCircle, XCircle, RefreshCcw,
  UploadCloud, FolderOpen, Search, Settings, LogOut,
  ArrowLeft, FileText, Download, Inbox, Trash2, User, Save, Mail, Lock,
  Filter, Users, History, Shield, Eye, RotateCcw, Tag, Plus, X,
  Clock, ArrowUpDown, Calendar
} from 'lucide-react';
import Login from './Login';
import { auth, db } from './firebase'; // <-- Modificado para incluir db
import { updateProfile, updateEmail, updatePassword, onAuthStateChanged, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc, addDoc } from 'firebase/firestore'; // <-- Funciones de Firestore

interface FileInfo {
  name: string;
  size: number;
  modified: string | null;
}

interface Category {
  id: string;
  nombre: string;
  color: string;
}

interface DocMeta {
  id: string;
  filename: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
}

interface HistoryLog {
  id: string;
  usuario: string;
  accion: string;
  documento: string;
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

// <-- Modificado: Añadidas las vistas del admin
type Vista = 'dashboard' | 'explorador' | 'busqueda' | 'configuracion' | 'usuarios' | 'historial' | 'papelera' | 'categorias';

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
  const [filterDate, setFilterDate] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);

  const showToast = (message: string, type: 'success'|'error'|'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDangerous?: boolean;
  } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void, isDangerous = false, confirmText = 'Confirmar', cancelText = 'Cancelar') => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, isDangerous, confirmText, cancelText });
  };

  const closeConfirm = () => setConfirmDialog(null);

  // --- Estado de perfil ---
  const [displayName, setDisplayName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [userCreationDate, setUserCreationDate] = useState('');

  // --- Estado de papelera ---
  const [trashFiles, setTrashFiles] = useState<FileInfo[]>([]);

  // --- Estado de categorías ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#4f8cff');
  const [documentsMeta, setDocumentsMeta] = useState<DocMeta[]>([]);
  const [filterCategory, setFilterCategory] = useState('all');

  // --- Estado de historial de búsqueda ---
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // --- Estado del modal de subida ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true);
        if (!displayName && user.displayName) setDisplayName(user.displayName);
        // Cargar rol y sync desde Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().rol || 'lector');
          if (userDoc.data().nombre && !displayName) {
            setDisplayName(userDoc.data().nombre);
          }
        }
        setUserCreationDate(user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('es-CL') : 'Desconocida');
        cargarHistorialBusqueda();
        cargarDocumentosMeta();
        cargarCategorias();
        cargarAuditoria();
      } else {
        setIsAuthenticated(false);
        setDisplayName('');
        setUserRole('lector');
      }
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) checkGithub();
  }, [isAuthenticated]);

  const API_BASE = '';

  const CATEGORY_COLORS = [
    '#4f8cff', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
    '#f472b6', '#38bdf8', '#fb923c', '#818cf8', '#2dd4bf'
  ];

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

  // --- CARGAR CATEGORÍAS ---
  const cargarCategorias = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'categories'));
      const cats: Category[] = [];
      querySnapshot.forEach((docSnap) => {
        cats.push({ id: docSnap.id, ...docSnap.data() } as Category);
      });
      setCategories(cats);
    } catch (err) {
      console.error('Error al cargar categorías:', err);
    }
  };

  // --- CARGAR METADATA DE DOCUMENTOS ---
  const cargarDocumentosMeta = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'documents'));
      const docs: DocMeta[] = [];
      querySnapshot.forEach((docSnap) => {
        docs.push({ id: docSnap.id, ...docSnap.data() } as DocMeta);
      });
      setDocumentsMeta(docs);
    } catch (err) {
      console.error('Error al cargar metadata:', err);
    }
  };

  // --- HISTORIAL DE BÚSQUEDA PERSISTENTE ---
  const cargarHistorialBusqueda = async () => {
    if (!auth.currentUser) return;
    try {
      const histRef = collection(db, 'users', auth.currentUser.uid, 'searchHistory');
      const querySnapshot = await getDocs(histRef);
      const items: SearchHistoryItem[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SearchHistoryItem);
      });
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSearchHistory(items);
    } catch (err) {
      console.error('Error al cargar historial:', err);
    }
  };

  const guardarBusqueda = async (searchQuery: string) => {
    if (!auth.currentUser || !searchQuery.trim()) return;
    try {
      const histRef = collection(db, 'users', auth.currentUser.uid, 'searchHistory');
      // Evitar duplicados - buscar si ya existe
      const existing = searchHistory.find(h => h.query === searchQuery.trim());
      if (existing) {
        // Actualizar timestamp
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'searchHistory', existing.id), {
          timestamp: new Date().toISOString()
        });
      } else {
        await addDoc(histRef, {
          query: searchQuery.trim(),
          timestamp: new Date().toISOString()
        });
      }
      await cargarHistorialBusqueda();
    } catch (err) {
      console.error('Error al guardar búsqueda:', err);
    }
  };

  const limpiarHistorialBusqueda = async () => {
    if (!auth.currentUser) return;
    try {
      const histRef = collection(db, 'users', auth.currentUser.uid, 'searchHistory');
      const querySnapshot = await getDocs(histRef);
      const deletePromises: Promise<void>[] = [];
      querySnapshot.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, 'users', auth.currentUser!.uid, 'searchHistory', docSnap.id)));
      });
      await Promise.all(deletePromises);
      setSearchHistory([]);
    } catch (err) {
      console.error('Error al limpiar historial:', err);
    }
  };

  // --- REGISTRO DE AUDITORÍA (HU4) ---
  const cargarAuditoria = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'audit_logs'));
      const logs: HistoryLog[] = [];
      const now = new Date().getTime();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const deletePromises: Promise<void>[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const logTime = new Date(data.fecha).getTime();
        // Borrar si tiene más de 30 días
        if (now - logTime > thirtyDays) {
          deletePromises.push(deleteDoc(doc(db, 'audit_logs', docSnap.id)));
        } else {
          logs.push({ id: docSnap.id, ...data } as HistoryLog);
        }
      });
      await Promise.all(deletePromises);
      logs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setHistoryLogs(logs);
    } catch (err) {
      console.error('Error al cargar auditoría:', err);
    }
  };

  const limpiarAuditoria = async () => {
    if (!auth.currentUser) return;
    
    showConfirm('Limpiar Historial', '¿Estás seguro de que deseas eliminar todo el historial de cambios permanentemente?', async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'audit_logs'));
        const deletePromises: Promise<void>[] = [];
        querySnapshot.forEach((docSnap) => {
          deletePromises.push(deleteDoc(doc(db, 'audit_logs', docSnap.id)));
        });
        await Promise.all(deletePromises);
        setHistoryLogs([]);
        showToast('Historial de cambios limpiado exitosamente.', 'success');
      } catch (err) {
        console.error('Error al limpiar auditoría:', err);
        showToast('Error al limpiar el historial de cambios.', 'error');
      }
    }, true, 'Limpiar Historial');
  };

  const registrarAuditoria = async (accion: string, documento: string) => {
    const usuario = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuario';
    const fecha = new Date().toISOString();
    try {
      await addDoc(collection(db, 'audit_logs'), { usuario, accion, documento, fecha });
      if (vistaActual === 'historial') {
        cargarAuditoria();
      }
    } catch (err) {
      console.error('Error al registrar auditoría:', err);
    }
  };

  // --- SUBIDA DE ARCHIVOS ---
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showToast('⚠️ Por favor, selecciona únicamente archivos PDF.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showToast('⚠️ El archivo es demasiado pesado. El límite es de 10 MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadFile(file);
    // Nombre por defecto: nombre del archivo sin extensión ni timestamp
    const baseName = file.name.replace(/\.pdf$/i, '');
    setUploadFileName(baseName);
  };

  const abrirModalSubida = () => {
    setUploadFile(null);
    setUploadFileName('');
    setUploadCategory('');
    setUploading(false);
    setShowUploadModal(true);
  };

  const cerrarModalSubida = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadFileName('');
    setUploadCategory('');
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmUpload = async () => {
    if (!uploadFile || !uploadFileName.trim()) return;
    setUploading(true);

    const formData = new FormData();
    // Crear un nuevo File con el nombre personalizado
    const customFile = new File([uploadFile], `${uploadFileName.trim()}.pdf`, { type: uploadFile.type });
    formData.append('documento', customFile);

    try {
      const response = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploadedFilename = response.data.file || customFile.name;
      registrarAuditoria('Subió el archivo', uploadedFilename);

      // Guardar metadata del documento con categoría
      if (uploadCategory && auth.currentUser) {
        try {
          await addDoc(collection(db, 'documents'), {
            filename: uploadedFilename,
            category: uploadCategory,
            uploadedBy: auth.currentUser.uid,
            uploadedAt: new Date().toISOString()
          });
          await cargarDocumentosMeta();
        } catch (err) {
          console.error('Error al guardar metadata:', err);
        }
      }

      showToast(`¡Subida exitosa! Archivo: ${uploadedFilename}`, 'success');
      cerrarModalSubida();
      if (vistaActual === 'explorador') abrirExplorador();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 413) {
        showToast('El archivo es demasiado pesado. Límite: 10 MB.', 'error');
      } else {
        showToast('Hubo un error al intentar subir el archivo al servidor.', 'error');
      }
      setUploading(false);
    }
  };

  // --- EXPLORADOR ---
  const abrirExplorador = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/files`);
      setListaArchivos(response.data);
      setVistaActual('explorador');
    } catch {
      showToast('Error al conectar con el servidor para ver los archivos.', 'error');
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
        // Guardar búsqueda en historial persistente
        await guardarBusqueda(query);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // --- LÓGICA FILTROS AVANZADOS ---
  const applyFiltersAndSort = (files: FileInfo[]) => {
    let filtered = files.filter(f => {
      // Filtro por extensión
      let matchExt = true;
      if (filterExtension !== 'all') matchExt = f.name.toLowerCase().endsWith(`.${filterExtension}`);

      // Filtro por tamaño
      let matchSize = true;
      if (filterSize !== 'all') {
        if (filterSize === 'small') matchSize = f.size < 1024 * 1024;
        else if (filterSize === 'medium') matchSize = f.size >= 1024 * 1024 && f.size <= 5 * 1024 * 1024;
        else if (filterSize === 'large') matchSize = f.size > 5 * 1024 * 1024;
      }

      // Filtro por fecha
      let matchDate = true;
      if (filterDate !== 'all' && f.modified) {
        const fileDate = new Date(f.modified);
        const now = new Date();
        if (filterDate === 'today') {
          matchDate = fileDate.toDateString() === now.toDateString();
        } else if (filterDate === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchDate = fileDate >= weekAgo;
        } else if (filterDate === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchDate = fileDate >= monthAgo;
        }
      }

      // Filtro por categoría
      let matchCat = true;
      if (filterCategory !== 'all') {
        const docMeta = documentsMeta.find(d => d.filename === f.name);
        matchCat = docMeta ? docMeta.category === filterCategory : false;
      }

      return matchExt && matchSize && matchDate && matchCat;
    });

    // Ordenar
    filtered.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'size-asc') return a.size - b.size;
      if (sortBy === 'size-desc') return b.size - a.size;
      if (sortBy === 'date-asc') return new Date(a.modified || 0).getTime() - new Date(b.modified || 0).getTime();
      if (sortBy === 'date-desc') return new Date(b.modified || 0).getTime() - new Date(a.modified || 0).getTime();
      return 0;
    });

    return filtered;
  };

  const filteredSearchResults = applyFiltersAndSort(searchResults);

  const handleDownload = (filename: string) => {
    registrarAuditoria('Descargó el archivo', filename); // <-- Registro de descarga
    window.open(`${API_BASE}/api/files/${encodeURIComponent(filename)}`, '_blank');
  };

  // --- CONFIGURACIÓN ---
  const abrirConfiguracion = () => {
    setNewDisplayName(displayName);
    setNewEmail(auth.currentUser?.email || '');
    setNewPassword('');
    setCurrentPassword('');
    setSettingsSuccess('');
    setSettingsError('');
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

      if (newDisplayName.trim() !== displayName) {
        await updateProfile(auth.currentUser, { displayName: newDisplayName.trim() });
        // Sincronizar nombre en Firestore
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { nombre: newDisplayName.trim() });
        setDisplayName(newDisplayName.trim());
      }

      if (newEmail !== auth.currentUser.email) {
        await updateEmail(auth.currentUser, newEmail);
        // Sincronizar correo en Firestore
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { correo: newEmail });
      }

      if (newPassword.length > 0) {
        await updatePassword(auth.currentUser, newPassword);
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

  // --- MOVER ARCHIVO A PAPELERA ---
  const handleDelete = async (filename: string) => {
    if (userRole === 'lector') return;

    showConfirm('Mover a Papelera', `¿Estás seguro de que deseas enviar "${filename}" a la papelera?`, async () => {
      try {
        await axios.post(`${API_BASE}/api/files/${encodeURIComponent(filename)}/trash`);
        showToast('Archivo movido a la papelera.', 'info');
        registrarAuditoria('Movió a papelera', filename);
        const response = await axios.get(`${API_BASE}/api/files`);
        setListaArchivos(response.data);
      } catch {
        showToast('Error al intentar mover el archivo a la papelera.', 'error');
      }
    }, true, 'Mover a Papelera');
  };

  // --- PAPELERA ---
  const abrirPapelera = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/trash`);
      setTrashFiles(response.data);
      setVistaActual('papelera');
    } catch {
      showToast('Error al cargar la papelera.', 'error');
    }
  };

  const restaurarArchivo = async (filename: string) => {
    try {
      await axios.post(`${API_BASE}/api/trash/${encodeURIComponent(filename)}/restore`);
      showToast('Archivo restaurado correctamente.', 'success');
      registrarAuditoria('Restauró archivo', filename);
      abrirPapelera(); // recargar
    } catch {
      showToast('Error al intentar restaurar el archivo.', 'error');
    }
  };

  const eliminarDefinitivo = async (filename: string) => {
    showConfirm('Eliminar Definitivamente', `⚠️ Esta acción es irreversible.\n¿Eliminar definitivamente "${filename}"?`, async () => {
      try {
        await axios.delete(`${API_BASE}/api/trash/${encodeURIComponent(filename)}`);
        showToast('Archivo eliminado permanentemente.', 'info');
        registrarAuditoria('Eliminó definitivamente', filename);
        abrirPapelera(); // recargar
      } catch {
        showToast('Error al eliminar permanentemente.', 'error');
      }
    }, true, 'Eliminar Permanentemente');
  };

  const vaciarPapelera = async () => {
    if (trashFiles.length === 0) return;
    showConfirm('Vaciar Papelera', `⚠️ Vas a eliminar ${trashFiles.length} archivos permanentemente.\n¿Estás seguro?`, async () => {
      try {
        await axios.delete(`${API_BASE}/api/trash`);
        showToast('La papelera ha sido vaciada.', 'info');
        registrarAuditoria('Vació la papelera', 'Todos los archivos');
        setTrashFiles([]);
      } catch {
        showToast('Error al intentar vaciar la papelera.', 'error');
      }
    }, true, 'Vaciar Papelera');
  };

  // --- CATEGORÍAS ---
  const crearCategoria = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await addDoc(collection(db, 'categories'), {
        nombre: newCategoryName.trim(),
        color: newCategoryColor
      });
      setNewCategoryName('');
      setNewCategoryColor('#4f8cff');
      await cargarCategorias();
      registrarAuditoria('Creó categoría', newCategoryName.trim());
    } catch (err) {
      showToast('Error al crear la categoría.', 'error');
      console.error(err);
    }
  };

  const eliminarCategoria = async (id: string, nombre: string) => {
    showConfirm('Eliminar Categoría', `¿Estás seguro de eliminar la categoría "${nombre}"?`, async () => {
      try {
        await deleteDoc(doc(db, 'categories', id));
        await cargarCategorias();
        registrarAuditoria('Eliminó categoría', nombre);
        showToast('Categoría eliminada.', 'success');
      } catch (err) {
        showToast('Error al eliminar la categoría.', 'error');
        console.error(err);
      }
    }, true, 'Eliminar Categoría');
  };

  const asignarCategoria = async (filename: string, categoryId: string) => {
    try {
      const existing = documentsMeta.find(d => d.filename === filename);
      if (existing) {
        await updateDoc(doc(db, 'documents', existing.id), { category: categoryId });
      } else {
        await addDoc(collection(db, 'documents'), {
          filename,
          category: categoryId,
          uploadedBy: auth.currentUser?.uid || '',
          uploadedAt: new Date().toISOString()
        });
      }
      await cargarDocumentosMeta();
    } catch (err) {
      console.error('Error al asignar categoría:', err);
    }
  };

  const getCategoryForFile = (filename: string): Category | undefined => {
    const docMeta = documentsMeta.find(d => d.filename === filename);
    if (!docMeta) return undefined;
    return categories.find(c => c.id === docMeta.category);
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
    // Bug 3: No permitir modificar el propio rol
    if (id === auth.currentUser?.uid) {
      showToast('No puedes modificar tu propio rol.', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', id), { rol: nuevoRol });
      cargarUsuarios();
      const usuario = usersList.find(u => u.id === id);
      registrarAuditoria(`Cambió rol a ${nuevoRol.toUpperCase()}`, `Usuario: ${usuario?.nombre || usuario?.correo || id}`);
      showToast('Rol actualizado correctamente.', 'success');
    } catch (err) {
      showToast('Error al cambiar el rol.', 'error');
    }
  };

  // --- COMPONENTE DE LISTA DE ARCHIVOS REUTILIZABLE ---
  const renderFileList = (files: FileInfo[], showCategorySelector?: boolean) => (
    <div className="file-list">
      {files.map((archivo, index) => {
        const fileCat = getCategoryForFile(archivo.name);
        return (
          <div key={index} className="file-item" style={{ animationDelay: `${index * 0.05}s` }}>
            <div className="file-icon">
              <FileText size={20} color="#f87171" />
            </div>
            <div className="file-info">
              <div className="file-name">
                {archivo.name}
                {fileCat && (
                  <span style={{
                    marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                    backgroundColor: `${fileCat.color}20`, color: fileCat.color,
                    border: `1px solid ${fileCat.color}40`
                  }}>
                    {fileCat.nombre}
                  </span>
                )}
              </div>
              <div className="file-meta">
                {formatFileSize(archivo.size)}
                {archivo.modified ? ` · ${formatDate(archivo.modified)}` : ''}
              </div>
            </div>
            <div className="file-actions">
              {/* Selector de categoría para admin y colaborador */}
              {showCategorySelector && userRole !== 'lector' && categories.length > 0 && (
                <select
                  value={getCategoryForFile(archivo.name)?.id || ''}
                  onChange={(e) => asignarCategoria(archivo.name, e.target.value)}
                  style={{
                    background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)',
                    padding: '4px 8px', borderRadius: '4px', outline: 'none', fontSize: '11px', maxWidth: '120px'
                  }}
                  title="Asignar categoría"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              )}
              <button className="file-download" onClick={() => handleDownload(archivo.name)}>
                <Download size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Descargar
              </button>
              {/* HU3: Ocultar botón eliminar para Lectores */}
              {userRole !== 'lector' && (
                <button className="file-delete" onClick={() => handleDelete(archivo.name)} title="Mover a papelera">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // --- AUTH GATE ---
  if (!isAuthenticated) {
    return <Login onLoginSuccess={(name?: string) => {
      if (name) setDisplayName(name);
      setIsAuthenticated(true);
    }} />;
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
        <input type="file" accept="application/pdf" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

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
                <button className="action-card" onClick={abrirModalSubida}>
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

              {/* Papelera - para admin y colaborador */}
              {userRole !== 'lector' && (
                <button className="action-card" onClick={abrirPapelera}>
                  <div className="card-icon" style={{ background: 'rgba(248, 113, 113, 0.1)' }}>
                    <Trash2 size={26} color="#f87171" />
                  </div>
                  <h3>Papelera</h3>
                  <p>Archivos eliminados temporalmente</p>
                </button>
              )}

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

                  <button className="action-card" onClick={() => { cargarAuditoria(); setVistaActual('historial'); }}>
                    <div className="card-icon" style={{ background: 'rgba(79, 140, 255, 0.1)' }}>
                      <History size={26} color="#4f8cff" />
                    </div>
                    <h3>Auditoría</h3>
                    <p>Historial de cambios (últimos 30 días)</p>
                  </button>

                  <button className="action-card" onClick={() => { cargarCategorias(); setVistaActual('categorias'); }}>
                    <div className="card-icon" style={{ background: 'rgba(251, 191, 36, 0.1)' }}>
                      <Tag size={26} color="#fbbf24" />
                    </div>
                    <h3>Categorías</h3>
                    <p>Administrar categorías de documentos</p>
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

            {/* Filtro por categoría en explorador */}
            {categories.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <Tag size={14} />
                <span>Filtrar por categoría:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  style={{
                    background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)',
                    borderRadius: '4px', padding: '4px 8px', outline: 'none', fontSize: '13px'
                  }}
                >
                  <option value="all">Todas</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                  ))}
                </select>
              </div>
            )}

            {(() => {
              const filtered = filterCategory === 'all' ? listaArchivos : listaArchivos.filter(f => {
                const docMeta = documentsMeta.find(d => d.filename === f.name);
                return docMeta ? docMeta.category === filterCategory : false;
              });
              return filtered.length === 0 ? (
                <div className="empty-state">
                  <Inbox size={48} />
                  <p>No hay documentos en la bodega aún.</p>
                </div>
              ) : (
                renderFileList(filtered, true)
              );
            })()}
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
              <div style={{ display: 'flex', gap: '15px', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '20px', flexWrap: 'wrap' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <Calendar size={14} />
                  <span>Fecha:</span>
                  <select value={filterDate} onChange={(e) => setFilterDate(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="all">Todas</option>
                    <option value="today">Hoy</option>
                    <option value="week">Última semana</option>
                    <option value="month">Último mes</option>
                  </select>
                </div>
                {categories.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <Tag size={14} />
                    <span>Categoría:</span>
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                      <option value="all">Todas</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <ArrowUpDown size={14} />
                  <span>Ordenar:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', borderRadius: '4px', padding: '4px 8px', outline: 'none' }}>
                    <option value="name-asc">Nombre (A-Z)</option>
                    <option value="name-desc">Nombre (Z-A)</option>
                    <option value="size-asc">Tamaño (menor)</option>
                    <option value="size-desc">Tamaño (mayor)</option>
                    <option value="date-asc">Fecha (antigua)</option>
                    <option value="date-desc">Fecha (reciente)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Historial de búsqueda */}
            {!searchQuery.trim() && searchHistory.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    <Clock size={14} />
                    Búsquedas recientes
                  </div>
                  <button
                    onClick={limpiarHistorialBusqueda}
                    style={{
                      background: 'transparent', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--accent-red)',
                      padding: '4px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: '12px',
                      fontFamily: 'inherit', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Trash2 size={12} /> Limpiar
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {searchHistory.slice(0, 10).map(item => (
                    <button
                      key={item.id}
                      onClick={() => handleSearch(item.query)}
                      style={{
                        background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                        color: 'var(--text-primary)', padding: '6px 14px', borderRadius: 'var(--radius-full)',
                        cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                        transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                    >
                      <Search size={12} style={{ color: 'var(--text-muted)' }} />
                      {item.query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!searchQuery.trim() && !showAdvancedFilters && searchHistory.length === 0 ? (
              <div className="empty-state">
                <Search size={48} />
                <p>Escribe un término para buscar entre tus documentos.</p>
              </div>
            ) : filteredSearchResults.length === 0 && !searching && searchQuery.trim() ? (
              <div className="empty-state">
                <Inbox size={48} />
                <p>No se encontraron archivos con esos filtros y término.</p>
              </div>
            ) : searchQuery.trim() ? (
              renderFileList(filteredSearchResults, true)
            ) : null}
          </div>
        )}

        {/* === PAPELERA === */}
        {vistaActual === 'papelera' && userRole !== 'lector' && (
          <div className="panel">
            <div className="panel-header">
              <button className="btn-back" onClick={() => setVistaActual('dashboard')}>
                <ArrowLeft size={16} /> Volver
              </button>
              <h2>Papelera de Reciclaje</h2>
              <span className="badge">{trashFiles.length}</span>
              {trashFiles.length > 0 && (
                <button
                  onClick={vaciarPapelera}
                  style={{
                    marginLeft: 'auto', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)',
                    color: 'var(--accent-red)', padding: '8px 16px', borderRadius: 'var(--radius-full)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: 'inherit',
                    transition: 'all 0.15s ease', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Trash2 size={14} /> Vaciar Papelera
                </button>
              )}
            </div>

            {trashFiles.length === 0 ? (
              <div className="empty-state">
                <Trash2 size={48} />
                <p>La papelera está vacía.</p>
              </div>
            ) : (
              <div className="file-list">
                {trashFiles.map((archivo, index) => (
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
                      <button
                        className="file-download"
                        onClick={() => restaurarArchivo(archivo.name)}
                        style={{ background: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.15)', color: 'var(--accent-green)' }}
                      >
                        <RotateCcw size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Restaurar
                      </button>
                      <button className="file-delete" onClick={() => eliminarDefinitivo(archivo.name)} title="Eliminar permanentemente">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Rol Actual</th>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Cambiar a</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => {
                    const isCurrentUser = u.id === auth.currentUser?.uid;
                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {u.nombre || 'Sin nombre'}
                            {isCurrentUser && (
                              <span style={{
                                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                backgroundColor: 'rgba(79, 140, 255, 0.15)', color: '#4f8cff',
                                border: '1px solid rgba(79, 140, 255, 0.3)'
                              }}>Tú</span>
                            )}
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{u.correo || u.email}</div>
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
                          {isCurrentUser ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No disponible</span>
                          ) : (
                            <select
                              value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value)}
                              style={{ background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-card)', padding: '6px 10px', borderRadius: '4px', outline: 'none', fontSize: '13px' }}
                            >
                              <option value="admin">Administrador</option>
                              <option value="colaborador">Colaborador</option>
                              <option value="lector">Lector</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === HISTORIAL (Auditoría) === */}
        {vistaActual === 'historial' && (
          <div className="panel animate-fade">
            <div className="panel-header">
              <h2>Historial de Auditoría</h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-secondary" onClick={() => setVistaActual('dashboard')}>Volver al Dashboard</button>
                <button className="btn-save" onClick={limpiarAuditoria} style={{ background: 'var(--accent-red)', border: 'none' }}>
                  <Trash2 size={16} style={{ marginRight: 6 }} /> Limpiar Historial
                </button>
              </div>
            </div>
            <div className="file-list" style={{ padding: '0 24px 24px' }}>
              {historyLogs.length > 0 ? historyLogs.map((log, index) => (
                <div key={log.id} className="file-item animate-fade" style={{ animationDelay: `${index * 0.03}s` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    <div className="file-icon" style={{ background: 'rgba(79, 140, 255, 0.1)', color: '#4f8cff' }}>
                      <History size={20} />
                    </div>
                    <div className="file-info" style={{ flex: 1 }}>
                      <div className="file-name" style={{ fontSize: '15px' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{log.usuario}</strong>
                        <span style={{ color: 'var(--text-muted)', margin: '0 8px' }}>→</span>
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                          background: log.accion.includes('Eliminó') || log.accion.includes('papelera') ? 'rgba(248, 113, 113, 0.1)' : log.accion.includes('Subió') || log.accion.includes('Creó') || log.accion.includes('Restauró') ? 'rgba(52, 211, 153, 0.1)' : 'rgba(79, 140, 255, 0.1)',
                          color: log.accion.includes('Eliminó') || log.accion.includes('papelera') ? '#f87171' : log.accion.includes('Subió') || log.accion.includes('Creó') || log.accion.includes('Restauró') ? '#34d399' : '#4f8cff'
                        }}>
                          {log.accion}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '12px' }}>{log.documento}</span>
                      </div>
                      <div className="file-meta" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={12} /> {formatDate(log.fecha)}
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <History size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                  <p>No hay registros de auditoría recientes (últimos 30 días).</p>
                </div>
              )}
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
              <h2>Administrar Categorías</h2>
            </div>

            {/* Crear nueva categoría */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '24px', padding: '16px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nombre de la categoría..."
                style={{
                  flex: 1, background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-card)',
                  padding: '10px 14px', borderRadius: '8px', outline: 'none', fontSize: '14px', fontFamily: 'inherit'
                }}
                onKeyDown={(e) => e.key === 'Enter' && crearCategoria()}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {CATEGORY_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    style={{
                      width: '24px', height: '24px', borderRadius: '50%', border: newCategoryColor === color ? '2px solid white' : '2px solid transparent',
                      background: color, cursor: 'pointer', transition: 'all 0.15s ease', padding: 0
                    }}
                  />
                ))}
              </div>
              <button
                onClick={crearCategoria}
                style={{
                  background: 'var(--gradient-main)', backgroundSize: '200% auto', color: 'white',
                  border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
                  fontWeight: 600, fontSize: '13px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.25s ease'
                }}
              >
                <Plus size={16} /> Crear
              </button>
            </div>

            {/* Lista de categorías */}
            {categories.length === 0 ? (
              <div className="empty-state">
                <Tag size={48} />
                <p>No hay categorías creadas aún.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categories.map(cat => (
                  <div key={cat.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    borderRadius: '8px', transition: 'all 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{cat.nombre}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ({documentsMeta.filter(d => d.category === cat.id).length} documentos)
                      </span>
                    </div>
                    <button
                      onClick={() => eliminarCategoria(cat.id, cat.nombre)}
                      style={{
                        background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)',
                        color: 'var(--accent-red)', padding: '6px 10px', borderRadius: 'var(--radius-full)',
                        cursor: 'pointer', transition: 'all 0.15s ease', display: 'flex', alignItems: 'center'
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
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

              {/* Info de rol y fecha */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{
                  padding: '12px 16px', background: 'var(--bg-input)', borderRadius: '8px',
                  border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-secondary)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Rol</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {userRole === 'admin' ? <Shield size={14} color="#4f8cff" /> : userRole === 'colaborador' ? <User size={14} color="#34d399" /> : <Eye size={14} color="#8b92a8" />}
                    <span style={{ fontWeight: 600, color: userRole === 'admin' ? '#4f8cff' : userRole === 'colaborador' ? '#34d399' : '#8b92a8' }}>
                      {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                    </span>
                  </div>
                </div>
                {userCreationDate && (
                  <div style={{
                    padding: '12px 16px', background: 'var(--bg-input)', borderRadius: '8px',
                    border: '1px solid var(--border-subtle)', fontSize: '13px', color: 'var(--text-secondary)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Miembro desde</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      {formatDate(userCreationDate)}
                    </div>
                  </div>
                )}
              </div>

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

      {/* === MODAL DE SUBIDA === */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200
        }} onClick={cerrarModalSubida}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)',
            padding: '36px 32px', width: '100%', maxWidth: '480px', boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.3s ease'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>Subir Documento</h2>
              <button onClick={cerrarModalSubida} style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', display: 'flex', transition: 'all 0.15s ease'
              }}><X size={18} /></button>
            </div>

            {/* Selector de archivo */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                Archivo PDF
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${uploadFile ? 'rgba(52,211,153,0.4)' : 'var(--border-subtle)'}`,
                  borderRadius: 'var(--radius-sm)', padding: '24px', textAlign: 'center', cursor: 'pointer',
                  background: uploadFile ? 'rgba(52,211,153,0.05)' : 'var(--bg-input)',
                  transition: 'all 0.2s ease'
                }}
              >
                {uploadFile ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <FileText size={20} color="#34d399" />
                    <span style={{ color: 'var(--accent-green)', fontSize: '14px', fontWeight: 500 }}>{uploadFile.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>({formatFileSize(uploadFile.size)})</span>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={32} color="var(--text-muted)" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>Haz clic para seleccionar un archivo PDF</p>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>Máximo 10 MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* Nombre personalizado */}
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                Nombre del documento
              </label>
              <div className="input-wrapper">
                <FileText size={18} />
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="Nombre del archivo..."
                />
              </div>
            </div>

            {/* Categoría */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500 }}>
                Categoría <span style={{ color: 'var(--accent-amber)', fontWeight: 400 }}>(requerido)</span>
              </label>
              {categories.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setUploadCategory(cat.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer', fontSize: '13px',
                        fontFamily: 'inherit', transition: 'all 0.15s ease',
                        background: uploadCategory === cat.id ? `${cat.color}20` : 'var(--bg-input)',
                        border: `1px solid ${uploadCategory === cat.id ? `${cat.color}50` : 'var(--border-subtle)'}`,
                        color: uploadCategory === cat.id ? cat.color : 'var(--text-secondary)'
                      }}
                    >{cat.nombre}</button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px', background: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderRadius: 'var(--radius-sm)', fontSize: '13px', border: '1px solid rgba(251,191,36,0.2)' }}>
                  ⚠️ No hay categorías disponibles. El administrador debe crear al menos una categoría para poder subir archivos.
                </div>
              )}
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={cerrarModalSubida} style={{
                background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '14px',
                fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s ease'
              }}>Cancelar</button>
              <button
                onClick={handleConfirmUpload}
                disabled={!uploadFile || !uploadFileName.trim() || !uploadCategory || uploading}
                style={{
                  background: (!uploadFile || !uploadFileName.trim() || !uploadCategory || uploading) ? 'rgba(79,140,255,0.3)' : 'var(--gradient-main)',
                  backgroundSize: '200% auto', color: 'white', border: 'none',
                  padding: '12px 24px', borderRadius: 'var(--radius-sm)', cursor: (!uploadFile || !uploadFileName.trim() || !uploadCategory || uploading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.25s ease',
                  display: 'flex', alignItems: 'center', gap: '8px', opacity: (!uploadFile || !uploadFileName.trim() || !uploadCategory || uploading) ? 0.6 : 1
                }}
              >
                {uploading ? <RefreshCcw size={16} className="spin-icon" /> : <UploadCloud size={16} />}
                {uploading ? 'Subiendo...' : 'Subir Documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST COMPONENT */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
          background: toast.type === 'error' ? 'var(--accent-red)' : toast.type === 'info' ? '#4f8cff' : 'var(--accent-green)',
          color: 'white', padding: '12px 20px', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast.type === 'error' ? <XCircle size={18} /> : toast.type === 'info' ? <CheckCircle size={18} /> : <CheckCircle size={18} />}
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{toast.message}</span>
        </div>
      )}

      {/* CONFIRM DIALOG MODAL */}
      {confirmDialog?.isOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)',
            padding: '24px', width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)',
            animation: 'fadeIn 0.2s ease', display: 'flex', flexDirection: 'column', gap: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {confirmDialog.isDangerous ? <Trash2 color="var(--accent-red)" size={20} /> : <Filter color="var(--accent-blue)" size={20} />}
              {confirmDialog.title}
            </h3>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={closeConfirm} className="btn-secondary" style={{ padding: '10px 16px' }}>
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={() => { confirmDialog.onConfirm(); closeConfirm(); }}
                style={{
                  background: confirmDialog.isDangerous ? 'var(--accent-red)' : 'var(--gradient-main)',
                  backgroundSize: '200% auto',
                  color: 'white', border: 'none', padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s ease'
                }}
              >
                {confirmDialog.confirmText}
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
    </div>
  );
}

export default App;