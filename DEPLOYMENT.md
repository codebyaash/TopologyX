# TopologyX Deployment Guide

## 🚀 Quick Deployment Steps

### Phase 1: Backend API (Render)

#### Step 1: Create PostgreSQL Database
1. Go to https://render.com
2. Create account / sign in
3. Create new PostgreSQL database:
   - Name: `topologyx-db`
   - Region: Choose closest to you
   - Copy the connection string (Internal Database URL)

#### Step 2: Deploy Backend API to Render
1. Push your code to GitHub (required for Render)
2. Go to Render Dashboard → New → Web Service
3. Connect your GitHub repository
4. Settings:
   - **Name**: `topologyx-api`
   - **Root Directory**: `apps/api`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt && alembic upgrade head`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free or Starter
5. Click "Advanced" and add environment variables:

```
DATABASE_URL=postgresql://user:password@host/database
SESSION_SECRET=<generate-random-secret-below>
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=lax
CORS_ORIGINS=https://topologyx.vercel.app
AUTO_CREATE_TABLES=false
```

**Generate random SESSION_SECRET** (run in terminal):
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

6. Click "Create Web Service"
7. Wait for deployment (5-10 minutes)
8. Copy the deployed URL (e.g., `https://topologyx-api.onrender.com`)

---

### Phase 2: Frontend (Vercel)

1. Go to https://vercel.com
2. Sign in with GitHub
3. Import TopologyX repository
4. Settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
5. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://topologyx-api.onrender.com
   ```
6. Click "Deploy"
7. Wait for deployment (2-3 minutes)

---

## ✅ Verification Steps

1. **Test Backend Health**:
   ```bash
   curl https://topologyx-api.onrender.com/health
   # Should return: {"status":"ok"}
   ```

2. **Test Frontend**:
   - Visit your Vercel URL (e.g., `https://topologyx.vercel.app`)
   - You should see TopologyX header
   - Navigate to Projects tab
   - Login section should NOT show the "Set NEXT_PUBLIC_API_URL" warning

3. **Test Sign Up**:
   - Create a test account
   - Create a project
   - Generate an architecture

---

## 🔧 Database Migrations

After first deployment, run migrations:

```bash
# Via Render dashboard:
# 1. Go to your Web Service
# 2. Click "Shell" tab
# 3. Run: alembic upgrade head
```

Or add to Build Command:
```
pip install -r requirements.txt && alembic upgrade head
```

---

## 📋 Environment Variables Summary

### Backend (`apps/api`)
| Variable | Production Value | Notes |
|----------|------------------|-------|
| `DATABASE_URL` | PostgreSQL URL | From Render DB |
| `SESSION_SECRET` | Random 32+ chars | Generate with: `secrets.token_urlsafe(32)` |
| `SESSION_COOKIE_SECURE` | `true` | HTTPS only |
| `SESSION_COOKIE_SAMESITE` | `lax` | CSRF protection |
| `CORS_ORIGINS` | Your Vercel URL | `https://topologyx.vercel.app` |
| `AUTO_CREATE_TABLES` | `false` | Use migrations instead |

### Frontend (`apps/web`)
| Variable | Production Value |
|----------|------------------|
| `NEXT_PUBLIC_API_URL` | Your Render API URL |

---

## 🆘 Troubleshooting

### "NEXT_PUBLIC_API_URL is not set" error
- Check Vercel environment variables
- Redeploy after adding variable

### "Database connection failed"
- Verify `DATABASE_URL` is correct on Render
- Check PostgreSQL credentials
- Ensure firewall allows connections

### "CORS error when signing up"
- Update `CORS_ORIGINS` to match your frontend URL
- Must include `https://` protocol

### "Login works but projects don't load"
- Run database migrations: `alembic upgrade head`
- Check that PostgreSQL is running

---

## 📱 Next Steps

1. ✅ Create PostgreSQL database
2. ✅ Deploy backend to Render
3. ✅ Deploy frontend to Vercel
4. ✅ Test authentication
5. ✅ Create first project
6. 🔄 Monitor logs for issues
