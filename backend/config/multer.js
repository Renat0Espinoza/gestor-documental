import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- CONFIGURACIÓN DE MULTER (LA BODEGA LOCAL) ---
const uploadsDir = path.join(__dirname, '..', 'uploads');
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

export { uploadsDir, upload };
