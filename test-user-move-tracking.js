// Test script to verify user move tracking in segregation
// Run this in browser console on the Segregation page

console.clear();
console.log('🧪 TESTING USER MOVE TRACKING IN SEGREGATION');
console.log('=============================================');

setTimeout(() => {
  console.log('\n📊 STEP 1: CHECK SEGREGATION INTERFACE');
  
  // Look for segregation groups with user badges
  const segregationGroups = document.querySelectorAll('.list-group-item');
  let foundUserBadges = 0;
  
  segregationGroups.forEach((group, index) => {
    // Look for user badges (👤 icon)
    const userBadges = group.querySelectorAll('span[title*="Moved by"]');
    if (userBadges.length > 0) {
      foundUserBadges += userBadges.length;
      console.log(`✅ Group ${index + 1}: Found user tracking badge`);
      
      userBadges.forEach(badge => {
        const badgeText = badge.textContent.trim();
        const titleText = badge.getAttribute('title') || '';
        console.log(`   Badge: "${badgeText}" | Tooltip: "${titleText}"`);
      });
    }
  });
  
  console.log(`\n📈 RESULTS:`);
  console.log(`   Total segregation groups: ${segregationGroups.length}`);
  console.log(`   Groups with user badges: ${foundUserBadges}`);
  
  if (foundUserBadges > 0) {
    console.log('✅ SUCCESS! User move tracking is working');
    console.log('   - User badges are displayed next to client names');
    console.log('   - Tooltips show move details with timestamps');
  } else {
    console.log('ℹ️  No user badges found');
    console.log('   This could be because:');
    console.log('   1. No groups have been moved yet today');
    console.log('   2. Groups need to be moved after this update');
    console.log('   3. User is not logged in or groups lack move data');
  }
  
  console.log('\n🔧 STEP 2: CHECK DATA STRUCTURE');
  
  // Check if move operations are being tracked in console logs
  console.log('📊 Look for these log messages when moving groups:');
  console.log('   - "📝 Updated move tracking: [client1] and [client2] moved by [user]"');
  console.log('   - Move operation console logs with user information');
  
  console.log('\n💡 STEP 3: HOW TO TEST');
  console.log('1. Move a group up or down using the arrow buttons (▲▼)');
  console.log('2. Look for the user badge next to the client name');
  console.log('3. Hover over the badge to see move details');
  console.log('4. Both moved groups should show the user who moved them');
  
  console.log('\n🎯 EXPECTED BEHAVIOR:');
  console.log('✅ Green badges next to client names showing "👤 [username]"');
  console.log('✅ Tooltips showing "Moved by [user] at [timestamp]"');
  console.log('✅ Both groups in a swap operation get updated');
  console.log('✅ Badges persist across page refreshes');
  
  console.log('\n📋 IMPLEMENTATION DETAILS:');
  console.log('- User tracking stored in: lastMovedBy and lastMovedAt fields');
  console.log('- Updates both swapped groups in move operations');
  console.log('- Displays in verification interface for all user roles');
  console.log('- Shows in both single-client and full-list modes');

}, 1000);

console.log('⏳ Waiting 1 second for page to load...');
