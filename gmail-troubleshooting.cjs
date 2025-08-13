// Gmail Account Verification for notifications@kinguniforms.net
// This script helps verify the Gmail account configuration

console.log('🔍 Gmail Account Troubleshooting Guide');
console.log('====================================\n');

console.log('❌ CURRENT ISSUE:');
console.log('Gmail is rejecting the App Password with error:');
console.log('"Application-specific password required"\n');

console.log('🔧 POSSIBLE CAUSES & SOLUTIONS:');
console.log('1. ⚠️  2-Step Verification not enabled');
console.log('   • Sign in to notifications@kinguniforms.net');
console.log('   • Go to myaccount.google.com/security');
console.log('   • Enable "2-Step Verification" first');
console.log('   • THEN generate App Password\n');

console.log('2. 🔄 App Password generated incorrectly');
console.log('   • Make sure you\'re signed into notifications@kinguniforms.net');
console.log('   • Generate a NEW App Password specifically for "Mail"');
console.log('   • Use "Other (Custom name)" → "King Uniforms Email"\n');

console.log('3. 🕒 App Password needs time to activate');
console.log('   • Sometimes takes 5-10 minutes to become active');
console.log('   • Try again in a few minutes\n');

console.log('4. 📧 Account verification needed');
console.log('   • Gmail might need phone verification');
console.log('   • Check if there are any security notifications\n');

console.log('🧪 QUICK TEST:');
console.log('Try signing into Gmail with these credentials:');
console.log('• Email: notifications@kinguniforms.net');
console.log('• Password: ypyxrvktufwqmkpl');
console.log('• If this fails, the App Password is invalid\n');

console.log('✅ VERIFICATION STEPS:');
console.log('1. Confirm 2-Step Verification is ON');
console.log('2. Generate a brand new App Password');
console.log('3. Update .env.local with the new password');
console.log('4. Restart server and test again');
console.log('');
console.log('📞 If still failing, the notifications@kinguniforms.net account');
console.log('    may need additional Gmail security configuration.');
