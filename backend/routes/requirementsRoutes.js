import { Router } from 'express';
import {
    listRequirements,
    createRequirement,
    updateRequirementStatus,
    updateRequirementPriority,
    updateRequirementLectores,
    deleteRequirement,
    deleteRequirementsByProject,
    addComment
} from '../controllers/requirementsController.js';

const router = Router();

// Listar todos los requerimientos
router.get('/', listRequirements);

// Crear un requerimiento
router.post('/', createRequirement);

// Actualizar estado de un requerimiento
router.patch('/:id/status', updateRequirementStatus);

// Actualizar prioridad de un requerimiento
router.patch('/:id/priority', updateRequirementPriority);

// Actualizar lectores de un requerimiento
router.patch('/:id/lectores', updateRequirementLectores);

// Eliminar todos los requerimientos de un proyecto
router.delete('/by-project/:proyectoId', deleteRequirementsByProject);

// Eliminar un requerimiento
router.delete('/:id', deleteRequirement);

// Agregar comentario a un requerimiento
router.post('/:id/comments', addComment);

export default router;
