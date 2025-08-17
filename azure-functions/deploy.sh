#!/bin/bash

# Basic Azure Functions deployment script
echo "Starting Azure Functions deployment..."

# Install Azure Functions Core Tools if not present
if ! command -v func &> /dev/null; then
    echo "Installing Azure Functions Core Tools..."
    npm install -g azure-functions-core-tools@4 --unsafe-perm true
fi

# Create basic function structure for deployment
echo "Preparing deployment structure..."

# Create host.json for Azure Functions
cat > host.json << 'EOF'
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true
      }
    }
  },
  "functionTimeout": "00:10:00",
  "extensions": {
    "http": {
      "routePrefix": "api"
    },
    "serviceBus": {
      "prefetchCount": 100,
      "maxConcurrentCalls": 32,
      "autoRenewTimeout": "00:05:00"
    }
  }
}
EOF

# Create local.settings.json template
cat > local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "WEBSITE_NODE_DEFAULT_VERSION": "~18",
    "SERVICE_BUS_CONNECTION": "",
    "STORAGE_CONNECTION": "",
    "DATABASE_CONNECTION": "",
    "HYPERBOLIC_API_KEY": "",
    "JWT_SECRET": ""
  }
}
EOF

echo "Deployment structure created successfully!"
echo ""
echo "Next steps:"
echo "1. Set up your Azure resources (Function App, Service Bus, SQL Database, Storage Account)"
echo "2. Update local.settings.json with your connection strings"
echo "3. Run: func azure functionapp publish <your-function-app-name>"
echo ""
echo "Required Azure resources:"
echo "- Azure Function App (Node.js 18 runtime)"
echo "- Azure Service Bus with queues: file-processing, ai-analysis, session-completion"
echo "- Azure SQL Database"
echo "- Azure Storage Account with blob container: resumes"
echo "- Application Insights for monitoring"