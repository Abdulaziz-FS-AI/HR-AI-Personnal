# 🔥 Azure MCP Server Setup Guide

## 🎯 Best MCP Servers for Azure Backend Management

Based on research, I've configured the **BEST** MCP servers for your Azure SQL + Blob Storage + Service Bus backend:

### 1. **Azure MCP Server** (Microsoft Official) ⭐⭐⭐⭐⭐
- **Direct Azure Integration**: SQL Database, Blob Storage, Service Bus
- **Natural Language**: "List my blob containers", "Check database status"
- **Production Ready**: Uses DefaultAzureCredential authentication
- **Active Development**: Latest features and updates from Microsoft

### 2. **MSSQL MCP Server** (Microsoft Official) ⭐⭐⭐⭐⭐
- **SQL Server Specialist**: Dedicated for Azure SQL Database
- **Natural Language Queries**: "Show me all tables", "Get user count"
- **Multi-Environment**: Works with Azure SQL, on-premises SQL
- **Entra Authentication**: Secure authentication with Azure AD

## 🚀 Quick Setup Instructions

### **Step 1: Azure Authentication**
```bash
# Install Azure CLI if not installed
brew install azure-cli

# Login to Azure
az login

# Verify access to your resources
az account show
az storage account list
az sql server list
```

### **Step 2: Set Environment Variables**
Add to your `.env.local`:
```env
# Azure MCP Server Authentication
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id  
AZURE_CLIENT_SECRET=your-client-secret

# MSSQL MCP Server
MSSQL_CONNECTION_STRING="Server=your-server.database.windows.net;Database=your-db;Authentication=Active Directory Default;"
```

### **Step 3: Get Azure Credentials**
```bash
# Get your tenant ID
az account show --query tenantId -o tsv

# Create service principal (if needed)
az ad sp create-for-rbac --name "HR-AI-MCP" --role contributor
```

## 🎯 What These MCP Servers Give You

### **Azure MCP Server Capabilities:**
- 🗄️ **Blob Storage**: `"List containers"`, `"Upload file to blob"`
- 🗃️ **SQL Database**: `"Show database status"`, `"List tables"`
- 📨 **Service Bus**: `"Check queue status"`, `"Send message"`
- 📊 **Monitoring**: `"Show Azure logs"`, `"Check resource health"`

### **MSSQL MCP Server Capabilities:**
- 📋 **Database Schema**: `"Show all tables"`, `"Describe table structure"`
- 🔍 **Data Queries**: `"Count users"`, `"Find roles without requirements"`
- 🛠️ **Maintenance**: `"Check table constraints"`, `"Show foreign keys"`
- 📈 **Analytics**: `"Show table sizes"`, `"Query performance"`

## 💡 Example Commands You Can Use

### **Database Management:**
```
"Show me all tables in the database"
"Check if role_requirements table exists"
"Count how many roles are missing requirements"
"Show me the foreign key constraints"
```

### **Blob Storage:**
```
"List all blob containers"
"Show files in the resumes container"
"Check blob storage usage"
"Upload a test file to storage"
```

### **Service Bus:**
```
"Check service bus queue status"
"Show message count in file-processing queue"
"Send a test message to the queue"
```

### **System Health:**
```
"Check Azure SQL Database connection"
"Show blob storage account status"
"Monitor service bus health"
"Get Azure resource usage"
```

## 🔧 Advanced Configuration

### **For Production (Recommended):**
Use Azure Managed Identity instead of service principal:
```env
# Use DefaultAzureCredential (no secrets needed)
AZURE_USE_MANAGED_IDENTITY=true
```

### **For Development:**
Use Azure CLI authentication:
```bash
# Login with Azure CLI
az login

# MCP servers will automatically use your Azure CLI credentials
```

## 🎯 Benefits for Your HR-AI Project

1. **Database Debugging**: Instantly check table structure, constraints, data
2. **File Management**: Monitor blob storage, check upload status
3. **Queue Monitoring**: Track evaluation jobs, processing status
4. **Health Checks**: Real-time monitoring of all Azure services
5. **Natural Language**: No need to remember complex SQL or Azure CLI commands

## 🚀 Getting Started

1. **Set up authentication** (Azure CLI login or service principal)
2. **Configure environment variables** in `.env.local`
3. **Restart Claude Code** to load the new MCP servers
4. **Try commands** like: `"Show me all tables in my database"`

The Azure MCP servers will give you **unprecedented control** over your Azure backend through natural language commands!