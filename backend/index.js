import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import fileRoutes from './routes/fileRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import requirementsRoutes from './routes/requirementsRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// --- RUTAS DE LA API (Con prefijo /api) ---
// ==========================================
app.use('/api', fileRoutes);
app.use('/api', githubRoutes);
app.use('/api/requirements', requirementsRoutes);

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