/**
 * Test Modal Positioning and Sticky Notes Functionality
 * 
 * This script tests both:
 * 1. Modal positioning fix (navigation header should not block close button)
 * 2. Sticky note visibility on invoice cards
 * 
 * Run this in the browser console after navigating to the app
 */

console.log("🧪 Testing Modal Positioning and Sticky Notes");
console.log("=" .repeat(60));

// Test 1: Check if navigation header exists and get its z-index
function testNavigationHeader() {
  console.log("\n1. 🧭 Testing Navigation Header");
  console.log("-".repeat(40));
  
  const navbar = document.querySelector('header[style*="zIndex: 1200"], .MuiAppBar-root');
  if (navbar) {
    const styles = window.getComputedStyle(navbar);
    console.log("✅ Navigation header found");
    console.log(`   • Z-index: ${styles.zIndex}`);
    console.log(`   • Position: ${styles.position}`);
    console.log(`   • Height: ${styles.height}`);
    
    const rect = navbar.getBoundingClientRect();
    console.log(`   • Actual height: ${rect.height}px`);
    
    return rect.height;
  } else {
    console.log("❌ Navigation header not found");
    return 0;
  }
}

// Test 2: Check for invoice cards with notes
function testStickyNotes() {
  console.log("\n2. 📝 Testing Sticky Note Functionality");
  console.log("-".repeat(40));
  
  const invoiceCards = document.querySelectorAll('.modern-invoice-card');
  console.log(`Found ${invoiceCards.length} invoice cards`);
  
  let cardsWithNotes = 0;
  let cardsWithNoteButtons = 0;
  
  invoiceCards.forEach((card, index) => {
    // Check for note display
    const noteDisplay = card.querySelector('[style*="rgba(255, 241, 118"]');
    if (noteDisplay) {
      cardsWithNotes++;
      console.log(`   • Card ${index + 1}: ✅ Has visible note`);
      console.log(`     Content: "${noteDisplay.textContent.replace('📝 Note:', '').trim().substring(0, 50)}..."`);
    }
    
    // Check for sticky note button
    const noteButton = card.querySelector('.bi-sticky');
    if (noteButton) {
      cardsWithNoteButtons++;
      const button = noteButton.closest('button');
      const hasNote = button && button.classList.contains('btn-warning');
      console.log(`   • Card ${index + 1}: ${hasNote ? '📝' : '📄'} Sticky note button (${hasNote ? 'filled' : 'outline'})`);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   • Cards with visible notes: ${cardsWithNotes}/${invoiceCards.length}`);
  console.log(`   • Cards with note buttons: ${cardsWithNoteButtons}/${invoiceCards.length}`);
  
  if (cardsWithNotes === 0) {
    console.log("\n💡 To test notes:");
    console.log("   1. Click the 📝 (sticky note) button on any invoice card");
    console.log("   2. Add some text in the modal that appears");
    console.log("   3. Click 'Save Note'");
    console.log("   4. The note should appear as a yellow box on the card");
  }
  
  return { cardsWithNotes, cardsWithNoteButtons, totalCards: invoiceCards.length };
}

// Test 3: Check modal positioning when opened
function testModalPositioning(navHeight) {
  console.log("\n3. 🪟 Testing Modal Positioning");
  console.log("-".repeat(40));
  
  const modal = document.querySelector('.modal.show[style*="zIndex: 2000"]');
  if (modal) {
    const styles = window.getComputedStyle(modal);
    console.log("✅ InvoiceDetailsModal found");
    console.log(`   • Z-index: ${styles.zIndex}`);
    console.log(`   • Padding-top: ${styles.paddingTop}`);
    console.log(`   • Align-items: ${styles.alignItems}`);
    
    const modalDialog = modal.querySelector('.modal-dialog');
    if (modalDialog) {
      const rect = modalDialog.getBoundingClientRect();
      console.log(`   • Modal top position: ${rect.top}px`);
      console.log(`   • Navigation height: ${navHeight}px`);
      
      if (rect.top >= navHeight) {
        console.log("   • ✅ Modal is positioned below navigation header");
      } else {
        console.log("   • ❌ Modal overlaps with navigation header!");
      }
      
      // Check for close button
      const closeButton = modalDialog.querySelector('.btn-close');
      if (closeButton) {
        const closeRect = closeButton.getBoundingClientRect();
        console.log(`   • Close button top position: ${closeRect.top}px`);
        
        if (closeRect.top >= navHeight) {
          console.log("   • ✅ Close button is below navigation header");
        } else {
          console.log("   • ❌ Close button is blocked by navigation header!");
        }
      }
    }
  } else {
    console.log("❌ No InvoiceDetailsModal is currently open");
    console.log("💡 To test modal positioning:");
    console.log("   1. Click on any invoice card to open the details modal");
    console.log("   2. Run this script again to check modal positioning");
  }
}

// Main test function
function runTests() {
  const navHeight = testNavigationHeader();
  const noteResults = testStickyNotes();
  testModalPositioning(navHeight);
  
  console.log("\n🎯 OVERALL RESULTS:");
  console.log("=" .repeat(60));
  
  // Navigation header check
  if (navHeight > 0) {
    console.log("✅ Navigation header: FOUND");
  } else {
    console.log("❌ Navigation header: NOT FOUND");
  }
  
  // Sticky notes check
  if (noteResults.cardsWithNoteButtons > 0) {
    console.log("✅ Sticky note buttons: PRESENT");
    if (noteResults.cardsWithNotes > 0) {
      console.log("✅ Note display: WORKING");
    } else {
      console.log("⚠️  Note display: NO NOTES TO TEST (add a note to verify)");
    }
  } else {
    console.log("❌ Sticky note buttons: NOT FOUND");
  }
  
  // Modal positioning check
  const modal = document.querySelector('.modal.show[style*="zIndex: 2000"]');
  if (modal) {
    console.log("✅ Modal positioning: TESTABLE (modal is open)");
  } else {
    console.log("⚠️  Modal positioning: NEED TO OPEN MODAL TO TEST");
  }
}

// Quick functions for manual testing
window.testModalAndNotes = runTests;
window.addTestNote = function() {
  console.log("🔧 Adding test note to first invoice...");
  const firstNoteButton = document.querySelector('.bi-sticky');
  if (firstNoteButton) {
    firstNoteButton.click();
    console.log("✅ Note modal should be open. Add your test note and save!");
  } else {
    console.log("❌ No sticky note buttons found");
  }
};

// Run the tests
runTests();

console.log("\n🛠️  Available Commands:");
console.log("• testModalAndNotes() - Run all tests again");
console.log("• addTestNote() - Open note modal for first invoice");
