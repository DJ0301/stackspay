# Vercel Deployment Guide for StacksPay Frontend

This guide will help you deploy the StacksPay frontend to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. Your backend API deployed and accessible via HTTPS
3. Git repository with your code

## Deployment Steps

### 1. Environment Variables Setup

Before deploying, you need to set up environment variables in Vercel:

1. Go to your Vercel dashboard
2. Navigate to your project settings
3. Go to "Environment Variables" section
4. Add the following variables:

```
VITE_API_URL=https://your-backend-api-url.com
```

Replace `https://your-backend-api-url.com` with your actual backend URL.

### 2. Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Deploy to Vercel
vercel

# Follow the prompts:
# - Set up and deploy? Y
# - Which scope? (select your account)
# - Link to existing project? N
# - Project name: stackspay-frontend (or your preferred name)
# - Directory: ./ (current directory)
```

### 3. Deploy via Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Set the following build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables in the deployment settings
6. Click "Deploy"

### 4. Custom Domain (Optional)

1. In your Vercel project dashboard, go to "Settings" → "Domains"
2. Add your custom domain
3. Follow Vercel's instructions to configure DNS

## Configuration Files

The following files have been created for your deployment:

- `vercel.json` - Vercel configuration with routing rules
- `.vercelignore` - Files to ignore during deployment
- `.env.example` - Example environment variables
- `vite.config.js` - Updated with production optimizations

## Important Notes

1. **API Proxy**: The `vercel.json` includes API proxy rules. Update the backend URL in the routes section.

2. **Environment Variables**: All environment variables for Vite must be prefixed with `VITE_`.

3. **SPA Routing**: The configuration includes catch-all routing for React Router.

4. **Build Optimization**: The Vite config includes code splitting for better performance.

## Troubleshooting

### Build Fails
- Check that all dependencies are listed in `package.json`
- Ensure environment variables are set correctly
- Check build logs for specific errors

### API Calls Fail
- Verify `VITE_API_URL` environment variable is set
- Ensure backend is deployed and accessible
- Check CORS settings on your backend

### Routing Issues
- Verify the catch-all route in `vercel.json`
- Check that your React Router is configured correctly

## Post-Deployment

After successful deployment:

1. Test all functionality on the live site
2. Update any hardcoded localhost URLs in your code
3. Configure your backend CORS to allow your Vercel domain
4. Set up monitoring and analytics if needed

Your StacksPay frontend should now be live on Vercel! 🚀
