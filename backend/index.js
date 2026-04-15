import express from 'express';
import 'dotenv/config';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors()); 
app.use(express.json());

// --- CONFIGURACIÓN DE MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir); 
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- CONFIGURACIÓN DE AZURE (SHAREPOINT) ---
const msalConfig = {
    auth: {
        clientId: process.env.CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
        clientSecret: process.env.CLIENT_SECRET,
    }
};
const cca = new ConfidentialClientApplication(msalConfig);

async function getGraphClient() {
    const tokenRequest = { scopes: ['https://graph.microsoft.com/.default'] };
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    return Client.init({ authProvider: (done) => done(null, response.accessToken) });
}

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

// 2. SUBIR ARCHIVO
app.post('/api/upload', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
        res.json({
            success: true,
            message: "Archivo guardado localmente",
            file: req.file.filename
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. PRUEBA SHAREPOINT
app.get('/api/test-sharepoint', async (req, res) => {
    try {
        const client = await getGraphClient();
        const site = await client.api('/sites/root').get();
        res.json({ success: true, siteName: site.displayName });
    } catch (error) {
        res.status(500).json({ success: false, error: "Sin licencia SPO", detalle: error.message });
    }
});

// 4. BUILD DE JENKINS
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

// 5. ESTADO DE JENKINS
app.get('/api/jenkins-status', async (req, res) => {
    try {
        const { JENKINS_URL, JENKINS_USER, JENKINS_TOKEN } = process.env;

        if (!JENKINS_USER || !JENKINS_TOKEN) {
            return res.json({ connected: false, message: "Faltan credenciales en el .env" });
        }

        const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');

        const response = await fetch(`${JENKINS_URL}/api/json`, {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (response.ok) {
            res.json({ 
                connected: true, 
                message: "¡Conexión exitosa con Jenkins!",
                version: response.headers.get('x-jenkins') 
            });
        } else {
            res.json({ connected: false, message: `Jenkins respondió con error ${response.status}` });
        }
    } catch (error) {
        res.status(500).json({ connected: false, message: "No se pudo conectar a Jenkins. ¿Está encendido?" });
    }
});


// ==========================================
// --- SERVIDOR DE REACT (El comodín final) ---
// ==========================================

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
});