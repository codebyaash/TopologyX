# 🚀 TopologyX Deployment Checklist

## Pre-Deployment ✅

- [ ] Code is pushed to GitHub (Render requires this)
- [ ] You have accounts on:
  - [ ] Render (https://render.com) - Backend + Database
  - [ ] Vercel (https://vercel.app) - Frontend

## Database Setup 🗄️

- [ ] Created PostgreSQL database on Render (or alternative)
- [ ] Copied database connection string (DATABASE_URL)
- [ ] Generated SESSION_SECRET (see below)

### Generate SESSION_SECRET

Run this in your terminal:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Save the output - you'll need it for both environments.

---

## Backend Deployment (Render) 🔧

### Step 1: Create Web Service on Render
- [ ] Go to https://render.com
- [ ] Click "New +" → "Web Service"
- [ ] Connect GitHub repository
- [ ] Fill in settings:
  - **Name**: `topologyx-api`
  - **Root Directory**: `apps/api`
  - **Branch**: `main`
  - **Build Command**: 
    ```
    pip install -r requirements.txt && alembic upgrade head
    ```
  - **Start Command**: 
    ```
    uvicorn app.main:app --host 0.0.0.0 --port $PORT
    ```

### Step 2: Add Environment Variables on Render
- [ ] Click "Advanced"
- [ ] Add variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` |
| `SESSION_SECRET` | Your generated secret (32+ chars) |
| `SESSION_COOKIE_SECURE` | `true` |
| `SESSION_COOKIE_SAMESITE` | `lax` |
| `CORS_ORIGINS` | `https://topologyx.vercel.app` |
| `AUTO_CREATE_TABLES` | `false` |

- [ ] Click "Create Web Service"
- [ ] Wait for deployment (5-10 minutes)
- [ ] Copy your API URL (e.g., `https://topologyx-api.onrender.com`)
- [ ] Test: `curl https://your-api-url/health`

---

## Frontend Deployment (Vercel) 🌐

### Step 1: Import Project on Vercel
- [ ] Go to https://vercel.com
- [ ] Click "Add New..." → "Project"
- [ ] Import TopologyX GitHub repository
- [ ] Framework Preset: **Next.js**
- [ ] Root Directory: **apps/web**

### Step 2: Add Environment Variable
- [ ] Add variable:
  ```
  NEXT_PUBLIC_API_URL=https://your-api-url.onrender.com
  ```
  (Replace with your actual Render API URL)

- [ ] Click "Deploy"
- [ ] Wait for deployment (2-3 minutes)
- [ ] Copy your frontend URL (e.g., `https://topologyx.vercel.app`)

---

## Post-Deployment Verification ✨

### Test Backend
- [ ] Endpoint is reachable:
  ```bash
  curl https://your-api-url/health
  # Should respond: {"status":"ok"}
  ```

### Test Frontend
- [ ] Visit https://your-frontend-url
- [ ] Verify TopologyX header appears (top-left)
- [ ] No "Set NEXT_PUBLIC_API_URL" warning in Projects tab
- [ ] Login section is visible

### Test Authentication & Projects
- [ ] Create account with email/password
- [ ] Create a project
- [ ] Generate an architecture
- [ ] Verify it saves to the database

---

## Troubleshooting 🔍

### "CORS error when accessing API"
```
Solution: Check CORS_ORIGINS on Render matches your Vercel URL
- Must be: https://your-vercel-domain.vercel.app
- Must include https:// protocol
- Cannot have trailing slash
```

### "Database connection failed"
```
Solution: Verify DATABASE_URL
- Test connection locally: psql <DATABASE_URL>
- Check PostgreSQL is running
- Verify credentials are correct
```

### "NEXT_PUBLIC_API_URL not set" warning appears
```
Solution: 
1. Check Vercel environment variables
2. Ensure NEXT_PUBLIC_API_URL is set (not NEXT_PUBLIC_API_URL)
3. Redeploy after adding variable
4. Wait 1-2 minutes for build to complete
```

### "Login fails but API is healthy"
```
Solution: Run database migrations
- Via Render Shell: alembic upgrade head
- Or check: is AUTO_CREATE_TABLES=false?
```

---

## Environment Variables Reference 📋

### Backend (`apps/api`)
```bash
# Database connection
DATABASE_URL=postgresql://user:password@host:port/database

# Security (REQUIRED)
SESSION_SECRET=your-random-32-char-secret

# Cookie Security
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax

# CORS
CORS_ORIGINS=https://topologyx.vercel.app

# Database
AUTO_CREATE_TABLES=false
```

### Frontend (`apps/web`)
```bash
# API endpoint
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
```

---

## Support

If you get stuck:
1. Check logs on Render dashboard (Web Service → Logs)
2. Check logs on Vercel dashboard (Deployments → Logs)
3. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guide
4. Check backend health: `curl https://your-api-url/health`

---

## 🎉 Success Criteria

You'll know everything is working when:
- ✅ TopologyX logo appears in top-left
- ✅ Projects page shows login section (no setup warning)
- ✅ Can create account
- ✅ Can create and save projects
- ✅ Can generate architectures and they persist
