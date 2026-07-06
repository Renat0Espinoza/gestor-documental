import fs from 'fs';
import path from 'path';
import { uploadsDir, upload } from '../config/multer.js';
import { listAllFiles } from '../utils/fileHelpers.js';

// 1. LISTAR ARCHIVOS (con metadata)
const listFiles = (_req, res) => {
    try {
        const files = listAllFiles();
        res.json(files);
    } catch (err) {
        console.error('Error al listar archivos:', err);
        res.status(500).json({ error: 'No se pudieron leer los archivos' });
    }
};

// 2. SUBIR ARCHIVO (Conectado con React)
const uploadFile = (req, res) => {
    upload.single('documento')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    error: 'El archivo es demasiado pesado. El límite máximo es de 10 MB.'
                });
            }
            console.error('Error de multer:', err);
            return res.status(500).json({ success: false, error: err.message });
        }

        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

        console.log('✅ ¡Éxito! Archivo guardado en disco:', req.file.filename);

        res.json({
            success: true,
            message: 'Archivo guardado localmente',
            file: req.file.filename
        });
    });
};

// 3. BUSCAR ARCHIVOS POR NOMBRE
const searchFiles = (req, res) => {
    try {
        const query = (req.query.q || '').toString().toLowerCase().trim();
        if (!query) return res.json([]);

        const allFiles = listAllFiles();
        const results = allFiles.filter(f =>
            f.name.toLowerCase().includes(query)
        );

        res.json(results);
    } catch (err) {
        console.error('Error en búsqueda:', err);
        res.status(500).json({ error: 'Error al buscar archivos' });
    }
};

// 4. DESCARGAR ARCHIVO POR NOMBRE
const downloadFile = (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    // Prevenir ataques de path traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.download(filePath);
};

// 5. ELIMINAR ARCHIVO POR NOMBRE
const deleteFile = (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    // Prevenir ataques de path traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    try {
        fs.unlinkSync(filePath);
        console.log('🗑️ Archivo eliminado:', req.params.filename);
        res.json({ success: true, message: 'Archivo eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar archivo:', err);
        res.status(500).json({ error: 'No se pudo eliminar el archivo' });
    }
};

export { listFiles, uploadFile, searchFiles, downloadFile, deleteFile };
