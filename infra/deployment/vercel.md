# Vercel Deployment Guide

Deploy the web app from `apps/web` to Vercel.

## Quick Setup

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Import Project" and select your TopologyX repository
4. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Install Command**: `npm install`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-url.onrender.com
   ```

6. Click "Deploy"

## Environment Variables

The app includes a fallback architecture engine, so it works without an API. However, projects and authentication require:

```
NEXT_PUBLIC_API_URL=https://your-api-host.example.com
```

Replace with your actual deployed backend URL from Render.

## Post-Deployment

- Verify the app loads at your Vercel URL
- Check that the "Workspace Access" section appears (not the "Set NEXT_PUBLIC_API_URL" warning)
- Test creating an architecture to ensure API connection works

