# HR AI SaaS - Bulk Processing Deployment Guide

## Overview

This guide will help you deploy the complete bulk PDF processing system with Azure Service Bus and Azure Functions for the HR AI SaaS application.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Vercel App     │────▶│  Service Bus     │────▶│ Azure Functions │
│  (Frontend)     │     │  (Queue)         │     │  (Processor)    │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                                                  │
        │                                                  │
        ▼                                                  ▼
┌─────────────────┐                              ┌─────────────────┐
│                 │                              │                 │
│  Azure SQL DB   │◀────────────────────────────│  Blob Storage   │
│                 │                              │                 │
└─────────────────┘                              └─────────────────┘
```

## Prerequisites

1. **Azure Account**: Active Azure subscription
2. **Azure CLI**: Install from [here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Azure Functions Core Tools**: Install with `npm install -g azure-functions-core-tools@4`
4. **Node.js**: Version 20.x or higher
5. **Git**: For version control

## Step 1: Setup Azure Service Bus

This creates the message queue for asynchronous processing.

```bash
# Run the setup script
npm run setup:service-bus

# Or manually run
./scripts/setup-azure-service-bus.sh
```

This script will:
- Create a Service Bus namespace
- Create an evaluation queue
- Generate connection strings
- Save configuration to `.env.local`

## Step 2: Configure Environment Variables

After running the setup script, verify your `.env.local` file contains:

```env
# Azure Service Bus
AZURE_SERVICE_BUS_CONNECTION_STRING="Endpoint=sb://..."
AZURE_SERVICE_BUS_NAMESPACE="hr-ai-saas-sb-xxxxx"
AZURE_SERVICE_BUS_QUEUE_NAME="evaluation-queue"

# Internal API Key
INTERNAL_API_KEY="generated-random-key"

# Vercel App URL (UPDATE THIS!)
VERCEL_APP_URL="https://hr-ai-personnal.vercel.app"

# Existing Azure Resources (should already be configured)
AZURE_STORAGE_CONNECTION_STRING="..."
DB_SERVER="..."
DB_DATABASE="..."
DB_USERNAME="..."
DB_PASSWORD="..."
HYPERBOLIC_API_KEY="..."
```

## Step 3: Deploy Azure Functions

Deploy the evaluation processor function:

```bash
# Build and deploy functions
npm run deploy:functions

# Or manually
cd azure-functions
./deploy.sh
```

This will:
- Build the TypeScript functions
- Create a Function App in Azure
- Configure all app settings
- Deploy the evaluation processor

## Step 4: Update Vercel Environment Variables

Add these variables to your Vercel project:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `AZURE_SERVICE_BUS_CONNECTION_STRING`
   - `INTERNAL_API_KEY`
   - All other Azure variables if not already set

## Step 5: Test the System

### Test Direct Processing (< 10 files)
```bash
# Upload 5 files - should process directly
curl -X POST https://your-app.vercel.app/api/evaluations/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"evaluationId": "test-1", "files": [...]}'
```

### Test Queue Processing (> 10 files)
```bash
# Upload 15 files - should use queue
curl -X POST https://your-app.vercel.app/api/evaluations/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"evaluationId": "test-2", "files": [...]}'
```

### Monitor Azure Functions
```bash
# View real-time logs
az functionapp log tail \
  --name hr-ai-eval-processor \
  --resource-group hr-ai-saas-rg
```

## Processing Flow

### Small Batch (≤ 10 files)
1. User uploads files
2. API processes directly
3. Results returned immediately
4. User sees results in UI

### Large Batch (> 10 files)
1. User uploads files
2. API sends to Service Bus queue
3. User gets "processing" message
4. Azure Function picks up message
5. Function processes files
6. Function sends completion notification
7. User receives email with results link

## Monitoring & Debugging

### View Service Bus Metrics
```bash
# Check queue status
az servicebus queue show \
  --name evaluation-queue \
  --namespace-name YOUR_NAMESPACE \
  --resource-group hr-ai-saas-rg \
  --query "countDetails"
```

### View Function Logs
```bash
# Stream live logs
func azure functionapp logstream hr-ai-eval-processor
```

### Check Processing Status
```sql
-- In Azure SQL Database
SELECT 
  id, 
  status, 
  total_files, 
  files_processed,
  files_failed,
  created_at,
  completed_at
FROM evaluation_sessions
ORDER BY created_at DESC;
```

## Troubleshooting

### Issue: Service Bus Connection Failed
**Solution**: 
- Verify connection string in `.env.local`
- Check firewall rules in Azure
- Ensure Service Bus namespace is active

### Issue: Functions Not Triggering
**Solution**:
- Check Function App is running: `az functionapp show --name hr-ai-eval-processor`
- Verify Service Bus connection in Function App settings
- Check for messages in queue: `az servicebus queue show`

### Issue: Email Notifications Not Sent
**Solution**:
- Configure SMTP settings in `.env.local`
- Verify SMTP credentials
- Check spam folder
- Review notification endpoint logs

### Issue: Processing Timeout
**Solution**:
- Increase `maxDuration` in API route
- Reduce batch size
- Check Hyperbolic API rate limits

## Performance Tuning

### Optimize for High Volume
1. **Increase Service Bus Tier**: Upgrade from Basic to Standard for better throughput
2. **Scale Functions**: Configure auto-scaling in Function App
3. **Batch Size**: Adjust batch size based on processing time
4. **Concurrency**: Configure max concurrent executions

### Cost Optimization
1. **Service Bus**: Use Basic tier for < 1000 messages/day
2. **Functions**: Use Consumption plan for sporadic loads
3. **Storage**: Clean up old blobs periodically
4. **Database**: Use DTU model for predictable costs

## Security Best Practices

1. **Rotate Keys**: Regularly rotate INTERNAL_API_KEY
2. **Network Security**: Configure private endpoints for Service Bus
3. **Access Control**: Use managed identities where possible
4. **Audit Logs**: Enable diagnostic logs for all services
5. **Encryption**: Ensure all data is encrypted at rest and in transit

## Maintenance

### Weekly Tasks
- Review failed evaluations
- Check queue dead letter messages
- Monitor storage usage

### Monthly Tasks
- Rotate API keys
- Review costs and optimize
- Update dependencies
- Clean up old evaluation data

## Support

For issues or questions:
1. Check Azure Portal for service health
2. Review Function App logs
3. Check Vercel deployment logs
4. Contact support with evaluation ID and timestamp

## Appendix: Manual Azure Setup

If the scripts don't work, here's the manual setup:

### Create Service Bus Namespace
```bash
az servicebus namespace create \
  --name hr-ai-saas-sb \
  --resource-group hr-ai-saas-rg \
  --location eastus \
  --sku Basic
```

### Create Queue
```bash
az servicebus queue create \
  --name evaluation-queue \
  --namespace-name hr-ai-saas-sb \
  --resource-group hr-ai-saas-rg
```

### Get Connection String
```bash
az servicebus namespace authorization-rule keys list \
  --name RootManageSharedAccessKey \
  --namespace-name hr-ai-saas-sb \
  --resource-group hr-ai-saas-rg \
  --query primaryConnectionString
```

### Create Function App
```bash
az functionapp create \
  --name hr-ai-eval-processor \
  --storage-account hraistorage \
  --resource-group hr-ai-saas-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

### Deploy Functions
```bash
cd azure-functions
func azure functionapp publish hr-ai-eval-processor
```

---

✅ **Your bulk processing system is now ready to handle 150+ PDF files without timeouts!**