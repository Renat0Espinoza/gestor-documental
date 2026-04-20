pipeline {
    agent any

environment {
        // Vinculamos los IDs de Jenkins a variables del pipeline
        AZURE_CLIENT_ID     = credentials('AZURE_CLIENT_ID')
        AZURE_TENANT_ID     = credentials('AZURE_TENANT_ID')
        AZURE_CLIENT_SECRET = credentials('AZURE_CLIENT_SECRET')
    }
    
    stages {
        stage('Construir Imagen') {
            steps {
                // Usamos 'bat' en lugar de 'sh' para Windows
                bat 'docker build -t mi-gestor-app:latest .'
            }
        }
        stage('Desplegar en el Host') {
            steps {
                script {
                    try {
                    bat 'docker stop gestor-contenedor'
                    bat 'docker rm gestor-contenedor'
                } catch (Exception e) {
                    echo "Limpiando contenedores antiguos..."
                }
            
                // Asegúrate de que el archivo .env esté en la raíz del proyecto en GitHub o en el Workspace
                bat 'docker run -d --name gestor-contenedor -p 3000:3000 --env-file .env mi-gestor-app:latest'
                }
            }
        }
    }
}
