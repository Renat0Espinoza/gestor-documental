// 5. ESTADO DEL DEPLOY (GitHub Actions)
const getGithubStatus = async (_req, res) => {
    try {
        const owner = process.env.GITHUB_OWNER || 'Renat0Espinoza';
        const repo = process.env.GITHUB_REPO || 'gestor-documental';
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            return res.json({ connected: false, message: 'Token de GitHub no configurado' });
        }

        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=1`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            }
        );

        const data = await response.json();
        const ultimoRun = data.workflow_runs?.[0];

        if (!ultimoRun) {
            return res.json({ connected: false, message: 'Sin ejecuciones aún' });
        }

        const exitoso = ultimoRun.conclusion === 'success';
        res.json({
            connected: exitoso,
            message: exitoso ? 'Último deploy exitoso' : `Estado: ${ultimoRun.conclusion || ultimoRun.status}`,
            run_url: ultimoRun.html_url,
            updated_at: ultimoRun.updated_at
        });

    } catch (err) {
        console.error('Error al contactar GitHub:', err.message);
        res.json({ connected: false, message: 'Error al contactar GitHub' });
    }
};

export { getGithubStatus };
