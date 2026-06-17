# 🚀 Quick Start Deployment Guide

## 5 Minute Overview

### What You're Deploying
- **API** (FastAPI) → Render
- **Web** (Next.js) → Vercel  
- **Database** (PostgreSQL) → Render
- **Auth** (Sessions) → Requires backend

---

## Step 1: Prerequisites (2 min)

1. GitHub account (code must be on GitHub for Render)
2. Render account (https://render.com)
3. Vercel account (https://vercel.app)

```bash
# Generate your security secret (save this!)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 2: Database (2 min)

1. Open https://render.com
2. Dashboard → New → PostgreSQL
3. **Name**: `topologyx-db`
4. Create and copy the **Internal Database URL**
   - Format: `postgresql://user:password@host/database`

---

## Step 3: Deploy Backend (3 min)

1. https://render.com → New → Web Service
2. Connect GitHub repository
3. Settings:
   - **Name**: `topologyx-api`
   - **Root Directory**: `apps/api`
   - **Build**: `pip install -r requirements.txt && alembic upgrade head`
   - **Start**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

4. Click Advanced → Add environment:
   ```
   DATABASE_URL = [Your PostgreSQL URL from Step 2]
   SESSION_SECRET = [Your generated secret]
   SESSION_COOKIE_SECURE = true
   SESSION_COOKIE_SAMESITE = lax
   CORS_ORIGINS = https://topologyx.vercel.app
   AUTO_CREATE_TABLES = false
   ```

5. Create Web Service → Wait for green "Live" status
6. Copy your API URL: `https://topologyx-api-xxxxx.onrender.com`

---

## Step 4: Deploy Frontend (2 min)

1. https://vercel.com → Add New → Project
2. Import TopologyX from GitHub
3. Settings:
   - **Framework**: Next.js
   - **Root Directory**: `apps/web`
4. Environment variable:
   ```
   NEXT_PUBLIC_API_URL = [Your API URL from Step 3]
   ```
5. Deploy → Wait for completion
6. Copy frontend URL: `https://topologyx-xxxxx.vercel.app`

---

## Step 5: Verify (1 min)

**Test API:**
```bash
curl https://your-api-url/health
# Response: {"status":"ok"}
```

**Test Frontend:**
1. Visit https://your-frontend-url
2. See TopologyX header? ✓
3. Projects tab shows login (not "Set API URL" warning)? ✓
4. Create account & generate architecture? ✓

---

## Done! 🎉

Your TopologyX is now live with:
- ✅ Full authentication
- ✅ Project persistence
- ✅ Architecture history
- ✅ All features working

---

## Stuck?

1. **"Set NEXT_PUBLIC_API_URL" warning**: Redeploy Vercel (env var needs rebuild)
2. **CORS error**: Check CORS_ORIGINS has `https://` and matches Vercel URL
3. **Login fails**: Run `alembic upgrade head` in Render Shell
4. **API not responding**: Check backend logs on Render dashboard

See **DEPLOYMENT_CHECKLIST.md** for full troubleshooting
