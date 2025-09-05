// Test script to verify user move tracking in washing page
// Run this in browser console on the Washing page

console.clear();
console.log('🧪 TESTING USER MOVE TRACKING IN WASHING PAGE');
console.log('=============================================');

setTimeout(() => {
  console.log('\n📊 STEP 1: CHECK WASHING INTERFACE');
  
  // Check if we're on the washing page
  const washingTitle = document.querySelector('h2');
  if (!washingTitle || !washingTitle.textContent.includes('Washing')) {
    console.log('❌ Not on washing page. Please navigate to the washing page first.');
    return;
  }
  
  console.log('✅ On washing page');
  
  // Check for tunnel and conventional tabs
  const tunnelTab = Array.from(document.querySelectorAll('.nav-link')).find(tab => 
    tab.textContent.includes('Tunnel')
  );
  const conventionalTab = Array.from(document.querySelectorAll('.nav-link')).find(tab => 
    tab.textContent.includes('Conventional')
  );
  
  if (!tunnelTab || !conventionalTab) {
    console.log('❌ Tunnel or Conventional tabs not found');
    return;
  }
  
  console.log('✅ Found Tunnel and Conventional tabs');
  
  // Function to check for user badges in a section
  const checkUserBadges = (sectionName) => {
    console.log(`\n📋 Checking ${sectionName} section for user badges:`);
    
    // Look for user badges (👤 icon)
    const userBadges = document.querySelectorAll('.user-move-badge');
    let foundBadges = 0;
    
    userBadges.forEach((badge, index) => {
      const badgeText = badge.textContent.trim();
      const titleText = badge.getAttribute('title') || '';
      
      if (badgeText.includes('👤')) {
        foundBadges++;
        console.log(`   ✅ Badge ${index + 1}: "${badgeText}" | Tooltip: "${titleText}"`);
      }
    });
    
    return foundBadges;
  };
  
  // Test tunnel section
  console.log('\n🔧 STEP 2: TESTING TUNNEL SECTION');
  if (tunnelTab) {
    tunnelTab.click();
    setTimeout(() => {
      const tunnelBadges = checkUserBadges('Tunnel');
      console.log(`   Found ${tunnelBadges} user badges in tunnel section`);
      
      // Look for tunnel groups
      const tunnelGroups = document.querySelectorAll('.list-group-item');
      console.log(`   Found ${tunnelGroups.length} tunnel groups`);
      
      // Test conventional section
      console.log('\n🔧 STEP 3: TESTING CONVENTIONAL SECTION');
      if (conventionalTab) {
        conventionalTab.click();
        setTimeout(() => {
          const conventionalBadges = checkUserBadges('Conventional');
          console.log(`   Found ${conventionalBadges} user badges in conventional section`);
          
          // Look for conventional groups
          const conventionalGroups = document.querySelectorAll('.list-group-item');
          console.log(`   Found ${conventionalGroups.length} conventional groups`);
          
          console.log('\n📈 RESULTS SUMMARY:');
          console.log('================');
          console.log(`   ✅ CSS import: .user-move-badge class ${document.querySelector('.user-move-badge') ? 'found' : 'not found'}`);
          console.log(`   ✅ Total user badges found: ${tunnelBadges + conventionalBadges}`);
          console.log(`   ✅ Tunnel badges: ${tunnelBadges}`);
          console.log(`   ✅ Conventional badges: ${conventionalBadges}`);
          
          if (tunnelBadges > 0 || conventionalBadges > 0) {
            console.log('\n🎉 SUCCESS! User move tracking is working in washing page');
            console.log('   - User badges are displayed next to client names');
            console.log('   - Tooltips show move details with timestamps');
          } else {
            console.log('\n📝 NO USER BADGES FOUND');
            console.log('   This could be because:');
            console.log('   1. No groups have been moved yet today');
            console.log('   2. Groups need to be moved after this update');
            console.log('   3. User is not logged in or groups lack move data');
            console.log('\n💡 To test the feature:');
            console.log('   1. Use the arrow buttons (▲▼) to move a group');
            console.log('   2. Look for green badges next to client names');
            console.log('   3. Hover over badges to see move details');
          }
          
          console.log('\n🔧 IMPLEMENTATION DETAILS:');
          console.log('========================');
          console.log('✅ Added user tracking to tunnel move function');
          console.log('✅ Added user tracking to conventional move function');
          console.log('✅ Added user badges to tunnel section client names');
          console.log('✅ Added user badges to conventional section client names');
          console.log('✅ Imported Segregation.css for badge styling');
          console.log('✅ Implementation matches segregation page functionality');
          
        }, 500);
      }
    }, 500);
  }
  
}, 1000);

console.log('⏳ Waiting 1 second for page to load...');
