// Navigation Helper for Print Settings
// Copy and paste this into the browser console to navigate to print settings

console.log("🖨️ Print Settings Navigation Helper");
console.log("====================================");

// Check if we're logged in
const loginButton = document.querySelector('button[type="submit"]');
const loginForm = document.querySelector('form');

if (loginButton && loginForm) {
  console.log("❌ You need to log in first!");
  console.log("1. Enter your login credentials");
  console.log("2. After login, run this script again");
  return;
}

// Look for Settings tab/link
const settingsLinks = Array.from(document.querySelectorAll('a, button, [role="tab"]'))
  .filter(el => el.textContent?.toLowerCase().includes('settings') || 
               el.textContent?.toLowerCase().includes('configuración'));

console.log(`Found ${settingsLinks.length} potential Settings links:`);
settingsLinks.forEach((link, index) => {
  console.log(`  ${index + 1}. "${link.textContent?.trim()}" (${link.tagName})`);
});

// Look for Print/Printing related elements
const printingElements = Array.from(document.querySelectorAll('*'))
  .filter(el => el.textContent?.includes('🖨️') || 
               el.textContent?.toLowerCase().includes('print') ||
               el.textContent?.toLowerCase().includes('printing'));

console.log(`\nFound ${printingElements.length} printing-related elements:`);
printingElements.forEach((el, index) => {
  if (el.textContent && el.textContent.trim().length < 100) {
    console.log(`  ${index + 1}. "${el.textContent?.trim()}" (${el.tagName})`);
  }
});

// Try to find and click Settings
if (settingsLinks.length > 0) {
  console.log("\n🎯 Attempting to navigate to Settings...");
  settingsLinks[0].click();
  
  setTimeout(() => {
    // Look for printing tab after clicking settings
    const printingTabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'))
      .filter(el => el.textContent?.includes('🖨️') || 
                   el.textContent?.toLowerCase().includes('print'));
    
    if (printingTabs.length > 0) {
      console.log("✅ Found printing section! Clicking...");
      printingTabs[0].click();
      
      setTimeout(() => {
        console.log("\n📋 Current page elements:");
        const clients = Array.from(document.querySelectorAll('tr, .card, .list-item'))
          .filter(el => el.textContent?.toLowerCase().includes('costa') ||
                       el.textContent?.toLowerCase().includes('bahía') ||
                       el.textContent?.toLowerCase().includes('bahia'));
        
        console.log(`Found ${clients.length} Costa Bahía related elements:`);
        clients.forEach((el, index) => {
          console.log(`  ${index + 1}. "${el.textContent?.trim().substring(0, 100)}..."`);
        });
        
        // Look for Configure buttons
        const configButtons = Array.from(document.querySelectorAll('button'))
          .filter(btn => btn.textContent?.toLowerCase().includes('configure') ||
                        btn.textContent?.toLowerCase().includes('config'));
        
        console.log(`\nFound ${configButtons.length} Configure buttons`);
        
      }, 1000);
    } else {
      console.log("❌ Could not find printing section after clicking Settings");
    }
  }, 1000);
} else {
  console.log("❌ Could not find Settings link");
  console.log("\n📍 Manual Navigation Steps:");
  console.log("1. Look for a 'Settings' tab or link in the main navigation");
  console.log("2. Click on Settings");
  console.log("3. Look for a '🖨️ Printing' tab within Settings");
  console.log("4. Click on the Printing tab");
  console.log("5. Find 'Costa Bahía' in the client list");
  console.log("6. Click the 'Configure' button next to Costa Bahía");
}

console.log("\n🔍 If you still can't find it, run: findCostaClient()");

// Helper function to find Costa Bahía
window.findCostaClient = function() {
  const allText = document.body.textContent?.toLowerCase() || '';
  if (allText.includes('costa')) {
    console.log("✅ Found 'Costa' on the page");
    
    const costaElements = Array.from(document.querySelectorAll('*'))
      .filter(el => el.textContent?.toLowerCase().includes('costa'));
    
    console.log(`Found ${costaElements.length} elements containing 'Costa':`);
    costaElements.forEach((el, index) => {
      if (el.textContent && el.textContent.trim().length < 200) {
        console.log(`  ${index + 1}. "${el.textContent?.trim()}"`);
      }
    });
  } else {
    console.log("❌ Costa Bahía not found on current page");
    console.log("You may need to navigate to the correct section first");
  }
};
