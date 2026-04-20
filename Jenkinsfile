pipeline {
    agent any

environment {
        AZURE_CLIENT_ID     = credentials('AZURE_CLIENT_ID')
        AZURE_TENANT_ID     = credentials('AZURE_TENANT_ID')
        AZURE_CLIENT_SECRET = credentials('AZURE_CLIENT_SECRET')
    }
    
    stages {
        stage('Construir Imagen') {
            steps {
                // Usamos 'sh' para Linux
                sh "docker build -t mi-gestor-app:latest ."
            }
        }
        stage('Desplegar en el Host') {
            steps {
                script {
                    try {
                        sh "docker stop gestor-contenedor || true"
                        sh "docker rm gestor-contenedor || true"
                    } catch (Exception e) {
                        echo "Limpiando..."
                    }
            
                    // AQUÍ ESTÁ LA MAGIA: Mapeamos los nombres de Jenkins a los nombres de Node.js
                    sh "echo CLIENT_ID=${AZURE_CLIENT_ID} > .env"
                    sh "echo TENANT_ID=${AZURE_TENANT_ID} >> .env"
                    sh "echo CLIENT_SECRET=${AZURE_CLIENT_SECRET} >> .env"
                    sh "echo PORT=3000 >> .env"
                
                    sh "docker run -d --name gestor-contenedor -p 3000:3000 --env-file .env mi-gestor-app:latest"
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
