# Azure Container Apps deployment for AXIS backend
# Deploy: az deployment group create -g axis-rg -f azure/deploy.bicep

param location string = resourceGroup().location
param appName string = 'axis-api'
param imageName string = 'axis-backend:latest'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource containerEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${appName}-db'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: 'axis'
    administratorLoginPassword: 'ChangeMeInProduction!'
    storage: { storageSizeGB: 32 }
  }
}

resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: containerEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'auto'
      }
      secrets: [
        { name: 'venice-api-key', value: '' }
        { name: 'openai-api-key', value: '' }
        { name: 'magic-secret-key', value: '' }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: imageName
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'PORT', value: '8000' }
            { name: 'ENVIRONMENT', value: 'production' }
            {
              name: 'DATABASE_URL'
              value: 'postgresql+asyncpg://axis:ChangeMeInProduction!@${postgres.properties.fullyQualifiedDomainName}:5432/axis'
            }
            { name: 'VENICE_API_KEY', secretRef: 'venice-api-key' }
            { name: 'OPENAI_API_KEY', secretRef: 'openai-api-key' }
            { name: 'MAGIC_SECRET_KEY', secretRef: 'magic-secret-key' }
          ]
        }
      ]
      scale: { minReplicas: 1, maxReplicas: 3 }
    }
  }
}

output apiUrl string = containerApp.properties.configuration.ingress.fqdn
