# Deployment Guide - Free Public Hosting

## Option 1: Render.com (Recommended - Easiest)

### Steps:
1. **Create a GitHub account** (if you don't have one): https://github.com
2. **Push your code to GitHub**:
   ```bash
   # Initialize git repository
   git init
   git add .
   git commit -m "Initial commit"
   
   # Create a new repository on GitHub, then:
   git remote add origin https://github.com/yourusername/community-network.git
   git branch -M main
   git push -u origin main
   ```

3. **Deploy on Render**:
   - Go to https://render.com
   - Sign up with your GitHub account
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: community-network (or your choice)
     - **Environment**: Python 3
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `gunicorn app:app`
   - Click "Create Web Service"
   - Wait 5-10 minutes for deployment
   - Your app will be live at: `https://your-app-name.onrender.com`

**Free Tier**: 750 hours/month (always free), spins down after 15 mins of inactivity

---

## Option 2: Railway.app

### Steps:
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway auto-detects Flask and deploys
6. Your app will be live at: `https://your-app.up.railway.app`

**Free Tier**: $5 free credit per month

---

## Option 3: PythonAnywhere

### Steps:
1. Go to https://www.pythonanywhere.com
2. Sign up for free account
3. Upload your files via Files tab
4. In the Web tab:
   - Add new web app
   - Select Flask
   - Choose Python version
   - Point to your app.py
5. Your app will be live at: `https://yourusername.pythonanywhere.com`

**Free Tier**: Always free for personal use

---

## Option 4: Vercel (Alternative)

### Steps:
1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Create `vercel.json`:
   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "app.py",
         "use": "@vercel/python"
       }
     ],
     "routes": [
       {
         "src": "/(.*)",
         "dest": "app.py"
       }
     ]
   }
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

---

## Option 5: Fly.io

### Steps:
1. Install Fly CLI: https://fly.io/docs/getting-started/installing-flyctl/
2. Login: `flyctl auth login`
3. Create `fly.toml` (they'll generate it)
4. Deploy: `flyctl deploy`

---

## Quick Deploy Script

Run this in your terminal from the project directory:

```bash
# Make the deployment script executable
chmod +x deploy_to_render.sh

# Run it
./deploy_to_render.sh
```

---

## What's Been Added for Deployment

✅ **gunicorn** - Production WSGI server  
✅ **Procfile** - Tells Render/Railway how to run your app  
✅ **runtime.txt** - Specifies Python version  
✅ **Updated app.py** - Added `host='0.0.0.0'` for public access  

---

## Troubleshooting

### If you see "Application error":
1. Check Render/Railway logs in the dashboard
2. Make sure `requirements.txt` includes `gunicorn`
3. Verify `Procfile` points to correct module: `app:app`

### If map doesn't load:
- Check that Folium is importing correctly
- Verify static files are being served

### If it works locally but not deployed:
- Make sure port is configured: `host='0.0.0.0'`
- Check that WSGI server (gunicorn) is being used

---

## Recommended Choice

**For simplest deployment**: Use **Render.com**
- Free tier available
- Easy GitHub integration
- Automatic deployments
- No credit card required



