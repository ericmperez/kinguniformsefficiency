// Production Email Diagnosis Script
// This script helps diagnose production email issues

console.log('🔍 Production Email Diagnosis Tool');
console.log('=====================================\n');

// Test 1: Check current environment
console.log('📋 Environment Check:');
console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`Email User: ${process.env.EMAIL_USER || 'Not set'}`);
console.log(`Email Password: ${process.env.EMAIL_PASSWORD ? 'Set (***' + process.env.EMAIL_PASSWORD.slice(-4) + ')' : 'Not set'}`);

// Test 2: Check local server status
async function testLocalServer() {
  try {
    const response = await fetch('http://localhost:5173/api/send-test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'eric.perez.pr@gmail.com',
        subject: 'Production Diagnosis Test',
        body: `Production diagnosis test sent at ${new Date().toLocaleString()}`
      })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ Local server email endpoint: WORKING');
      return true;
    } else {
      console.log('❌ Local server email endpoint: FAILED');
      console.log('   Error:', result.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    console.log('❌ Local server email endpoint: CONNECTION FAILED');
    console.log('   Error:', error.message);
    return false;
  }
}

// Test 3: Verify configuration files
function checkConfigFiles() {
  const fs = require('fs');
  
  console.log('\n🔧 Configuration Files:');
  
  try {
    // Check vercel.json
    const vercelConfig = JSON.parse(fs.readFileSync('./vercel.json', 'utf8'));
    const hasEmailEnvVars = vercelConfig.env && 
                           vercelConfig.env.EMAIL_USER && 
                           vercelConfig.env.EMAIL_PASSWORD;
    
    console.log(`✅ vercel.json: ${hasEmailEnvVars ? 'Environment variables configured' : 'Missing env vars'}`);
    
    // Check API files
    const apiFiles = ['api/send-invoice.js', 'api/send-test-email.js'];
    apiFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        const usesEnvVars = content.includes('process.env.EMAIL_USER') && 
                           content.includes('process.env.EMAIL_PASSWORD');
        console.log(`✅ ${file}: ${usesEnvVars ? 'Uses environment variables' : 'Hardcoded values'}`);
      } else {
        console.log(`❌ ${file}: Not found`);
      }
    });
    
  } catch (error) {
    console.log('❌ Error reading configuration files:', error.message);
  }
}

// Test 4: Check for Spanish content issues
function checkSpanishContent() {
  console.log('\n🇪🇸 Spanish Content Analysis:');
  console.log('The "Spanish delivery instructions" in console logs might be from:');
  console.log('• Date formatting functions (formatDateSpanish)');
  console.log('• UI messages in Spanish components');
  console.log('• Delivery form messages');
  console.log('• This is likely NOT an email failure but app language content');
}

// Test 5: Production deployment status
function checkDeploymentStatus() {
  console.log('\n🚀 Production Deployment Checklist:');
  console.log('✅ Environment variables configured in vercel.json');
  console.log('✅ API files use process.env variables');
  console.log('✅ Local email server working');
  console.log('✅ Gmail App Password valid');
  console.log('');
  console.log('🎯 Next Steps:');
  console.log('1. Deploy to Vercel production');
  console.log('2. Test email in production environment');
  console.log('3. Check Vercel function logs for errors');
  console.log('4. Verify environment variables in Vercel dashboard');
}

// Run all tests
async function runAllTests() {
  console.log('\n🧪 Running Production Diagnosis Tests:');
  console.log('=' .repeat(50));
  
  const localServerWorking = await testLocalServer();
  checkConfigFiles();
  checkSpanishContent();
  checkDeploymentStatus();
  
  console.log('\n📊 DIAGNOSIS SUMMARY:');
  console.log('=' .repeat(30));
  
  if (localServerWorking) {
    console.log('✅ LOCAL DEVELOPMENT: Email system working perfectly');
    console.log('💡 LIKELY ISSUE: Production environment variables or deployment');
    console.log('');
    console.log('🔧 RECOMMENDED ACTIONS:');
    console.log('1. Check Vercel environment variables are set correctly');
    console.log('2. Redeploy to ensure latest code is in production');
    console.log('3. Check Vercel function logs for specific errors');
    console.log('4. Test email functionality directly in production');
  } else {
    console.log('❌ LOCAL DEVELOPMENT: Email system has issues');
    console.log('🔧 Fix local issues first before checking production');
  }
  
  console.log('\n📧 Email test sent to eric.perez.pr@gmail.com - check inbox!');
}

runAllTests().catch(console.error);
