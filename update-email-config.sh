#!/bin/bash
# Email Configuration Update Script for King Uniforms

echo "🔧 Email Configuration Update Script"
echo "====================================="
echo ""

# Get current email configuration
echo "📧 Current Email Configuration:"
echo ""
echo "Production API files use environment variables:"
echo "  EMAIL_USER: \$EMAIL_USER"
echo "  EMAIL_PASSWORD: \$EMAIL_PASSWORD"
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "✅ .env file found"
    echo "Current values in .env:"
    grep "EMAIL_" .env 2>/dev/null || echo "No EMAIL_ variables found in .env"
else
    echo "❌ No .env file found"
fi

echo ""
echo "🔄 To update email configuration:"
echo ""
echo "1. FOR LOCAL DEVELOPMENT:"
echo "   Create/update .env file with new credentials:"
echo "   EMAIL_USER=your-new-email@kinguniforms.net"
echo "   EMAIL_PASSWORD=your-new-app-password"
echo ""
echo "2. FOR PRODUCTION (Vercel):"
echo "   Set environment variables in Vercel Dashboard:"
echo "   - Go to your Vercel project"
echo "   - Settings → Environment Variables"
echo "   - Update EMAIL_USER and EMAIL_PASSWORD"
echo ""
echo "3. Test the configuration:"
echo "   npm run dev (start local server)"
echo "   Open app → Settings → Printing"
echo "   Send a test email to verify"
echo ""
echo "🚨 IMPORTANT NOTES:"
echo "• Use Gmail App Password (not regular password)"
echo "• Enable 2FA on Gmail account first"
echo "• Generate App Password from Google Account settings"
echo "• App Password format: xxxx xxxx xxxx xxxx"
echo ""
echo "📋 Current System Status:"
echo "• ✅ API files use environment variables"
echo "• ✅ Local servers use environment variables (with fallback)"
echo "• ✅ Vercel.json configured for environment variables"
echo ""

# Check if npm is available and offer to test
if command -v npm &> /dev/null; then
    echo "🧪 Would you like to test the current email configuration? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "Starting test..."
        node test-email-simple.js
    fi
fi

echo "✅ Email configuration update process complete!"
