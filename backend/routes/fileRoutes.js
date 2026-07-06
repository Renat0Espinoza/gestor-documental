import { Router } from 'express';
import { listFiles, uploadFile, searchFiles, downloadFile, deleteFile } from '../controllers/fileController.js';

const router = Router();

// 1. LISTAR ARCHIVOS (con metadata)
router.get('/files', listFiles);

// 2. SUBIR ARCHIVO (Conectado con React)
router.post('/upload', uploadFile);

// 3. BUSCAR ARCHIVOS POR NOMBRE
router.get('/search', searchFiles);

// 4. DESCARGAR ARCHIVO POR NOMBRE
router.get('/files/:filename', downloadFile);

// 5. ELIMINAR ARCHIVO POR NOMBRE
router.delete('/files/:filename', deleteFile);

export default router;
