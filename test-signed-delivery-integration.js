// Complete Integration Test for Signed Delivery Ticket System
// This script tests all the major components and functionality

import fs from 'fs';
import path from 'path';

console.log('🧪 Signed Delivery Ticket Integration Test');
console.log('='.repeat(50));

// Test 1: Check all required files exist
console.log('\n📁 File Structure Check:');
console.log('-'.repeat(30));

const requiredFiles = [
  'src/components/SignedDeliveryTicket.tsx',
  'src/components/SignedDeliveryTicketPreview.tsx',
  'src/services/signedDeliveryPdfService.ts',
  'src/types/signedDeliveryTypes.ts'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Test 2: Check PDF service dependencies
console.log('\n📦 PDF Service Dependencies:');
console.log('-'.repeat(30));

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = ['html2canvas', 'jspdf'];
  requiredDeps.forEach(dep => {
    if (dependencies[dep]) {
      console.log(`✅ ${dep}: ${dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - NOT INSTALLED`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('❌ Could not read package.json');
  allFilesExist = false;
}

// Test 3: Check component integration
console.log('\n🔗 Component Integration Check:');
console.log('-'.repeat(30));

try {
  const previewContent = fs.readFileSync('src/components/SignedDeliveryTicketPreview.tsx', 'utf8');
  
  const checks = [
    { name: 'PDF Service Import', pattern: /downloadSignedDeliveryPDF/ },
    { name: 'SignedDeliveryTicket Import', pattern: /SignedDeliveryTicket/ },
    { name: 'PDF Options State', pattern: /pdfOptions/ },
    { name: 'Download Handler', pattern: /handleDownload/ },
    { name: 'Save as Default', pattern: /handleSaveAsDefault/ },
    { name: 'Reset to Defaults', pattern: /handleResetToDefaults/ }
  ];
  
  checks.forEach(check => {
    if (check.pattern.test(previewContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - MISSING`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('❌ Could not analyze SignedDeliveryTicketPreview.tsx');
  allFilesExist = false;
}

// Test 4: Check PDF service functionality
console.log('\n🔧 PDF Service Functionality:');
console.log('-'.repeat(30));

try {
  const pdfServiceContent = fs.readFileSync('src/services/signedDeliveryPdfService.ts', 'utf8');
  
  const serviceChecks = [
    { name: 'generateSignedDeliveryPDF Function', pattern: /export\s+async\s+function\s+generateSignedDeliveryPDF/ },
    { name: 'downloadSignedDeliveryPDF Function', pattern: /export\s+async\s+function\s+downloadSignedDeliveryPDF/ },
    { name: 'html2canvas Import', pattern: /import\s+html2canvas/ },
    { name: 'jsPDF Import', pattern: /import\s+jsPDF/ },
    { name: 'Error Handling', pattern: /try\s*{[\s\S]*catch/ },
    { name: 'Cleanup Logic', pattern: /removeChild|remove/ }
  ];
  
  serviceChecks.forEach(check => {
    if (check.pattern.test(pdfServiceContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - MISSING`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('❌ Could not analyze signedDeliveryPdfService.ts');
  allFilesExist = false;
}

// Test 5: Check email server integration
console.log('\n📧 Email Server Integration:');
console.log('-'.repeat(30));

try {
  const serverContent = fs.readFileSync('server.cjs', 'utf8');
  
  const emailChecks = [
    { name: 'Email Route Handler', pattern: /\/api\/send-/ },
    { name: 'Nodemailer Import', pattern: /require.*nodemailer/ },
    { name: 'Environment Variables', pattern: /process\.env\.EMAIL_/ },
    { name: 'CORS Configuration', pattern: /cors/ }
  ];
  
  emailChecks.forEach(check => {
    if (check.pattern.test(serverContent)) {
      console.log(`✅ ${check.name}`);
    } else {
      console.log(`❌ ${check.name} - MISSING`);
    }
  });
} catch (error) {
  console.log('⚠️  Could not analyze server.cjs (may not exist)');
}

// Summary
console.log('\n📊 Integration Test Summary:');
console.log('='.repeat(50));

if (allFilesExist) {
  console.log('✅ ALL CORE COMPONENTS READY');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('1. Start development server: npm run dev');
  console.log('2. Navigate to Settings → 🖨️ Printing');
  console.log('3. Test "Signed Delivery Ticket Preview"');
  console.log('4. Test PDF generation and download');
  console.log('5. Test email functionality');
  console.log('');
  console.log('✨ System is ready for final testing!');
} else {
  console.log('❌ INTEGRATION ISSUES DETECTED');
  console.log('');
  console.log('🔧 REQUIRED FIXES:');
  console.log('- Review missing components above');
  console.log('- Ensure all dependencies are installed');
  console.log('- Verify file imports and exports');
  console.log('');
  console.log('⚠️  Fix issues before proceeding with testing');
}

console.log('');
console.log('📝 For detailed testing, visit:');
console.log('   http://localhost:5187/ → Settings → Printing');
