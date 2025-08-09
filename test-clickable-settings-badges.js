/**
 * Test Script: Clickable Settings Badges in PDF Preview
 * 
 * This script tests the new clickable functionality in the "Current Settings Impact" section
 * of the Signed Delivery Ticket Preview modal.
 * 
 * USAGE:
 * 1. Navigate to Settings → 🖨️ Printing in the app
 * 2. Click "PDF Preview" for any client to open the modal
 * 3. Open browser console (F12)
 * 4. Paste this script and press Enter
 * 5. Run: testClickableSettingsBadges()
 */

console.log("🎯 Clickable Settings Badges Test Script Loaded");

/**
 * Test the clickable settings badges functionality
 */
window.testClickableSettingsBadges = function() {
  console.log("🚀 Testing Clickable Settings Badges...");
  console.log("=" .repeat(70));
  
  // Check if the PDF preview modal is open
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  if (!modal) {
    console.log("❌ PDF Preview modal not found.");
    console.log("💡 Please open the PDF Preview modal first:");
    console.log("   1. Go to Settings → 🖨️ Printing");
    console.log("   2. Click 'PDF Preview' for any client");
    console.log("   3. Run this test again");
    return;
  }
  
  console.log("✅ PDF Preview modal detected");
  
  // Look for the "Current Settings Impact" section
  const settingsSection = Array.from(modal.querySelectorAll('h6'))
    .find(h => h.textContent?.includes('Current Settings Impact'));
  
  if (!settingsSection) {
    console.log("❌ Current Settings Impact section not found");
    return;
  }
  
  console.log("✅ Current Settings Impact section found");
  
  // Find all badges in the settings section
  const settingsContainer = settingsSection.closest('.card-body');
  const badges = settingsContainer?.querySelectorAll('.badge');
  
  if (!badges || badges.length === 0) {
    console.log("❌ No settings badges found");
    return;
  }
  
  console.log(`📋 Found ${badges.length} settings badges`);
  
  // Test each badge for clickability
  let clickableBadges = 0;
  let nonClickableBadges = 0;
  
  badges.forEach((badge, index) => {
    const isClickable = badge.classList.contains('clickable-badge') || 
                       badge.style.cursor === 'pointer' ||
                       badge.onclick !== null;
    
    const badgeText = badge.textContent?.trim();
    const settingName = badge.closest('.d-flex')?.querySelector('span:first-child')?.textContent?.trim();
    
    if (isClickable) {
      clickableBadges++;
      console.log(`   ✅ Badge ${index + 1}: "${settingName}" = "${badgeText}" (CLICKABLE)`);
      
      // Test hover effect
      const hasHoverClass = badge.classList.contains('clickable-badge');
      const hasHoverCursor = badge.style.cursor === 'pointer';
      
      if (hasHoverClass && hasHoverCursor) {
        console.log(`      🎨 Has proper hover styling`);
      }
      
      // Check for tooltip
      const hasTooltip = badge.title && badge.title.length > 0;
      if (hasTooltip) {
        console.log(`      💬 Tooltip: "${badge.title}"`);
      }
      
    } else {
      nonClickableBadges++;
      console.log(`   ⚪ Badge ${index + 1}: "${settingName}" = "${badgeText}" (non-clickable)`);
    }
  });
  
  console.log("\n📊 Summary:");
  console.log(`   🖱️  Clickable badges: ${clickableBadges}`);
  console.log(`   ⚪ Non-clickable badges: ${nonClickableBadges}`);
  console.log(`   📝 Total badges: ${badges.length}`);
  
  // Check for the "(click to toggle)" hint
  const clickHint = settingsSection.textContent?.includes('(click to toggle)');
  if (clickHint) {
    console.log("   💡 Click hint displayed: ✅");
  } else {
    console.log("   💡 Click hint displayed: ❌");
  }
  
  // Test actual clicking functionality
  if (clickableBadges > 0) {
    console.log("\n🧪 Testing Click Functionality:");
    console.log("   💡 Try clicking any clickable badge to test the toggle functionality");
    console.log("   💡 You should see the badge change and a success notification appear");
    
    // Highlight clickable badges for easy identification
    badges.forEach(badge => {
      if (badge.classList.contains('clickable-badge') || badge.style.cursor === 'pointer') {
        badge.style.outline = '2px solid #007bff';
        badge.style.outlineOffset = '2px';
        
        setTimeout(() => {
          badge.style.outline = '';
          badge.style.outlineOffset = '';
        }, 5000);
      }
    });
    
    console.log("   🔵 Clickable badges highlighted in blue for 5 seconds");
  }
  
  return {
    totalBadges: badges.length,
    clickableBadges,
    nonClickableBadges,
    hasClickHint: clickHint
  };
};

/**
 * Test the onConfigUpdate callback functionality
 */
window.testConfigUpdateCallback = function() {
  console.log("🔄 Testing Config Update Callback...");
  
  // Check if the callback is properly passed
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  if (!modal) {
    console.log("❌ Modal not found");
    return;
  }
  
  // Look for clickable badges
  const clickableBadges = modal.querySelectorAll('.clickable-badge, [style*="cursor: pointer"]');
  
  if (clickableBadges.length === 0) {
    console.log("❌ No clickable badges found");
    return;
  }
  
  console.log(`✅ Found ${clickableBadges.length} clickable badges`);
  console.log("💡 The onConfigUpdate callback should be working if badges are clickable");
  console.log("💡 When you click a badge, it should:");
  console.log("   1. Toggle the setting value (ON ↔ OFF)");
  console.log("   2. Update the database");
  console.log("   3. Show a success notification");
  console.log("   4. Update the badge appearance immediately");
};

/**
 * Show usage instructions
 */
window.showClickableSettingsUsage = function() {
  console.log("📖 How to Use Clickable Settings:");
  console.log("=" .repeat(50));
  console.log("1. Navigate to Settings → 🖨️ Printing");
  console.log("2. Click 'PDF Preview' for any client");
  console.log("3. Look for 'Current Settings Impact' section");
  console.log("4. Click any badge that shows '(click to toggle)' hint");
  console.log("5. Badge will toggle between ON/OFF");
  console.log("6. Configuration is saved automatically");
  console.log("7. Changes apply immediately to the preview");
  console.log("");
  console.log("🎯 Available Settings to Toggle:");
  console.log("   • Show Items (cart setting)");
  console.log("   • Show Quantities (cart setting)");
  console.log("   • Show Total Weight (invoice setting)");
  console.log("   • Billing Type (read-only, not clickable)");
  console.log("");
  console.log("💡 Note: Changes are saved to the client's print configuration");
  console.log("💡 The PDF preview updates in real-time to reflect changes");
};

// Auto-run quick check
setTimeout(() => {
  console.log("\n🎯 Available test functions:");
  console.log("• testClickableSettingsBadges() - Test badge clickability");
  console.log("• testConfigUpdateCallback() - Test callback functionality");
  console.log("• showClickableSettingsUsage() - Show usage instructions");
  
  // Auto-run if modal is already open
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  if (modal) {
    console.log("\n🔄 PDF Preview modal detected - running quick test...");
    testClickableSettingsBadges();
  }
}, 1000);

console.log("\n📋 Instructions:");
console.log("1. Open PDF Preview modal (Settings → 🖨️ Printing → PDF Preview)");
console.log("2. Run testClickableSettingsBadges() for comprehensive testing");
console.log("3. Click highlighted badges to test functionality");
console.log("4. Run showClickableSettingsUsage() for usage guide");
