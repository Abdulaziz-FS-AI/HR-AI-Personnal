# HR AI SaaS Azure Functions

This Azure Functions project provides the backend processing pipeline for the HR AI SaaS application, handling PDF text extraction, AI-powered resume analysis, and results compilation.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Next.js App   │    │  Service Bus     │    │ Azure Functions │
│                 │────│  Queues          │────│                 │
│ • File Upload   │    │                  │    │ • PDF Processor │
│ • Results View  │    │ • file-processing│    │ • AI Analyzer   │
│ • Dashboard     │    │ • ai-analysis    │    │ • Results API   │
└─────────────────┘    │ • session-completion  │ └─────────────────┘
                       └──────────────────┘    
                                │
                                ▼
                       ┌──────────────────┐
                       │ Azure SQL Database│
                       │                  │
                       │ • uploaded_files │
                       │ • analysis_results│
                       │ • batch_sessions │
                       └──────────────────┘
```

## Functions Overview

### 1. PDF Processor (`pdfProcessor`)
- **Trigger**: Service Bus Queue (`file-processing`)
- **Purpose**: Extract text from uploaded PDF files
- **Process**:
  1. Download PDF from Azure Blob Storage
  2. Extract text using pdf-parse library
  3. Clean and structure text data
  4. Extract contact information and resume sections
  5. Update file status in database
  6. Queue for AI analysis if role specified

### 2. AI Analyzer (`aiAnalyzer`)
- **Trigger**: Service Bus Queue (`ai-analysis`)
- **Purpose**: Analyze resumes using AI against job role requirements
- **Process**:
  1. Get role details with skills and questions
  2. Build structured prompt for AI analysis
  3. Call Hyperbolic.xyz API (Llama 3.1 model)
  4. Parse and validate AI response
  5. Save analysis results to database
  6. Queue session completion check

### 3. Session Completion Checker (`sessionCompletionChecker`)
- **Trigger**: Service Bus Queue (`session-completion`)
- **Purpose**: Check if batch processing session is complete
- **Process**:
  1. Count processed vs total files in session
  2. Update batch session status when complete
  3. Enable results viewing in dashboard

### 4. Results Compiler (`getEvaluationResults`, `getSessionProgress`)
- **Trigger**: HTTP requests from Next.js app
- **Purpose**: Compile and serve analysis results
- **Endpoints**:
  - `GET /api/evaluations/{sessionId}/results` - Get complete results
  - `GET /api/evaluations/{sessionId}/progress` - Get processing progress

## Service Bus Queues

### file-processing
- **Purpose**: Queue PDF files for text extraction
- **Message Format**:
  ```json
  {
    "fileId": "string",
    "userId": "string", 
    "sessionId": "string",
    "blobName": "string",
    "fileName": "string",
    "priority": 1-10,
    "retryCount": 0
  }
  ```

### ai-analysis
- **Purpose**: Queue extracted text for AI analysis
- **Message Format**:
  ```json
  {
    "fileId": "string",
    "userId": "string",
    "roleId": "string", 
    "sessionId": "string",
    "extractedText": "string",
    "priority": 1-10,
    "retryCount": 0
  }
  ```

### session-completion
- **Purpose**: Queue session completion checks
- **Message Format**:
  ```json
  {
    "sessionId": "string",
    "userId": "string",
    "roleId": "string"
  }
  ```

## Environment Variables

### Required Configuration
```env
# Database
DB_SERVER=your-sql-server.database.windows.net
DB_DATABASE=hr-ai-saas-db
DB_USERNAME=your-username
DB_PASSWORD=your-password

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...

# Service Bus
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...

# AI Service
HYPERBOLIC_API_KEY=your-api-key
HYPERBOLIC_API_URL=https://api.hyperbolic.xyz/v1/chat/completions

# Application Insights (optional)
APPINSIGHTS_INSTRUMENTATIONKEY=your-key
```

## Development Setup

### Prerequisites
- Node.js 18+ 
- Azure Functions Core Tools
- Azure CLI (for deployment)
- TypeScript

### Installation
```bash
# Install dependencies
npm install

# Install Azure Functions Core Tools globally
npm install -g azure-functions-core-tools@4 --unsafe-perm true

# Build TypeScript
npm run build

# Start local development
func start
```

### Local Testing
```bash
# Build and watch for changes
npm run watch

# In another terminal, start functions
func start

# Test with local Service Bus emulator or Azure Service Bus
```

## Deployment

### Using Azure CLI
```bash
# Login to Azure
az login

# Create Function App (if not exists)
az functionapp create \
  --resource-group hr-ai-saas-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name hr-ai-saas-functions \
  --storage-account hraisaasstorage

# Deploy functions
func azure functionapp publish hr-ai-saas-functions
```

### Using VS Code
1. Install Azure Functions extension
2. Sign in to Azure
3. Deploy to Function App
4. Configure application settings

## Monitoring & Debugging

### Application Insights
- Function execution metrics
- Error tracking and logging
- Performance monitoring
- Custom telemetry

### Logging
```typescript
context.log('Info message')
context.warn('Warning message') 
context.error('Error message', error)
```

### Health Checks
- Service Bus connection health
- Database connection health
- AI API availability
- Blob storage accessibility

## Performance & Scaling

### Concurrency Settings
- **PDF Processing**: Up to 16 concurrent executions
- **AI Analysis**: Up to 8 concurrent executions (cost optimization)
- **Results API**: Auto-scaling based on demand

### Retry Policies
- **PDF Processing**: 3 retries with exponential backoff
- **AI Analysis**: 2 retries (cost consideration)
- **Session Completion**: No retries (non-critical)

### Cost Optimization
- Efficient Service Bus message handling
- AI API call batching where possible
- Appropriate function timeout settings
- Resource cleanup after processing

## Error Handling

### Dead Letter Queues
- Failed messages after max retries
- Manual intervention capability
- Error logging and alerting

### Graceful Degradation
- Partial processing completion
- File-level error isolation
- Session completion even with failures

## Security

### Authentication
- Managed Identity for Azure resources
- Connection string encryption
- API key management via Key Vault

### Data Protection
- Encrypted connections to all services
- Temporary file cleanup
- Audit logging for compliance

## Testing

### Local Testing
```bash
# Run unit tests
npm test

# Run integration tests with local emulators
npm run test:integration
```

### Load Testing
- Service Bus queue throughput
- Concurrent function execution
- Database connection pooling
- AI API rate limiting

## Troubleshooting

### Common Issues
1. **Service Bus Connection Issues**
   - Check connection string format
   - Verify queue names match configuration
   - Ensure proper permissions

2. **PDF Processing Failures**  
   - Verify blob storage access
   - Check file format and size limits
   - Review pdf-parse library compatibility

3. **AI Analysis Timeouts**
   - Monitor API rate limits
   - Check prompt size and complexity
   - Verify model availability

4. **Database Connection Errors**
   - Validate connection string
   - Check firewall settings
   - Monitor connection pool usage

### Debug Locally
```bash
# Enable detailed logging
export AZURE_FUNCTIONS_ENVIRONMENT=Development

# Start with debugging
func start --verbose
```