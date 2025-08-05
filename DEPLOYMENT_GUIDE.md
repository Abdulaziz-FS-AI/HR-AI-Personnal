# HR AI SaaS - Production Deployment Guide

This guide provides step-by-step instructions for deploying the HR AI SaaS system to Microsoft Azure.

## 🏗️ Architecture Overview

The system consists of:
- **Azure Functions**: Serverless processing pipeline (PDF processing, AI analysis)
- **Azure SQL Database**: Production database with security and audit features
- **Azure Service Bus**: Message queuing for reliable processing
- **Azure Blob Storage**: PDF file storage
- **Azure Application Insights**: Monitoring and logging

## 📋 Prerequisites

1. **Azure Subscription** with sufficient permissions
2. **Azure CLI** installed and configured
3. **Node.js 18+** and npm
4. **Azure Functions Core Tools v4**
5. **Hyperbolic.xyz API key** for AI processing

## 🚀 Step 1: Create Azure Resources

### 1.1 Resource Group
```bash
az group create --name hr-ai-saas-prod --location eastus
```

### 1.2 Storage Account
```bash
az storage account create \
  --name hraisaasstorage \
  --resource-group hr-ai-saas-prod \
  --location eastus \
  --sku Standard_LRS \
  --kind StorageV2
```

Create blob container:
```bash
az storage container create \
  --name resumes \
  --account-name hraisaasstorage \
  --public-access off
```

### 1.3 Service Bus Namespace
```bash
az servicebus namespace create \
  --name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-prod \
  --location eastus \
  --sku Standard

# Create queues
az servicebus queue create \
  --name file-processing \
  --namespace-name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-prod

az servicebus queue create \
  --name ai-analysis \
  --namespace-name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-prod

az servicebus queue create \
  --name session-completion \
  --namespace-name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-prod
```

### 1.4 SQL Database
```bash
az sql server create \
  --name hr-ai-saas-server \
  --resource-group hr-ai-saas-prod \
  --location eastus \
  --admin-user sqladmin \
  --admin-password 'YourSecurePassword123!'

az sql db create \
  --name hr-ai-saas-db \
  --server hr-ai-saas-server \
  --resource-group hr-ai-saas-prod \
  --service-objective S2
```

### 1.5 Application Insights
```bash
az monitor app-insights component create \
  --app hr-ai-saas-insights \
  --location eastus \
  --resource-group hr-ai-saas-prod
```

### 1.6 Function App
```bash
az functionapp create \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-prod \
  --storage-account hraisaasstorage \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

## 🔧 Step 2: Configure Connection Strings

Get connection strings:
```bash
# Storage Account
az storage account show-connection-string \
  --name hraisaasstorage \
  --resource-group hr-ai-saas-prod

# Service Bus
az servicebus namespace authorization-rule keys list \
  --name RootManageSharedAccessKey \
  --namespace-name hr-ai-saas-servicebus \
  --resource-group hr-ai-saas-prod

# SQL Database
az sql db show-connection-string \
  --name hr-ai-saas-db \
  --server hr-ai-saas-server \
  --client ado.net
```

## 🗄️ Step 3: Deploy Database Schema

1. Connect to your Azure SQL Database using SQL Server Management Studio or Azure Data Studio
2. Execute the production schema script:

```bash
cd azure-functions
sqlcmd -S hr-ai-saas-server.database.windows.net -d hr-ai-saas-db -U sqladmin -P 'YourSecurePassword123!' -i database-schema-production.sql
```

## ⚙️ Step 4: Configure Application Settings

Set environment variables in the Function App:

```bash
az functionapp config appsettings set \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-prod \
  --settings \
    "SERVICE_BUS_CONNECTION=Endpoint=sb://hr-ai-saas-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=YOUR_KEY" \
    "STORAGE_CONNECTION=DefaultEndpointsProtocol=https;AccountName=hraisaasstorage;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net" \
    "DATABASE_CONNECTION=Server=tcp:hr-ai-saas-server.database.windows.net,1433;Initial Catalog=hr-ai-saas-db;Persist Security Info=False;User ID=sqladmin;Password=YourSecurePassword123!;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;" \
    "HYPERBOLIC_API_KEY=your_hyperbolic_api_key" \
    "JWT_SECRET=your_jwt_secret_key_256_bits" \
    "MAX_DAILY_AI_COST=100" \
    "MAX_MONTHLY_AI_COST=2000" \
    "USER_AI_RATE_LIMIT=10" \
    "GLOBAL_AI_RATE_LIMIT=100"
```

## 📦 Step 5: Deploy Azure Functions

1. Build the project:
```bash
cd azure-functions
npm install
npm run build
```

2. Deploy to Azure:
```bash
func azure functionapp publish hr-ai-saas-functions
```

## 🔒 Step 6: Security Configuration

### 6.1 Network Security
```bash
# Restrict Function App to HTTPS only
az functionapp update \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-prod \
  --set httpsOnly=true

# Configure CORS (adjust origins as needed)
az functionapp cors add \
  --name hr-ai-saas-functions \
  --resource-group hr-ai-saas-prod \
  --allowed-origins https://yourdomain.com
```

### 6.2 Database Security
```bash
# Configure firewall rules (adjust IP ranges as needed)
az sql server firewall-rule create \
  --name AllowAzureServices \
  --server hr-ai-saas-server \
  --resource-group hr-ai-saas-prod \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

## 📊 Step 7: Monitoring Setup

The system includes comprehensive monitoring:

1. **Application Insights**: Automatic telemetry and performance monitoring
2. **Health Check Endpoint**: `GET /api/health`
3. **Cost Tracking**: Built-in AI usage cost monitoring
4. **Security Audit Log**: All security events logged to database

Monitor key metrics:
- Function execution success rates
- AI API costs and usage
- Database performance
- Queue message processing times

## 🧪 Step 8: Testing

Test the deployment:

1. **Health Check**:
```bash
curl https://hr-ai-saas-functions.azurewebsites.net/api/health
```

2. **Upload Test** (requires authentication):
```bash
curl -X POST https://hr-ai-saas-functions.azurewebsites.net/api/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test-resume.pdf"
```

## 🔄 Step 9: Maintenance

### Regular Tasks:
1. **Monitor costs**: Check AI usage in Application Insights
2. **Review security logs**: Query `security_audit_log` table
3. **Database maintenance**: Update statistics, check indexes
4. **Backup verification**: Ensure automated backups are working

### Scaling:
- Function App: Automatically scales based on demand
- SQL Database: Monitor DTU usage and scale service tier as needed
- Service Bus: Monitor queue lengths and add more partitions if needed

## 🚨 Production Considerations

### Security:
✅ JWT authentication implemented
✅ Rate limiting configured  
✅ Input validation and sanitization
✅ SQL injection prevention
✅ XSS protection
✅ HTTPS enforced

### Reliability:
✅ Database connection pooling
✅ Atomic transactions
✅ Retry logic with exponential backoff
✅ Health monitoring
✅ Graceful error handling

### Cost Control:
✅ AI usage limits ($100/day, $2000/month)
✅ Request rate limiting
✅ Automatic cost tracking
✅ Budget alerts recommended

### Performance:
✅ Optimized database indexes
✅ Connection pooling
✅ Async processing pipeline
✅ Blob storage for files

## 📞 Support

For issues or questions:
1. Check Application Insights logs
2. Review Azure Function logs
3. Query security audit tables
4. Monitor Service Bus queue health

The system is now production-ready with enterprise-grade security, reliability, and monitoring capabilities.