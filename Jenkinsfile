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
                sh 'docker build -t mi-gestor-app:latest .'
            }
        }
        stage('Desplegar en el Host') {
            steps {
                script {
                    try {
                    sh 'docker stop gestor-contenedor'
                    sh 'docker rm gestor-contenedor'
                } catch (Exception e) {
                    echo "Limpiando contenedores antiguos..."
                }
            
                // Generamos el archivo .env al vuelo con las variables inyectadas por Jenkins
                sh 'echo "AZURE_CLIENT_ID=${AZURE_CLIENT_ID}" > .env'
                sh 'echo "AZURE_TENANT_ID=${AZURE_TENANT_ID}" >> .env'
                sh 'echo "AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET}" >> .env'
                
                sh 'docker run -d --name gestor-contenedor -p 3000:3000 --env-file .env mi-gestor-app:latest'
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
