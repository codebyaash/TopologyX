#!/bin/bash

# TopologyX Deployment Setup Script
# This script helps you configure the environment for production deployment

set -e

echo "🚀 TopologyX Deployment Setup"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_section() {
    echo -e "${BLUE}→ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check prerequisites
print_section "Checking prerequisites..."

if ! command -v git &> /dev/null; then
    print_error "Git is not installed"
    exit 1
fi
print_success "Git found"

if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed"
    exit 1
fi
print_success "Python 3 found"

echo ""
print_section "Step 1: Push to GitHub"
echo "Render requires your code to be on GitHub."
echo "1. Create a GitHub repository (if not already done)"
echo "2. Push your code: git push origin main"
echo ""
read -p "Have you pushed to GitHub? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please push to GitHub first"
    exit 1
fi
print_success "GitHub setup confirmed"

echo ""
print_section "Step 2: Generate SESSION_SECRET"
SESSION_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
echo "Generated SESSION_SECRET (save this):"
echo -e "${GREEN}$SESSION_SECRET${NC}"
echo ""

echo ""
print_section "Step 3: Create PostgreSQL Database"
echo "Options:"
echo "  1. Use Render (recommended) - go to https://render.com"
echo "  2. Use Railway - go to https://railway.app"
echo "  3. Use AWS RDS"
echo "  4. Use local PostgreSQL"
echo ""
read -p "Which option? (1-4) " db_choice

case $db_choice in
    1)
        echo "📝 Render Setup Instructions:"
        echo "  1. Go to https://render.com"
        echo "  2. Create account / sign in"
        echo "  3. Go to Dashboard → New → PostgreSQL"
        echo "  4. Name: topologyx-db"
        echo "  5. Copy the 'Internal Database URL'"
        ;;
    2)
        echo "📝 Railway Setup Instructions:"
        echo "  1. Go to https://railway.app"
        echo "  2. Create account / sign in"
        echo "  3. Create new → PostgreSQL"
        echo "  4. Copy the connection string from Variables"
        ;;
    3)
        echo "📝 AWS RDS Setup Instructions:"
        echo "  1. Go to AWS Console → RDS"
        echo "  2. Create new PostgreSQL database"
        echo "  3. Copy the endpoint and credentials"
        ;;
    4)
        echo "Using local PostgreSQL (development only)"
        ;;
esac

echo ""
read -p "Enter DATABASE_URL: " database_url

if [ -z "$database_url" ]; then
    print_error "DATABASE_URL cannot be empty"
    exit 1
fi
print_success "DATABASE_URL set"

echo ""
print_section "Step 4: Update Configuration Files"

# Update API .env.production
cat > apps/api/.env.production << EOF
DATABASE_URL=$database_url
SESSION_SECRET=$SESSION_SECRET
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
CORS_ORIGINS=https://topologyx.vercel.app
AUTO_CREATE_TABLES=false
EOF
print_success "Updated apps/api/.env.production"

echo ""
print_section "Step 5: Deploy Backend"
echo "Instructions:"
echo "  1. Go to https://render.com"
echo "  2. Create account / sign in"
echo "  3. Click 'New +' → Web Service"
echo "  4. Connect your GitHub repository"
echo "  5. Settings:"
echo "     - Name: topologyx-api"
echo "     - Root Directory: apps/api"
echo "     - Build Command: pip install -r requirements.txt && alembic upgrade head"
echo "     - Start Command: uvicorn app.main:app --host 0.0.0.0 --port \$PORT"
echo "  6. Add environment variables (copy from below):"
echo ""
echo -e "${GREEN}DATABASE_URL=$database_url${NC}"
echo -e "${GREEN}SESSION_SECRET=$SESSION_SECRET${NC}"
echo "SESSION_COOKIE_SECURE=true"
echo "SESSION_COOKIE_SAMESITE=lax"
echo "CORS_ORIGINS=https://topologyx.vercel.app"
echo "AUTO_CREATE_TABLES=false"
echo ""
echo "  7. Click 'Create Web Service'"
echo "  8. Wait for deployment (5-10 minutes)"
echo ""
read -p "Enter your API URL (e.g., https://topologyx-api.onrender.com): " api_url

if [ -z "$api_url" ]; then
    print_error "API URL cannot be empty"
    exit 1
fi
print_success "API URL set"

echo ""
print_section "Step 6: Deploy Frontend"
echo "Instructions:"
echo "  1. Go to https://vercel.com"
echo "  2. Sign in with GitHub"
echo "  3. Click 'Import Project'"
echo "  4. Select your TopologyX repository"
echo "  5. Framework: Next.js"
echo "  6. Root Directory: apps/web"
echo "  7. Add environment variable:"
echo ""
echo -e "${GREEN}NEXT_PUBLIC_API_URL=$api_url${NC}"
echo ""
echo "  8. Click 'Deploy'"
echo ""
read -p "Enter your Frontend URL (e.g., https://topologyx.vercel.app): " frontend_url

if [ -z "$frontend_url" ]; then
    print_error "Frontend URL cannot be empty"
    exit 1
fi
print_success "Frontend URL set"

echo ""
print_section "Step 7: Verify Deployment"
echo ""
echo "Testing backend health..."
if curl -s "$api_url/health" > /dev/null; then
    print_success "Backend is reachable"
else
    print_error "Backend is not reachable. Please check your API URL."
fi

echo ""
echo "🎉 Deployment setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Visit $frontend_url"
echo "  2. Check that you see the TopologyX header"
echo "  3. Go to Projects tab - you should see the login section (not the setup warning)"
echo "  4. Create a test account"
echo "  5. Generate an architecture"
echo ""
echo "For issues, see DEPLOYMENT.md"
