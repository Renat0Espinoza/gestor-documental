import express from 'express';
import 'dotenv/config';
import multer from 'multer';
import fs from 'fs';
import cors from 'cors';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

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

// --- RUTAS ---

// 1. LISTAR ARCHIVOS (Nuevo: Necesario para el Frontend)
app.get('/files', (req, res) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) return res.json([]);
    
    fs.readdir(dir, (err, files) => {
        if (err) return res.status(500).json({ error: "No se pudieron leer los archivos" });
        // Filtramos para no mostrar el archivo .gitkeep
        const filteredFiles = files.filter(file => file !== '.gitkeep');
        res.json(filteredFiles);
    });
});

// 2. SUBIR ARCHIVO
app.post('/upload', upload.single('archivo'), (req, res) => {
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
app.get('/test-sharepoint', async (req, res) => {
    try {
        const client = await getGraphClient();
        const site = await client.api('/sites/root').get();
        res.json({ success: true, siteName: site.displayName });
    } catch (error) {
        res.status(500).json({ success: false, error: "Sin licencia SPO", detalle: error.message });
    }
});

// 4. BUILD DE JENKINS
app.post('/jenkins-build', async (req, res) => {
    try {
        const auth = Buffer.from(`${process.env.JENKINS_USER}:${process.env.JENKINS_TOKEN}`).toString('base64');
        
        // Esta URL dispara el Job que acabas de crear
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
app.get('/jenkins-status', async (req, res) => {
    try {
        const { JENKINS_URL, JENKINS_USER, JENKINS_TOKEN } = process.env;

        // Validamos que existan los datos
        if (!JENKINS_USER || !JENKINS_TOKEN) {
            return res.json({ connected: false, message: "Faltan credenciales en el .env" });
        }

        // Creamos la credencial codificada en Base64
        const auth = Buffer.from(`${JENKINS_USER}:${JENKINS_TOKEN}`).toString('base64');

        // Consultamos la API básica de Jenkins
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

// 6. DOCKER
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Servir los archivos estáticos del frontend (React)
app.use(express.static(path.join(__dirname, 'public')));

// Cualquier ruta que no sea de la API, devuelve el index.html de React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en puerto ${PORT}`);
});