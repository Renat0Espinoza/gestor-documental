import { loadRequirements, saveRequirements } from '../data/requirements.js';

// Listar todos los requerimientos
const listRequirements = (_req, res) => {
    try {
        res.json(loadRequirements());
    } catch (err) {
        console.error('Error al listar requerimientos:', err);
        res.status(500).json({ error: 'No se pudieron leer los requerimientos' });
    }
};

// Crear un requerimiento
const createRequirement = (req, res) => {
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
};

// Actualizar estado de un requerimiento
const updateRequirementStatus = (req, res) => {
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
};

// Actualizar prioridad de un requerimiento
const updateRequirementPriority = (req, res) => {
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
};

// Actualizar lectores de un requerimiento
const updateRequirementLectores = (req, res) => {
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
};

// Eliminar un requerimiento
const deleteRequirement = (req, res) => {
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
};

// Agregar comentario a un requerimiento
const addComment = (req, res) => {
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
};

// Eliminar todos los requerimientos de un proyecto
const deleteRequirementsByProject = (req, res) => {
    try {
        const { proyectoId } = req.params;
        const reqs = loadRequirements();
        const filtered = reqs.filter(r => r.proyectoId !== proyectoId);
        const deletedCount = reqs.length - filtered.length;
        saveRequirements(filtered);
        console.log(`🗑️ ${deletedCount} requerimiento(s) eliminados del proyecto: ${proyectoId}`);
        res.json({ success: true, deletedCount });
    } catch (err) {
        console.error('Error al eliminar requerimientos del proyecto:', err);
        res.status(500).json({ error: 'Error al eliminar los requerimientos del proyecto' });
    }
};

export {
    listRequirements,
    createRequirement,
    updateRequirementStatus,
    updateRequirementPriority,
    updateRequirementLectores,
    deleteRequirement,
    deleteRequirementsByProject,
    addComment
};
