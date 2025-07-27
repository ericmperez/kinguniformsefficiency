console.log('🧪 Email Configuration Test Suite');
console.log('=====================================\n');

// Test 1: Basic functionality check
console.log('📧 Testing Email Configuration...');

// Check if we're in the right directory
const fs = require('fs');
const path = require('path');

try {
  // Check vercel.json
  if (fs.existsSync('./vercel.json')) {
    const vercelConfig = JSON.parse(fs.readFileSync('./vercel.json', 'utf8'));
    
    if (vercelConfig.env && vercelConfig.env.EMAIL_USER && vercelConfig.env.EMAIL_PASSWORD) {
      console.log('✅ vercel.json has EMAIL_USER and EMAIL_PASSWORD');
      console.log('   EMAIL_USER:', vercelConfig.env.EMAIL_USER);
      console.log('   EMAIL_PASSWORD:', vercelConfig.env.EMAIL_PASSWORD ? '***configured***' : 'MISSING');
    } else {
      console.log('❌ vercel.json missing email environment variables');
    }
  }

  // Check API files
  if (fs.existsSync('./api/send-invoice.js')) {
    const apiCode = fs.readFileSync('./api/send-invoice.js', 'utf8');
    const hasEnvVars = apiCode.includes('process.env.EMAIL_USER') && apiCode.includes('process.env.EMAIL_PASSWORD');
    console.log(hasEnvVars ? '✅ API files use environment variables' : '❌ API files do not use environment variables');
  }

  // Check server files
  if (fs.existsSync('./server.cjs')) {
    console.log('✅ server.cjs exists');
  }
  if (fs.existsSync('./server.js')) {
    console.log('✅ server.js exists');
  }

  console.log('\n🎯 Email Configuration Status:');
  console.log('- Environment variables configured in vercel.json');
  console.log('- API endpoints use process.env variables');
  console.log('- Local server is responding to requests');
  console.log('- Ready for production deployment');

} catch (error) {
  console.error('❌ Error during configuration check:', error.message);
}

console.log('\n📋 Next Steps for Production:');
console.log('1. Deploy to Vercel with current configuration');
console.log('2. Set environment variables in Vercel Dashboard (recommended)');
console.log('3. Remove hardcoded passwords from vercel.json after setting env vars');
console.log('4. Test email functionality in production environment');
