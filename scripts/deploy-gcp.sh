#!/bin/bash
# ============================================
# Intellibooks Studio - GCP Deployment Script
# ============================================

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-your-project-id}"
REGION="${GCP_REGION:-us-central1}"
REPO_NAME="intellibooks"

echo ""
echo "========================================"
echo "   Intellibooks Studio - GCP Deploy"
echo "========================================"
echo ""
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "[ERROR] gcloud CLI not installed. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "[1/6] Enabling GCP APIs..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com

# Create Artifact Registry repository
echo ""
echo "[2/6] Creating Artifact Registry..."
gcloud artifacts repositories create $REPO_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Intellibooks Studio containers" \
    2>/dev/null || echo "Repository already exists"

# Configure Docker auth
echo ""
echo "[3/6] Configuring Docker authentication..."
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# Build and push images
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}"

echo ""
echo "[4/6] Building and pushing Docker images..."

# RAG Service
echo "  Building rag-service..."
cd "$(dirname "$0")/../services/rag"
docker build -t ${REGISTRY}/rag-service:latest .
docker push ${REGISTRY}/rag-service:latest

# MCP Gateway
echo "  Building mcp-gateway..."
cd "../mcp-gateway"
docker build -t ${REGISTRY}/mcp-gateway:latest .
docker push ${REGISTRY}/mcp-gateway:latest

# Context Aggregator
echo "  Building context-aggregator..."
cd "../context-aggregator"
docker build -t ${REGISTRY}/context-aggregator:latest .
docker push ${REGISTRY}/context-aggregator:latest

# Agent Factory
echo "  Building agent-factory..."
cd "../agent-factory"
docker build -t ${REGISTRY}/agent-factory:latest .
docker push ${REGISTRY}/agent-factory:latest

# UI
echo "  Building ui..."
cd "../../apps/ui"
docker build -t ${REGISTRY}/ui:latest .
docker push ${REGISTRY}/ui:latest

# Deploy to Cloud Run
echo ""
echo "[5/6] Deploying to Cloud Run..."

# Deploy RAG Service
echo "  Deploying rag-service..."
gcloud run deploy rag-service \
    --image ${REGISTRY}/rag-service:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "PYTHONPATH=/app"

# Deploy MCP Gateway
echo "  Deploying mcp-gateway..."
gcloud run deploy mcp-gateway \
    --image ${REGISTRY}/mcp-gateway:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 1Gi \
    --cpu 1

# Deploy UI
echo "  Deploying ui..."
gcloud run deploy ui \
    --image ${REGISTRY}/ui:latest \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 512Mi \
    --cpu 1

echo ""
echo "[6/6] Getting service URLs..."
echo ""
echo "========================================"
echo "   Deployment Complete!"
echo "========================================"
echo ""
gcloud run services list --platform managed --region $REGION
echo ""
echo "Next steps:"
echo "1. Set up Cloud SQL for PostgreSQL"
echo "2. Set up Memorystore for Redis"
echo "3. Configure secrets in Secret Manager"
echo "4. Update environment variables in Cloud Run"
echo ""
