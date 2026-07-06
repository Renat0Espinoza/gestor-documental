import { Router } from 'express';
import { getGithubStatus } from '../controllers/githubController.js';

const router = Router();

// 5. ESTADO DEL DEPLOY (GitHub Actions)
router.get('/github-status', getGithubStatus);

export default router;
