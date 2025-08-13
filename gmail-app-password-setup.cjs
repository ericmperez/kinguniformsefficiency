// Gmail App Password Setup Guide for notifications@kinguniforms.net
// ================================================================

console.log('🔐 Gmail App Password Setup Required');
console.log('====================================\n');

console.log('❌ CURRENT ISSUE:');
console.log('The password "Kinguni1167!" is a regular Gmail password.');
console.log('Gmail requires an "App Password" for SMTP access from applications.\n');

console.log('🔧 SOLUTION: Generate Gmail App Password');
console.log('----------------------------------------');
console.log('You need to create an App Password for notifications@kinguniforms.net:');
console.log('');
console.log('1. Sign in to notifications@kinguniforms.net Gmail account');
console.log('2. Go to Google Account settings (https://myaccount.google.com)');
console.log('3. Click "Security" in the left sidebar');
console.log('4. Under "How you sign in to Google", click "2-Step Verification"');
console.log('   (If not enabled, you\'ll need to enable it first)');
console.log('5. Scroll down and click "App passwords"');
console.log('6. In the "Select app" dropdown, choose "Mail"');
console.log('7. In the "Select device" dropdown, choose "Other (custom name)"');
console.log('8. Type "King Uniforms Delivery System" as the custom name');
console.log('9. Click "Generate"');
console.log('10. Copy the 16-character password (format: "abcd efgh ijkl mnop")');
console.log('');

console.log('🔄 NEXT STEPS:');
console.log('1. Update EMAIL_PASSWORD in .env.local with the App Password');
console.log('2. Restart the server: node server.cjs');
console.log('3. Test email: node test-email-to-eric.cjs');
console.log('');

console.log('📝 Example App Password format:');
console.log('EMAIL_PASSWORD=abcd efgh ijkl mnop');
console.log('');

console.log('✅ Once completed, the delivery ticket email system will work with:');
console.log('• From: notifications@kinguniforms.net');
console.log('• To: eric.perez.pr@gmail.com');
console.log('• PDF attachments for delivery confirmations');
console.log('• Consolidated item lists');
console.log('• Proper date formatting');
console.log('• Correctly proportioned logos');
