# 🧹 Azure Resource Cleanup Plan

## 📊 **CURRENT RESOURCE DUPLICATION ANALYSIS**

### **🔴 DUPLICATED RESOURCES (Need Cleanup)**

#### **Service Bus Namespaces** (2 instances)
- ❌ **OLD**: `hr-ai-saas-sb-1755065875` (Central India)
- ✅ **NEW**: `hr-ai-saas-sb-swissnorth` (Switzerland North)

#### **Storage Accounts** (3 instances!)
- ✅ **MAIN**: `hraisaas1754119004` (Switzerland North) - *Original main storage*
- ❌ **OLD**: `hraievalstore66895` (Central India) - *Old evaluation storage*
- ❓ **NEW**: `hraievalstoreswiss` (Switzerland North) - *Duplicate we just created*

#### **Function Apps** (2 instances)
- ❌ **OLD**: `hr-ai-eval-processor` (Central India)
- ✅ **NEW**: `hr-ai-eval-processor-swiss` (Switzerland North)

#### **App Service Plans** (4 instances!)
- ✅ **MAIN**: `SwitzerlandNorthPlan` (Switzerland North) - *Original*
- ✅ **WEBAPP**: `hr-ai-webapp-plan` (Switzerland North) - *For web app*
- ❌ **OLD**: `CentralIndiaPlan` (Central India) - *Old India plan*
- ❓ **AUTO**: `SwitzerlandNorthLinuxDynamicPlan` (Switzerland North) - *Auto-created for Functions*

#### **Log Analytics Workspaces** (2 instances)
- `DefaultWorkspace-CID` (Central India)
- `DefaultWorkspace-CHN` (Switzerland North)

---

## 🎯 **RECOMMENDED CLEANUP STRATEGY**

### **Phase 1: Consolidate Storage Accounts**
We have **3 storage accounts** but only need **1**!

**DECISION**: Keep `hraisaas1754119004` (original) and delete the duplicates

```bash
# Check what's in each storage account first
az storage container list --account-name hraisaas1754119004
az storage container list --account-name hraievalstore66895  
az storage container list --account-name hraievalstoreswiss
```

### **Phase 2: Update Application to Use Single Storage**
Update your application to use **only** `hraisaas1754119004` for everything:
- Resume uploads
- File processing
- Evaluation storage

### **Phase 3: Clean Up Duplicates**

#### **Delete Old Central India Resources:**
```bash
# 1. Delete old Service Bus
az servicebus namespace delete --name hr-ai-saas-sb-1755065875 --resource-group hr-ai-saas-rg --yes

# 2. Delete old Function App
az functionapp delete --name hr-ai-eval-processor --resource-group hr-ai-saas-rg

# 3. Delete old Storage Account (after data migration)
az storage account delete --name hraievalstore66895 --resource-group hr-ai-saas-rg --yes

# 4. Delete old App Service Plan
az appservice plan delete --name CentralIndiaPlan --resource-group hr-ai-saas-rg --yes
```

#### **Delete Duplicate Switzerland North Resources:**
```bash
# Delete the duplicate storage we just created
az storage account delete --name hraievalstoreswiss --resource-group hr-ai-saas-rg --yes
```

---

## ✅ **FINAL CLEAN ARCHITECTURE**

### **Switzerland North Resources (Keep These):**
- **SQL Server**: `hr-ai-saas-server` + database
- **Storage Account**: `hraisaas1754119004` (single storage for everything)
- **Service Bus**: `hr-ai-saas-sb-swissnorth` (new, with queues)
- **Function App**: `hr-ai-eval-processor-swiss` (new)
- **Web App**: `hr-ai-saas-webapp` 
- **Key Vault**: `hr-ai-saas-kv`
- **App Config**: `hr-ai-saas-config`
- **Managed Identity**: `hr-ai-saas-identity`
- **App Service Plans**: Keep both (`SwitzerlandNorthPlan` + `hr-ai-webapp-plan`)

### **Resources to Delete:**
- ❌ `hr-ai-saas-sb-1755065875` (Central India Service Bus)
- ❌ `hraievalstore66895` (Central India Storage)  
- ❌ `hraievalstoreswiss` (Duplicate Switzerland Storage)
- ❌ `hr-ai-eval-processor` (Central India Function)
- ❌ `CentralIndiaPlan` (Central India App Service Plan)

---

## 🔧 **CORRECTED CONNECTION STRINGS**

### **Use Original Storage Account:**
```env
# Main storage (keep this one)
AZURE_STORAGE_ACCOUNT_NAME=hraisaas1754119004
AZURE_STORAGE_CONNECTION_STRING=[Get from existing storage]

# Service Bus (new Switzerland North)
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://hr-ai-saas-sb-swissnorth.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=***
```

## ⚠️ **CRITICAL NEXT STEPS:**

1. **STOP** - Don't delete anything yet
2. **Check** what data exists in each storage account
3. **Migrate** any important data to the main storage account
4. **Update** application configuration to use single storage
5. **Test** thoroughly
6. **Then** delete duplicates

Would you like me to proceed with this cleanup plan?