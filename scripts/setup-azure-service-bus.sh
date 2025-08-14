#!/bin/bash

# Azure Service Bus Setup Script for HR AI SaaS
# This script creates and configures Azure Service Bus for async evaluation processing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Azure Service Bus Setup for HR AI SaaS${NC}"
echo "======================================="

# Configuration
RESOURCE_GROUP="hr-ai-saas-rg"
SERVICE_BUS_NAMESPACE="hr-ai-saas-sb-$(date +%s)"
QUEUE_NAME="evaluation-queue"
LOCATION="centralindia"
SKU="Basic"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}❌ Azure CLI is not installed. Please install it first.${NC}"
    echo "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in to Azure
echo -e "${YELLOW}📋 Checking Azure login status...${NC}"
if ! az account show &> /dev/null; then
    echo -e "${YELLOW}Please login to Azure:${NC}"
    az login
fi

# Display current subscription
SUBSCRIPTION=$(az account show --query "name" -o tsv)
echo -e "${GREEN}✅ Using subscription: $SUBSCRIPTION${NC}"

# Check if resource group exists
echo -e "${YELLOW}📋 Checking resource group...${NC}"
if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo -e "${YELLOW}Creating resource group: $RESOURCE_GROUP${NC}"
    az group create --name $RESOURCE_GROUP --location $LOCATION
else
    echo -e "${GREEN}✅ Resource group exists: $RESOURCE_GROUP${NC}"
fi

# Create Service Bus namespace
echo -e "${YELLOW}📋 Creating Service Bus namespace...${NC}"
echo "Namespace: $SERVICE_BUS_NAMESPACE"

az servicebus namespace create \
    --name $SERVICE_BUS_NAMESPACE \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku $SKU \
    --output table

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Service Bus namespace created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create Service Bus namespace${NC}"
    exit 1
fi

# Create the evaluation queue
echo -e "${YELLOW}📋 Creating evaluation queue...${NC}"

az servicebus queue create \
    --name $QUEUE_NAME \
    --namespace-name $SERVICE_BUS_NAMESPACE \
    --resource-group $RESOURCE_GROUP \
    --max-size 1024 \
    --default-message-time-to-live "PT1H" \
    --max-delivery-count 3 \
    --output table

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Queue created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create queue${NC}"
    exit 1
fi

# Get connection string
echo -e "${YELLOW}📋 Retrieving connection string...${NC}"

CONNECTION_STRING=$(az servicebus namespace authorization-rule keys list \
    --name RootManageSharedAccessKey \
    --namespace-name $SERVICE_BUS_NAMESPACE \
    --resource-group $RESOURCE_GROUP \
    --query "primaryConnectionString" \
    --output tsv)

# Generate internal API key
INTERNAL_API_KEY=$(openssl rand -base64 32)

# Save to .env.local file
echo -e "${YELLOW}📋 Saving configuration to .env.local...${NC}"

cat >> .env.local << EOF

# Azure Service Bus Configuration (Generated $(date))
AZURE_SERVICE_BUS_CONNECTION_STRING="$CONNECTION_STRING"
AZURE_SERVICE_BUS_NAMESPACE="$SERVICE_BUS_NAMESPACE"
AZURE_SERVICE_BUS_QUEUE_NAME="$QUEUE_NAME"

# Internal API Key for Azure Functions
INTERNAL_API_KEY="$INTERNAL_API_KEY"

# Vercel App URL (Update this with your actual Vercel URL)
VERCEL_APP_URL="https://hr-ai-personnal.vercel.app"

# SMTP Configuration (Optional - for email notifications)
# SMTP_HOST="smtp.gmail.com"
# SMTP_PORT="587"
# SMTP_SECURE="false"
# SMTP_USER="your-email@gmail.com"
# SMTP_PASS="your-app-password"
# SMTP_FROM="HR AI SaaS <noreply@hr-ai-saas.com>"
EOF

echo -e "${GREEN}✅ Configuration saved to .env.local${NC}"

# Display summary
echo ""
echo -e "${GREEN}🎉 Azure Service Bus Setup Complete!${NC}"
echo "======================================="
echo -e "${YELLOW}Service Bus Namespace:${NC} $SERVICE_BUS_NAMESPACE"
echo -e "${YELLOW}Queue Name:${NC} $QUEUE_NAME"
echo -e "${YELLOW}Resource Group:${NC} $RESOURCE_GROUP"
echo -e "${YELLOW}Location:${NC} $LOCATION"
echo ""
echo -e "${GREEN}📋 Next Steps:${NC}"
echo "1. Review the generated .env.local file"
echo "2. Update VERCEL_APP_URL with your actual Vercel URL"
echo "3. Configure SMTP settings if you want email notifications"
echo "4. Deploy the Azure Functions (run: npm run deploy:functions)"
echo "5. Add the environment variables to Vercel dashboard"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "- Keep the INTERNAL_API_KEY secret and secure"
echo "- The connection string contains sensitive information"
echo "- Add these variables to Vercel environment settings"
echo ""
echo -e "${GREEN}✅ Service Bus is ready for evaluation processing!${NC}"