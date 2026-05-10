import express from 'express';
import 'dotenv/config';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import fetch from 'node-fetch'; // O 'isomorphic-fetch' si lo prefieres
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE MULTER (LA BODEGA LOCAL) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        // Si la carpeta uploads no existe, Node.js la crea automáticamente
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Le pegamos la fecha exacta al nombre para que no choquen dos PDFs iguales
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ==========================================
// --- RUTAS DE LA API (Con prefijo /api) ---
// ==========================================

// 1. LISTAR ARCHIVOS
app.get('/api/files', (req, res) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) return res.json([]);

    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json({ error: "No se pudieron leer los archivos" });
        const filteredFiles = files.filter(file => file !== '.gitkeep');
        res.json(filteredFiles);
    });
});

// 2. SUBIR ARCHIVO (Conectado con React)
app.post('/api/upload', upload.single('documento'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

        console.log("✅ ¡Éxito! Archivo guardado en disco:", req.file.filename);

        res.json({
            success: true,
            message: "Archivo guardado localmente",
            file: req.file.filename
        });
    } catch (error) {
        console.error("Error al guardar archivo:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. BUILD DE JENKINS (Se mantiene temporalmente)
app.post('/api/jenkins-build', async (req, res) => {
    try {
        const auth = Buffer.from(`${process.env.JENKINS_USER}:${process.env.JENKINS_TOKEN}`).toString('base64');
        const response = await fetch(`${process.env.JENKINS_URL}/job/Proyecto-Gestor/build`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (response.status === 201) {
            res.json({ success: true, message: "¡Despliegue iniciado en Jenkins!" });
        } else {
            res.status(500).json({ success: false, message: "No se pudo iniciar el proceso" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. ESTADO DE JENKINS (Se mantiene temporalmente)
app.get('/api/jenkins-status', async (req, res) => {
    try {
        const { JENKINS_URL, JENKINS_USER, JENKINS_TOKEN } = process.env;
        if (!JENKINS_USER || !JENKINS_TOKEN) {
            return res.json({ connected: false, message: "Faltan credenciales" });
        }
        const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');
        const response = await fetch(`${JENKINS_URL}/api/json`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (response.ok) {
            res.json({ connected: true, message: "Conexión exitosa", version: response.headers.get('x-jenkins') });
        } else {
            res.json({ connected: false, message: `Error ${response.status}` });
        }
    } catch (error) {
        res.status(500).json({ connected: false, message: "No se pudo conectar" });
    }
});

// ==========================================
// --- SERVIDOR DE REACT ---
// ==========================================
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor Backend listo y escuchando en el puerto ${PORT}`);
});