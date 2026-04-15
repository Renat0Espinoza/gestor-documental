import express from 'express';
import 'dotenv/config';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

const app = express();
app.use(cors()); // Permite que el frontend se conecte sin bloqueos
app.use(express.json());

// --- CONFIGURACIÓN DE MULTER (LOCAL) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir); // Crea la carpeta si no existe
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Guardamos con fecha para evitar que archivos con el mismo nombre se borren
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

// 1. Ruta para subir archivos
app.post('/upload', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

        console.log('Archivo guardado en:', req.file.path);
        
        res.json({
            success: true,
            message: "Archivo guardado localmente",
            fileData: {
                nombre: req.file.filename,
                original: req.file.originalname,
                ruta: req.file.path
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Ruta de prueba de SharePoint (La que ya tenías)
app.get('/test-sharepoint', async (req, res) => {
    try {
        const client = await getGraphClient();
        const site = await client.api('/sites/root').get();
        res.json({ success: true, siteName: site.displayName });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: "Tenant sin licencia de SharePoint", 
            detalle: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
    console.log(`📂 Carpeta de subidas lista: /backend/uploads`);
});