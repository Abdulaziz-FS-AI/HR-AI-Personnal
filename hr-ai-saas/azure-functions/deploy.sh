#!/bin/bash

# Azure Functions Deployment Script
# Deploy evaluation queue processor function

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Azure Functions Deployment${NC}"
echo "======================================="

# Configuration
RESOURCE_GROUP="hr-ai-saas-rg"
FUNCTION_APP_NAME="hr-ai-eval-processor"
STORAGE_ACCOUNT="hraievalstore$(date +%s | cut -c 6-10)"
LOCATION="centralindia"
RUNTIME="node"
RUNTIME_VERSION="20"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Azure Functions Core Tools is installed
if ! command -v func &> /dev/null; then
    echo -e "${RED}❌ Azure Functions Core Tools is not installed.${NC}"
    echo "Install with: npm install -g azure-functions-core-tools@4"
    exit 1
fi

# Load environment variables
if [ -f "../.env.local" ]; then
    echo -e "${GREEN}✅ Loading environment variables from .env.local${NC}"
    export $(cat ../.env.local | grep -v '^#' | xargs)
else
    echo -e "${RED}❌ .env.local file not found. Run setup-azure-service-bus.sh first.${NC}"
    exit 1
fi

# Build the functions
echo -e "${YELLOW}📋 Building Azure Functions...${NC}"
npm install
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Create storage account for functions
echo -e "${YELLOW}📋 Creating storage account...${NC}"
az storage account create \
    --name $STORAGE_ACCOUNT \
    --location $LOCATION \
    --resource-group $RESOURCE_GROUP \
    --sku Standard_LRS \
    --output table

# Create Function App
echo -e "${YELLOW}📋 Creating Function App...${NC}"
az functionapp create \
    --name $FUNCTION_APP_NAME \
    --storage-account $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --consumption-plan-location $LOCATION \
    --runtime $RUNTIME \
    --runtime-version $RUNTIME_VERSION \
    --functions-version 4 \
    --output table

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Function App created${NC}"
else
    echo -e "${RED}❌ Failed to create Function App${NC}"
    exit 1
fi

# Configure app settings
echo -e "${YELLOW}📋 Configuring Function App settings...${NC}"

az functionapp config appsettings set \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --settings \
    "AZURE_SERVICE_BUS_CONNECTION_STRING=$AZURE_SERVICE_BUS_CONNECTION_STRING" \
    "AZURE_STORAGE_CONNECTION_STRING=$AZURE_STORAGE_CONNECTION_STRING" \
    "DB_SERVER=$DB_SERVER" \
    "DB_DATABASE=$DB_DATABASE" \
    "DB_USERNAME=$DB_USERNAME" \
    "DB_PASSWORD=$DB_PASSWORD" \
    "HYPERBOLIC_API_KEY=$HYPERBOLIC_API_KEY" \
    "INTERNAL_API_KEY=$INTERNAL_API_KEY" \
    "VERCEL_APP_URL=$VERCEL_APP_URL" \
    --output table

echo -e "${GREEN}✅ Settings configured${NC}"

# Deploy the functions
echo -e "${YELLOW}📋 Deploying functions to Azure...${NC}"
func azure functionapp publish $FUNCTION_APP_NAME --typescript

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Functions deployed successfully${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Display summary
echo ""
echo -e "${GREEN}🎉 Azure Functions Deployment Complete!${NC}"
echo "======================================="
echo -e "${YELLOW}Function App:${NC} $FUNCTION_APP_NAME"
echo -e "${YELLOW}Resource Group:${NC} $RESOURCE_GROUP"
echo -e "${YELLOW}Runtime:${NC} Node.js $RUNTIME_VERSION"
echo ""
echo -e "${GREEN}📋 Function Endpoints:${NC}"
echo "- evaluationQueueProcessor (Service Bus triggered)"
echo ""
echo -e "${GREEN}🔧 Management:${NC}"
echo "View logs: az functionapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP"
echo "View metrics: https://portal.azure.com"
echo ""
echo -e "${GREEN}✅ Your bulk processing system is ready!${NC}"