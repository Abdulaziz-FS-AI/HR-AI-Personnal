# Azure Functions Deployment Guide

## Prerequisites

### 1. Azure Resources Required
- **Azure Function App** (Node.js 18, Consumption or Premium plan)
- **Azure Service Bus** with queues: `file-processing`, `ai-analysis`, `session-completion`
- **Azure SQL Database** with HR AI SaaS schema
- **Azure Storage Account** for blob storage and function storage
- **Application Insights** (optional but recommended)

### 2. Local Development Tools
```bash
# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Install Azure CLI
# Windows: Download from https://aka.ms/installazurecliwindows
# macOS: brew install azure-cli
# Linux: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

## Step 1: Create Azure Resources

### Create Resource Group
```bash
az login
az group create --name hr-ai-saas-rg --location eastus
```

### Create Storage Account
```bash
az storage account create \
  --name hraisaasstorage \
  --location eastus \
  --resource-group hr-ai-saas-rg \
  --sku Standard_LRS
```

### Create Service Bus Namespace
```bash
az servicebus namespace create \
  --name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-rg \
  --location eastus \
  --sku Standard

# Create queues
az servicebus queue create \
  --resource-group hr-ai-saas-rg \
  --namespace-name hr-ai-saas-servicebus \
  --name file-processing

az servicebus queue create \
  --resource-group hr-ai-saas-rg \
  --namespace-name hr-ai-saas-servicebus \
  --name ai-analysis

az servicebus queue create \
  --resource-group hr-ai-saas-rg \
  --namespace-name hr-ai-saas-servicebus \
  --name session-completion
```

### Create SQL Database
```bash
az sql server create \
  --name hr-ai-saas-server \
  --resource-group hr-ai-saas-rg \
  --location eastus \
  --admin-user dbadmin \
  --admin-password "YourSecurePassword123!"

az sql db create \
  --resource-group hr-ai-saas-rg \
  --server hr-ai-saas-server \
  --name hr-ai-saas-db \
  --service-objective Basic
```

### Create Function App
```bash
az functionapp create \
  --resource-group hr-ai-saas-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name hr-ai-saas-functions \
  --storage-account hraisaasstorage
```

## Step 2: Get Connection Strings

### Storage Account Connection String
```bash
az storage account show-connection-string \
  --name hraisaasstorage \
  --resource-group hr-ai-saas-rg \
  --query connectionString \
  --output tsv
```

### Service Bus Connection String
```bash
az servicebus namespace authorization-rule keys list \
  --resource-group hr-ai-saas-rg \
  --namespace-name hr-ai-saas-servicebus \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString \
  --output tsv
```

### SQL Database Connection String
```bash
# Format: Server=tcp:hr-ai-saas-server.database.windows.net,1433;Initial Catalog=hr-ai-saas-db;Persist Security Info=False;User ID=dbadmin;Password=YourSecurePassword123!;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## Step 3: Configure Function App Settings

### Set Application Settings
```bash
# Azure Storage
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "AZURE_STORAGE_CONNECTION_STRING=<storage-connection-string>"

# Service Bus
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "AZURE_SERVICE_BUS_CONNECTION_STRING=<servicebus-connection-string>"

# Database
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "DB_SERVER=hr-ai-saas-server.database.windows.net"

az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "DB_DATABASE=hr-ai-saas-db"

az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "DB_USERNAME=dbadmin"

az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "DB_PASSWORD=YourSecurePassword123!"

# AI Service
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "HYPERBOLIC_API_KEY=<your-hyperbolic-api-key>"

az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "HYPERBOLIC_API_URL=https://api.hyperbolic.xyz/v1/chat/completions"
```

## Step 4: Build and Deploy Functions

### Local Build and Test
```bash
# Navigate to functions directory
cd azure-functions

# Install dependencies
npm install

# Build TypeScript
npm run build

# Test locally (optional)
func start --verbose
```

### Deploy to Azure
```bash
# Deploy functions
func azure functionapp publish hr-ai-saas-functions

# Verify deployment
az functionapp function list \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg
```

## Step 5: Configure Database Schema

### Deploy Database Schema
The functions expect the following database schema to exist. Run these SQL scripts on your Azure SQL Database:

```sql
-- Create uploaded_files table (if not exists)
CREATE TABLE uploaded_files (
    id NVARCHAR(50) PRIMARY KEY,
    userId NVARCHAR(50) NOT NULL,
    sessionId NVARCHAR(50),
    roleId NVARCHAR(50),
    fileName NVARCHAR(255) NOT NULL,
    originalFilename NVARCHAR(255),
    fileSizeBytes BIGINT,
    fileUrl NVARCHAR(1000),
    processingStatus NVARCHAR(20) DEFAULT 'uploaded',
    extractedText NTEXT,
    errorMessage NTEXT,
    uploadedDate DATETIME2 DEFAULT GETDATE(),
    processedDate DATETIME2
);

-- Create batch_sessions table (if not exists)
CREATE TABLE batch_sessions (
    sessionId NVARCHAR(50) PRIMARY KEY,
    userId NVARCHAR(50) NOT NULL,
    roleId NVARCHAR(50),
    status NVARCHAR(20) DEFAULT 'processing',
    totalFiles INT DEFAULT 0,
    totalProcessed INT DEFAULT 0,
    totalFailed INT DEFAULT 0,
    createdAt DATETIME2 DEFAULT GETDATE(),
    completedAt DATETIME2
);

-- Create resume_analysis_results table (if not exists)
CREATE TABLE resume_analysis_results (
    id NVARCHAR(50) PRIMARY KEY,
    fileId NVARCHAR(50) NOT NULL,
    roleId NVARCHAR(50) NOT NULL,
    sessionId NVARCHAR(50),
    overallScore INT,
    technicalScore INT,
    experienceScore INT,
    educationScore INT,
    skillsScore INT,
    cultureFitScore INT,
    executiveSummary NTEXT,
    detailedAnalysis NTEXT,
    topStrengths NTEXT,
    concernsGaps NTEXT,
    redFlags NTEXT,
    standoutAchievements NTEXT,
    interviewQuestions NTEXT,
    recommendation NVARCHAR(20),
    recommendationReason NTEXT,
    aiModelUsed NVARCHAR(100),
    processingTimeSeconds INT,
    aiCost DECIMAL(10,6),
    createdDate DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (fileId) REFERENCES uploaded_files(id)
);
```

## Step 6: Verification and Testing

### Check Function Status
```bash
# List functions
az functionapp function list \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --output table

# Check function logs
az functionapp logs tail \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg
```

### Test Service Bus Integration
```bash
# Send test message to file-processing queue
az servicebus queue send \
  --resource-group hr-ai-saas-rg \
  --namespace-name hr-ai-saas-servicebus \
  --name file-processing \
  --body '{"fileId":"test123","userId":"user1","sessionId":"session1","blobName":"test.pdf","fileName":"test.pdf","priority":5}'
```

### Test HTTP Endpoints
```bash
# Test results endpoint (replace with actual sessionId)
curl "https://hr-ai-saas-functions.azurewebsites.net/api/evaluations/session123/progress?userId=user1"
```

## Step 7: Monitoring Setup

### Enable Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app hr-ai-saas-functions-insights \
  --location eastus \
  --resource-group hr-ai-saas-rg

# Get instrumentation key
az monitor app-insights component show \
  --app hr-ai-saas-functions-insights \
  --resource-group hr-ai-saas-rg \
  --query instrumentationKey \
  --output tsv

# Set in function app
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-rg \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=<instrumentation-key>"
```

## Step 8: Integration with Next.js App

### Update Next.js Environment Variables
Add these to your Next.js `.env.local`:
```env
# Azure Functions API endpoints
AZURE_FUNCTIONS_URL=https://hr-ai-saas-functions.azurewebsites.net/api
```

### Update Service Bus Integration
Ensure your Next.js app can queue messages to Service Bus:
```typescript
// In your Next.js API routes
import { queueFileForProcessing } from '../lib/azure/service-bus'

// Queue file for processing
await queueFileForProcessing({
  fileId: file.id,
  userId: session.user.id,
  sessionId: batchSession.sessionId,
  blobName: file.blobName,
  fileName: file.fileName,
  priority: 5
})
```

## Troubleshooting

### Common Issues

1. **Function Not Triggering**
   - Check Service Bus connection string
   - Verify queue names match exactly
   - Check function app settings

2. **Database Connection Errors**
   - Verify SQL Server firewall allows Azure services
   - Check connection string format
   - Ensure database schema exists

3. **AI API Errors**
   - Verify Hyperbolic API key is valid
   - Check API rate limits
   - Monitor API usage costs

4. **Blob Storage Issues**
   - Verify storage account connection string
   - Check container permissions
   - Ensure blob names are correct

### Debug Locally
```bash
# Set local environment variables
export AZURE_STORAGE_CONNECTION_STRING="<connection-string>"
export AZURE_SERVICE_BUS_CONNECTION_STRING="<connection-string>"
export DB_SERVER="<server-name>"
# ... other variables

# Start functions locally
func start --verbose
```

### Monitor in Production
- Use Application Insights dashboards
- Set up alerts for failures
- Monitor cost and performance metrics
- Review function execution logs regularly

## Security Considerations

1. **Use Managed Identity** (recommended for production)
2. **Store secrets in Key Vault**
3. **Enable HTTPS only**
4. **Restrict CORS appropriately**
5. **Monitor for unusual activity**
6. **Regular security updates**

## Cost Optimization

1. **Choose appropriate Function App plan**
2. **Optimize concurrency settings**
3. **Monitor AI API usage**
4. **Use appropriate storage tiers**
5. **Clean up old data regularly**