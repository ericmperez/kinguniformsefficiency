# Production Email Configuration Instructions

## Environment Variables Setup

For production deployment on Vercel, you need to set the following environment variables:

### Required Environment Variables:
- `EMAIL_USER`: emperez@kinguniforms.net
- `EMAIL_PASSWORD`: jbqp sxah ctff glku

### Setting Environment Variables in Vercel:

1. **Via Vercel Dashboard:**
   - Go to your project in Vercel Dashboard
   - Navigate to Settings → Environment Variables
   - Add both variables with their values

2. **Via Vercel CLI:**
   ```bash
   vercel env add EMAIL_USER
   # Enter: emperez@kinguniforms.net
   
   vercel env add EMAIL_PASSWORD  
   # Enter: jbqp sxah ctff glku
   ```

### Important Security Notes:

1. **App Password Required**: The password `jbqp sxah ctff glku` is a Gmail App Password, required when 2FA is enabled
2. **Never Commit Credentials**: Remove hardcoded passwords from all files before committing
3. **Use Environment Variables**: Always use `process.env.EMAIL_*` in production code

## Files Updated:

- `vercel.json` - Temporarily includes credentials (REMOVE before commit)
- `server.js` - Updated to use consistent App Password
- `server.cjs` - Already uses correct App Password
- `api/send-invoice.js` - Uses environment variables correctly
- `api/send-test-email.js` - Uses environment variables correctly

## Production Deployment Steps:

1. Set environment variables in Vercel Dashboard
2. Remove hardcoded credentials from `vercel.json`
3. Deploy to production
4. Test email functionality

## Local Development:

Create a `.env` file in your project root:
```
EMAIL_USER=emperez@kinguniforms.net
EMAIL_PASSWORD=jbqp sxah ctff glku
```

Add `.env` to your `.gitignore` file to prevent committing credentials.
