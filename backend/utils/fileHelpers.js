import fs from 'fs';
import path from 'path';
import { uploadsDir } from '../config/multer.js';

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

export { getFileMetadata, listAllFiles };
