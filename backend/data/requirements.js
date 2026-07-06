import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// --- REQUERIMIENTOS (JSON file-based) ---
// ==========================================
const requirementsFile = path.join(__dirname, '..', 'requirements.json');

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

export { loadRequirements, saveRequirements };
