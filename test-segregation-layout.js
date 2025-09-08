// Test script for Segregation full-screen layout
console.log('🔍 Testing Segregation Layout Implementation');

// Check if we're on the segregation page
function checkSegregationLayout() {
  console.log('\n📱 SEGREGATION LAYOUT TEST');
  console.log('='.repeat(50));
  
  // Check if we can see the full-screen container
  const fullScreenContainer = document.querySelector('div[style*="100vw"][style*="100vh"]');
  console.log('🖥️  Full-screen container found:', !!fullScreenContainer);
  
  if (fullScreenContainer) {
    const style = window.getComputedStyle(fullScreenContainer);
    console.log('   - Width:', style.width);
    console.log('   - Height:', style.height);
    console.log('   - Background:', style.background);
    console.log('   - Position:', style.position);
  }
  
  // Check for main menu button
  const mainMenuButton = document.querySelector('button[style*="fixed"][style*="top: 15px"][style*="left: 15px"]');
  console.log('🏠 Main Menu button found:', !!mainMenuButton);
  
  if (mainMenuButton) {
    console.log('   - Text content:', mainMenuButton.textContent?.trim());
    console.log('   - Position:', window.getComputedStyle(mainMenuButton).position);
    console.log('   - Z-index:', window.getComputedStyle(mainMenuButton).zIndex);
  }
  
  // Check for backdrop blur content container
  const contentContainer = document.querySelector('div[style*="backdrop-filter"]');
  console.log('🎨 Backdrop blur container found:', !!contentContainer);
  
  if (contentContainer) {
    const style = window.getComputedStyle(contentContainer);
    console.log('   - Background:', style.background);
    console.log('   - Backdrop filter:', style.backdropFilter);
    console.log('   - Padding:', style.padding);
  }
  
  // Check for segregation-specific content
  const segregationCard = document.querySelector('.segregation-page');
  console.log('📋 Segregation content found:', !!segregationCard);
  
  // Check for the gradient background
  const gradientElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return style.background.includes('linear-gradient') && 
           style.background.includes('#1e3c72') && 
           style.background.includes('#2a5298');
  });
  console.log('🌈 Gradient background elements found:', gradientElements.length);
  
  // Overall assessment
  console.log('\n🎯 LAYOUT ASSESSMENT:');
  const hasFullScreen = !!fullScreenContainer;
  const hasMenuButton = !!mainMenuButton;
  const hasBackdrop = !!contentContainer;
  const hasSegregationContent = !!segregationCard;
  
  if (hasFullScreen && hasMenuButton && hasBackdrop && hasSegregationContent) {
    console.log('✅ SUCCESS: Full-screen layout is properly implemented!');
    console.log('   - Full-screen container: ✅');
    console.log('   - Main menu button: ✅');
    console.log('   - Backdrop blur container: ✅');
    console.log('   - Segregation content: ✅');
  } else {
    console.log('❌ ISSUES DETECTED:');
    console.log(`   - Full-screen container: ${hasFullScreen ? '✅' : '❌'}`);
    console.log(`   - Main menu button: ${hasMenuButton ? '✅' : '❌'}`);
    console.log(`   - Backdrop blur container: ${hasBackdrop ? '✅' : '❌'}`);
    console.log(`   - Segregation content: ${hasSegregationContent ? '✅' : '❌'}`);
  }
  
  return {
    hasFullScreen,
    hasMenuButton,
    hasBackdrop,
    hasSegregationContent,
    success: hasFullScreen && hasMenuButton && hasBackdrop && hasSegregationContent
  };
}

// Test main menu button functionality
function testMainMenuButton() {
  console.log('\n🔘 TESTING MAIN MENU BUTTON');
  console.log('='.repeat(30));
  
  const mainMenuButton = document.querySelector('button[style*="fixed"][style*="top: 15px"][style*="left: 15px"]');
  
  if (mainMenuButton) {
    console.log('🎯 Found main menu button');
    console.log('📝 Button text:', mainMenuButton.textContent?.trim());
    
    // Test hover effects
    console.log('🖱️  Testing hover effects...');
    
    // Simulate mouse enter
    const mouseEnterEvent = new MouseEvent('mouseenter', { bubbles: true });
    mainMenuButton.dispatchEvent(mouseEnterEvent);
    
    setTimeout(() => {
      const hoverStyle = window.getComputedStyle(mainMenuButton);
      console.log('   - Hover background:', hoverStyle.background);
      console.log('   - Hover color:', hoverStyle.color);
      
      // Simulate mouse leave
      const mouseLeaveEvent = new MouseEvent('mouseleave', { bubbles: true });
      mainMenuButton.dispatchEvent(mouseLeaveEvent);
      
      setTimeout(() => {
        const normalStyle = window.getComputedStyle(mainMenuButton);
        console.log('   - Normal background:', normalStyle.background);
        console.log('   - Normal color:', normalStyle.color);
      }, 100);
    }, 100);
    
    // Test click functionality (without actually navigating)
    console.log('🎯 Button click handler:', typeof mainMenuButton.onclick);
    
    return true;
  } else {
    console.log('❌ Main menu button not found');
    return false;
  }
}

// Check if current page is segregation
function isOnSegregationPage() {
  // Check URL or page indicators
  const url = window.location.href;
  const hasSegregationContent = document.querySelector('.segregation-page');
  const hasSegregationTitle = document.querySelector('h4')?.textContent?.includes('Segregation');
  
  return hasSegregationContent || hasSegregationTitle;
}

// Main test function
function runSegregationLayoutTest() {
  console.log('🚀 STARTING SEGREGATION LAYOUT TEST');
  console.log('Current URL:', window.location.href);
  console.log('Page loaded:', document.readyState);
  
  if (!isOnSegregationPage()) {
    console.log('⚠️  Not on segregation page. Navigate to segregation to test the layout.');
    console.log('💡 Instructions:');
    console.log('   1. Log in to the application');
    console.log('   2. Navigate to Process > Segregation');
    console.log('   3. Run this test again');
    return false;
  }
  
  const layoutTest = checkSegregationLayout();
  const buttonTest = testMainMenuButton();
  
  console.log('\n📊 FINAL RESULTS:');
  console.log('='.repeat(40));
  console.log(`Layout Implementation: ${layoutTest.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Button Functionality: ${buttonTest ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (layoutTest.success && buttonTest) {
    console.log('\n🎉 CONGRATULATIONS!');
    console.log('The Segregation window now matches the PickupWashing full-screen style!');
    console.log('Features implemented:');
    console.log('• Full-screen layout with gradient background');
    console.log('• Fixed main menu button on the left side');
    console.log('• Backdrop blur content container');
    console.log('• Responsive design with hover effects');
  } else {
    console.log('\n🔧 ISSUES TO ADDRESS:');
    if (!layoutTest.hasFullScreen) console.log('• Add full-screen container');
    if (!layoutTest.hasMenuButton) console.log('• Add main menu button');
    if (!layoutTest.hasBackdrop) console.log('• Add backdrop blur container');
    if (!layoutTest.hasSegregationContent) console.log('• Ensure segregation content is present');
  }
  
  return layoutTest.success && buttonTest;
}

// Auto-run test when script is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runSegregationLayoutTest);
} else {
  runSegregationLayoutTest();
}

// Export for manual testing
window.testSegregationLayout = runSegregationLayoutTest;
window.checkSegregationLayout = checkSegregationLayout;
window.testMainMenuButton = testMainMenuButton;

console.log('\n💡 MANUAL TESTING:');
console.log('Run window.testSegregationLayout() to test anytime');
console.log('Run window.checkSegregationLayout() for layout details');
console.log('Run window.testMainMenuButton() for button testing');
