// Email Configuration Test and Update Script
// Run this script to test current email configuration and get update instructions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 King Uniforms - Email Configuration Checker');
console.log('='.repeat(50));

// Check current configuration files
console.log('\n📋 Configuration File Status:');
console.log('-'.repeat(30));

// Check .env file
if (fs.existsSync('.env')) {
  console.log('✅ .env file exists');
  try {
    const envContent = fs.readFileSync('.env', 'utf8');
    const hasEmailUser = envContent.includes('EMAIL_USER=');
    const hasEmailPassword = envContent.includes('EMAIL_PASSWORD=');
    
    console.log(`   EMAIL_USER configured: ${hasEmailUser ? '✅' : '❌'}`);
    console.log(`   EMAIL_PASSWORD configured: ${hasEmailPassword ? '✅' : '❌'}`);
    
    if (hasEmailUser) {
      const emailUserMatch = envContent.match(/EMAIL_USER=(.+)/);
      if (emailUserMatch && emailUserMatch[1]) {
        console.log(`   Current EMAIL_USER: ${emailUserMatch[1]}`);
      }
    }
  } catch (error) {
    console.log('❌ Error reading .env file:', error.message);
  }
} else {
  console.log('❌ .env file not found');
  console.log('   📝 Copy .env.template to .env and update with your credentials');
}

// Check vercel.json
if (fs.existsSync('vercel.json')) {
  console.log('✅ vercel.json exists');
  try {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    if (vercelConfig.env && vercelConfig.env.EMAIL_USER && vercelConfig.env.EMAIL_PASSWORD) {
      console.log('✅ Vercel environment variables configured');
    } else {
      console.log('❌ Vercel environment variables missing');
    }
  } catch (error) {
    console.log('❌ Error reading vercel.json:', error.message);
  }
} else {
  console.log('❌ vercel.json not found');
}

// Check API files
console.log('\n🔌 API Configuration Status:');
console.log('-'.repeat(30));

const apiFiles = ['api/send-invoice.js', 'api/send-test-email.js'];
apiFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const usesEnvVars = content.includes('process.env.EMAIL_USER') && content.includes('process.env.EMAIL_PASSWORD');
    console.log(`✅ ${file}: ${usesEnvVars ? 'Uses environment variables' : 'Needs update'}`);
  } else {
    console.log(`❌ ${file}: Not found`);
  }
});

// Check server files
console.log('\n🖥️  Local Server Configuration:');
console.log('-'.repeat(30));

const serverFiles = ['server.js', 'server.cjs'];
serverFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const usesEnvVars = content.includes('process.env.EMAIL_USER');
    const hasHardcoded = content.includes('emperez@kinguniforms.net');
    console.log(`✅ ${file}: Environment variables ${usesEnvVars ? '✅' : '❌'}, Hardcoded fallback ${hasHardcoded ? '✅' : '❌'}`);
  } else {
    console.log(`❌ ${file}: Not found`);
  }
});

console.log('\n🚨 IMPORTANT: Email Configuration Update Required');
console.log('='.repeat(50));
console.log('If emails are not sending, the email credentials may have changed.');
console.log('');
console.log('📝 TO UPDATE EMAIL CONFIGURATION:');
console.log('');
console.log('1. LOCAL DEVELOPMENT:');
console.log('   • Copy .env.template to .env');
console.log('   • Update EMAIL_USER with the new email address');
console.log('   • Update EMAIL_PASSWORD with the new Gmail App Password');
console.log('');
console.log('2. PRODUCTION (Vercel):');
console.log('   • Go to Vercel Dashboard → Your Project → Settings');
console.log('   • Navigate to Environment Variables');
console.log('   • Update EMAIL_USER and EMAIL_PASSWORD values');
console.log('   • Redeploy the application');
console.log('');
console.log('3. GMAIL APP PASSWORD SETUP:');
console.log('   • Go to Google Account settings');
console.log('   • Security → 2-Step Verification (must be enabled)');
console.log('   • App passwords → Generate password for "Mail"');
console.log('   • Use the 16-character password (format: xxxx xxxx xxxx xxxx)');
console.log('');
console.log('4. TEST THE CONFIGURATION:');
console.log('   • Start local development: npm run dev');
console.log('   • Go to Settings → 🖨️ Printing');
console.log('   • Configure a client and send a test email');
console.log('');
console.log('✅ After updating, emails should work correctly!');

// Test current configuration if possible
console.log('\n🧪 TESTING CURRENT CONFIGURATION:');
console.log('-'.repeat(30));

// Check if we can load environment variables
try {
  // Try to import dotenv dynamically
  const dotenv = await import('dotenv');
  dotenv.config();
  
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  if (emailUser && emailPassword) {
    console.log('✅ Environment variables loaded successfully');
    console.log(`   EMAIL_USER: ${emailUser}`);
    console.log(`   EMAIL_PASSWORD: ${emailPassword ? '***configured***' : 'MISSING'}`);
  } else {
    console.log('❌ Environment variables not properly configured');
  }
} catch (error) {
  console.log('⚠️  Could not test environment variables (dotenv not available)');
}
