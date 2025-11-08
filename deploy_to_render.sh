#!/bin/bash

# Deployment script for Render.com
# This script helps you prepare your app for deployment

echo "🚀 Community Network Deployment Helper"
echo "======================================"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for deployment"
    echo "✅ Git repository initialized!"
    echo ""
else
    echo "✅ Git repository already exists"
    echo ""
fi

# Check if remote is set
if ! git remote | grep -q origin; then
    echo "📝 You need to connect to GitHub:"
    echo ""
    echo "1. Create a new repository on https://github.com"
    echo "2. Then run these commands:"
    echo ""
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    echo "3. Then go to https://render.com"
    echo "4. Click 'New +' → 'Web Service'"
    echo "5. Connect your GitHub account"
    echo "6. Select your repository"
    echo "7. Configure:"
    echo "   - Build Command: pip install -r requirements.txt"
    echo "   - Start Command: gunicorn app:app"
    echo "8. Click 'Create Web Service'"
    echo ""
else
    echo "✅ GitHub remote configured"
    echo ""
    echo "📤 Pushing to GitHub..."
    git push origin main
    echo ""
    echo "✅ Code pushed! Now deploy on Render:"
    echo "   1. Go to https://render.com"
    echo "   2. Click 'New +' → 'Web Service'"
    echo "   3. Select your repository"
    echo "   4. Use these settings:"
    echo "      - Build Command: pip install -r requirements.txt"
    echo "      - Start Command: gunicorn app:app"
    echo ""
fi

echo "✨ Your app will be live in about 5-10 minutes!"
echo "🔗 Check DEPLOYMENT.md for detailed instructions"



