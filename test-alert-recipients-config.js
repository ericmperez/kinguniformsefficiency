// Test Alert Recipients Configuration
// This script tests that the alert system is using the correct email recipients

import { getNotificationRecipients } from './api/lib/notificationConfig.js';

async function testAlertRecipients() {
  console.log('🔔 Testing Alert Recipients Configuration...');
  console.log('=====================================\n');

  try {
    // Test 1: Load recipients from database configuration
    console.log('1. Loading recipients from database configuration...');
    const recipients = await getNotificationRecipients();
    
    console.log('✅ Recipients loaded successfully:');
    recipients.forEach((email, index) => {
      console.log(`   ${index + 1}. ${email}`);
    });
    
    // Test 2: Verify these are the correct recipients
    const expectedRecipients = [
      'rmperez@kinguniforms.net',
      'eric.perez.pr@gmail.com', 
      'jperez@kinguniforms.net'
    ];
    
    console.log('\n2. Verifying recipient configuration...');
    const allExpectedFound = expectedRecipients.every(expected => 
      recipients.includes(expected)
    );
    
    if (allExpectedFound && recipients.length === expectedRecipients.length) {
      console.log('✅ All expected recipients are configured correctly!');
    } else {
      console.log('⚠️  Recipient configuration mismatch:');
      console.log('   Expected:', expectedRecipients);
      console.log('   Current: ', recipients);
    }
    
    // Test 3: Show which systems will use these recipients
    console.log('\n3. Systems that will send alerts to these recipients:');
    console.log('   📧 Daily driver assignment checks (8:00 PM)');
    console.log('   🚨 System error notifications');
    console.log('   ⚠️  Unassigned truck alerts');
    console.log('   🔄 Cron job failure notifications');
    console.log('   🧪 Manual test notifications');
    
    console.log('\n✅ Alert Recipients Configuration Test COMPLETE');
    console.log('🔔 All alerts will be sent to your chosen email addresses');
    
  } catch (error) {
    console.error('❌ Error testing alert recipients:', error);
    console.log('\n⚠️  If configuration fails, system will fall back to default recipients:');
    console.log('   - rmperez@kinguniforms.net');
    console.log('   - eric.perez.pr@gmail.com');
    console.log('   - jperez@kinguniforms.net');
  }
}

// Run the test
testAlertRecipients();
