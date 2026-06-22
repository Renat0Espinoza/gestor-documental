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

// 5. ELIMINAR ARCHIVO POR NOMBRE
app.delete('/api/files/:filename', (req, res) => {
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
});

// 5. ESTADO DEL DEPLOY (GitHub Actions)
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
// --- REQUERIMIENTOS (JSON file-based) ---
// ==========================================
const requirementsFile = path.join(__dirname, 'requirements.json');

function loadRequirements() {
    try {
        if (!fs.existsSync(requirementsFile)) fs.writeFileSync(requirementsFile, '[]', 'utf-8');
        return JSON.parse(fs.readFileSync(requirementsFile, 'utf-8'));
    } catch {
        return [];
    }
}

function saveRequirements(data) {
    fs.writeFileSync(requirementsFile, JSON.stringify(data, null, 2), 'utf-8');
}

// Listar todos los requerimientos
app.get('/api/requirements', (_req, res) => {
    try {
        res.json(loadRequirements());
    } catch (err) {
        console.error('Error al listar requerimientos:', err);
        res.status(500).json({ error: 'No se pudieron leer los requerimientos' });
    }
});

// Crear un requerimiento
app.post('/api/requirements', (req, res) => {
    try {
        const { title, description, priority, proyectoId, areaId, colaboradores, lectores, createdBy } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'El título es obligatorio' });
        }
        if (!areaId) {
            return res.status(400).json({ error: 'El área es obligatoria' });
        }
        const reqs = loadRequirements();
        const newReq = {
            id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9),
            title: title.trim(),
            description: (description || '').trim(),
            priority: priority || 'Media',
            proyectoId: proyectoId || '',
            areaId: areaId || '',
            colaboradores: colaboradores || [],
            lectores: lectores || [],
            createdBy: createdBy || '',
            status: 'Abierto',
            comments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        reqs.push(newReq);
        saveRequirements(reqs);
        console.log('✅ Requerimiento creado:', newReq.id);
        res.status(201).json(newReq);
    } catch (err) {
        console.error('Error al crear requerimiento:', err);
        res.status(500).json({ error: 'Error al crear el requerimiento' });
    }
});

// Actualizar estado de un requerimiento
app.patch('/api/requirements/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const validStatuses = ['Abierto', 'En Progreso', 'Cerrado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Estado inválido. Valores permitidos: ${validStatuses.join(', ')}` });
        }
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        reqs[idx].status = status;
        reqs[idx].updatedAt = new Date().toISOString();
        saveRequirements(reqs);
        console.log(`📝 Requerimiento ${id} → ${status}`);
        res.json(reqs[idx]);
    } catch (err) {
        console.error('Error al actualizar estado:', err);
        res.status(500).json({ error: 'Error al actualizar el estado' });
    }
});

// Actualizar prioridad de un requerimiento
app.patch('/api/requirements/:id/priority', (req, res) => {
    try {
        const { id } = req.params;
        const { priority } = req.body;
        const validPriorities = ['Alta', 'Media', 'Baja'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ error: `Prioridad inválida. Valores permitidos: ${validPriorities.join(', ')}` });
        }
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        reqs[idx].priority = priority;
        reqs[idx].updatedAt = new Date().toISOString();
        saveRequirements(reqs);
        console.log(`📝 Requerimiento ${id} prioridad → ${priority}`);
        res.json(reqs[idx]);
    } catch (err) {
        console.error('Error al actualizar prioridad:', err);
        res.status(500).json({ error: 'Error al actualizar la prioridad' });
    }
});

// Actualizar lectores de un requerimiento
app.patch('/api/requirements/:id/lectores', (req, res) => {
    try {
        const { id } = req.params;
        const { lectores } = req.body;
        if (!Array.isArray(lectores)) {
            return res.status(400).json({ error: 'Lectores debe ser un arreglo' });
        }
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        reqs[idx].lectores = lectores;
        reqs[idx].updatedAt = new Date().toISOString();
        saveRequirements(reqs);
        console.log(`👥 Requerimiento ${id} lectores actualizados`);
        res.json(reqs[idx]);
    } catch (err) {
        console.error('Error al actualizar lectores:', err);
        res.status(500).json({ error: 'Error al actualizar lectores' });
    }
});

// Eliminar un requerimiento
app.delete('/api/requirements/:id', (req, res) => {
    try {
        const { id } = req.params;
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        reqs.splice(idx, 1);
        saveRequirements(reqs);
        console.log(`🗑️ Requerimiento eliminado: ${id}`);
        res.json({ success: true, message: 'Requerimiento eliminado' });
    } catch (err) {
        console.error('Error al eliminar requerimiento:', err);
        res.status(500).json({ error: 'Error al eliminar el requerimiento' });
    }
});

// Agregar comentario a un requerimiento
app.post('/api/requirements/:id/comments', (req, res) => {
    try {
        const { id } = req.params;
        const { text, userId, timestamp } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'El texto del comentario es obligatorio' });
        }
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        const comment = {
            id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
            text: text.trim(),
            userId: userId || '',
            timestamp: timestamp || new Date().toISOString()
        };
        reqs[idx].comments.push(comment);
        reqs[idx].updatedAt = new Date().toISOString();
        saveRequirements(reqs);
        console.log(`💬 Comentario añadido a requerimiento ${id}`);
        res.status(201).json(comment);
    } catch (err) {
        console.error('Error al agregar comentario:', err);
        res.status(500).json({ error: 'Error al agregar el comentario' });
    }
});

// Eliminar un requerimiento
app.delete('/api/requirements/:id', (req, res) => {
    try {
        const { id } = req.params;
        const reqs = loadRequirements();
        const idx = reqs.findIndex(r => r.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Requerimiento no encontrado' });
        }
        reqs.splice(idx, 1);
        saveRequirements(reqs);
        console.log(`🗑️ Requerimiento eliminado: ${id}`);
        res.json({ success: true, message: 'Requerimiento eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar requerimiento:', err);
        res.status(500).json({ error: 'Error al eliminar el requerimiento' });
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