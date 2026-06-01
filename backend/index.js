import express from 'express';
import 'dotenv/config';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE MULTER (LA BODEGA LOCAL) ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// --- PAPELERA DE RECICLAJE ---
const trashDir = path.join(__dirname, 'trash');
if (!fs.existsSync(trashDir)) fs.mkdirSync(trashDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
        // Le pegamos la fecha exacta al nombre para que no choquen dos PDFs iguales
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE }
});

// ==========================================
// --- FUNCIONES AUXILIARES ---
// ==========================================
function getFileMetadata(filename) {
    try {
        const filePath = path.join(uploadsDir, filename);
        const stats = fs.statSync(filePath);
        return {
            name: filename,
            size: stats.size,
            modified: stats.mtime,
        };
    } catch {
        return { name: filename, size: 0, modified: null };
    }
}

function listAllFiles() {
    if (!fs.existsSync(uploadsDir)) return [];
    const files = fs.readdirSync(uploadsDir);
    return files
        .filter(f => f !== '.gitkeep')
        .map(getFileMetadata);
}

// ==========================================
// --- RUTAS DE LA API (Con prefijo /api) ---
// ==========================================

// 1. LISTAR ARCHIVOS (con metadata)
app.get('/api/files', (_req, res) => {
    try {
        const files = listAllFiles();
        res.json(files);
    } catch (err) {
        console.error('Error al listar archivos:', err);
        res.status(500).json({ error: 'No se pudieron leer los archivos' });
    }
});

// 2. SUBIR ARCHIVO (Conectado con React)
app.post('/api/upload', (req, res) => {
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
});

// 3. BUSCAR ARCHIVOS POR NOMBRE
app.get('/api/search', (req, res) => {
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
});

// 4. DESCARGAR ARCHIVO POR NOMBRE
app.get('/api/files/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    // Prevenir ataques de path traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.download(filePath);
});

// 5. MOVER ARCHIVO A PAPELERA (en vez de eliminar directamente)
app.post('/api/files/:filename/trash', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);

    // Prevenir ataques de path traversal
    if (!filePath.startsWith(uploadsDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    try {
        const trashPath = path.join(trashDir, req.params.filename);
        fs.copyFileSync(filePath, trashPath);
        fs.unlinkSync(filePath);
        console.log('🗑️ Archivo movido a papelera:', req.params.filename);
        res.json({ success: true, message: 'Archivo movido a la papelera' });
    } catch (err) {
        console.error('Error al mover a papelera:', err);
        res.status(500).json({ error: 'No se pudo mover el archivo a la papelera' });
    }
});

// 6. LISTAR ARCHIVOS EN PAPELERA
app.get('/api/trash', (_req, res) => {
    try {
        if (!fs.existsSync(trashDir)) return res.json([]);
        const files = fs.readdirSync(trashDir)
            .filter(f => f !== '.gitkeep')
            .map(filename => {
                try {
                    const stats = fs.statSync(path.join(trashDir, filename));
                    return { name: filename, size: stats.size, modified: stats.mtime };
                } catch {
                    return { name: filename, size: 0, modified: null };
                }
            });
        res.json(files);
    } catch (err) {
        console.error('Error al listar papelera:', err);
        res.status(500).json({ error: 'No se pudo leer la papelera' });
    }
});

// 7. RESTAURAR ARCHIVO DESDE PAPELERA
app.post('/api/trash/:filename/restore', (req, res) => {
    const trashPath = path.join(trashDir, req.params.filename);

    if (!trashPath.startsWith(trashDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(trashPath)) {
        return res.status(404).json({ error: 'Archivo no encontrado en papelera' });
    }

    try {
        const filePath = path.join(uploadsDir, req.params.filename);
        fs.copyFileSync(trashPath, filePath);
        fs.unlinkSync(trashPath);
        console.log('♻️ Archivo restaurado:', req.params.filename);
        res.json({ success: true, message: 'Archivo restaurado correctamente' });
    } catch (err) {
        console.error('Error al restaurar archivo:', err);
        res.status(500).json({ error: 'No se pudo restaurar el archivo' });
    }
});

// 8. ELIMINAR ARCHIVO PERMANENTEMENTE DE PAPELERA
app.delete('/api/trash/:filename', (req, res) => {
    const trashPath = path.join(trashDir, req.params.filename);

    if (!trashPath.startsWith(trashDir)) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    if (!fs.existsSync(trashPath)) {
        return res.status(404).json({ error: 'Archivo no encontrado en papelera' });
    }

    try {
        fs.unlinkSync(trashPath);
        console.log('💀 Archivo eliminado permanentemente:', req.params.filename);
        res.json({ success: true, message: 'Archivo eliminado permanentemente' });
    } catch (err) {
        console.error('Error al eliminar permanentemente:', err);
        res.status(500).json({ error: 'No se pudo eliminar el archivo' });
    }
});

// 9. VACIAR PAPELERA COMPLETA
app.delete('/api/trash', (_req, res) => {
    try {
        if (fs.existsSync(trashDir)) {
            const files = fs.readdirSync(trashDir).filter(f => f !== '.gitkeep');
            files.forEach(file => {
                fs.unlinkSync(path.join(trashDir, file));
            });
            console.log(`🗑️ Papelera vaciada: ${files.length} archivos eliminados`);
        }
        res.json({ success: true, message: 'Papelera vaciada correctamente' });
    } catch (err) {
        console.error('Error al vaciar papelera:', err);
        res.status(500).json({ error: 'No se pudo vaciar la papelera' });
    }
});

// 10. ESTADO DEL DEPLOY (GitHub Actions)
app.get('/api/github-status', async (_req, res) => {
    try {
        const owner = process.env.GITHUB_OWNER || 'Renat0Espinoza';
        const repo = process.env.GITHUB_REPO || 'gestor-documental';
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            return res.json({ connected: false, message: 'Token de GitHub no configurado' });
        }

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            }
        );

        const data = await response.json();
        const ultimoRun = data.workflow_runs?.[0];

        if (!ultimoRun) {
            return res.json({ connected: false, message: 'Sin ejecuciones aún' });
        }

        const exitoso = ultimoRun.conclusion === 'success';
        res.json({
            connected: exitoso,
            message: exitoso ? 'Último deploy exitoso' : `Estado: ${ultimoRun.conclusion || ultimoRun.status}`,
            run_url: ultimoRun.html_url,
            updated_at: ultimoRun.updated_at
        });

    } catch (err) {
        console.error('Error al contactar GitHub:', err.message);
        res.json({ connected: false, message: 'Error al contactar GitHub' });
    }
});

// ==========================================
// --- SERVIDOR DE REACT (Archivos estáticos) ---
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));
app.use((_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend listo y escuchando en el puerto ${PORT}`);
});