// Test script for Signed Delivery Ticket Preview Modal Size
// Run this in browser console to verify the modal is now taking up proper screen space

console.log("🎯 Testing Signed Delivery Ticket Preview Modal Size");

function testSignedDeliveryTicketModal() {
  console.log("🔍 Looking for Signed Delivery Ticket Preview modal...");
  
  // Check if the modal is open
  const modal = document.querySelector('.signed-delivery-ticket-modal');
  const modalDialog = document.querySelector('.signed-delivery-ticket-dialog');
  
  if (!modal || !modalDialog) {
    console.log(`
❌ Signed Delivery Ticket Preview modal not found.

To test:
1. Go to Settings → 🖨️ Printing
2. Find a client in the table
3. Click "PDF Preview" button for any client
4. The modal should open
5. Run testSignedDeliveryTicketModal() again
    `);
    return;
  }
  
  console.log("✅ Signed Delivery Ticket Preview modal found!");
  
  // Get viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Get modal dimensions
  const modalRect = modalDialog.getBoundingClientRect();
  
  // Calculate percentages
  const modalWidthPercent = (modalRect.width / viewportWidth * 100).toFixed(1);
  const modalHeightPercent = (modalRect.height / viewportHeight * 100).toFixed(1);
  
  console.log("\n📐 Modal Size Analysis:");
  console.log("─".repeat(50));
  console.log(`🖥️  Viewport: ${viewportWidth}px × ${viewportHeight}px`);
  console.log(`📱 Modal: ${modalRect.width.toFixed(0)}px × ${modalRect.height.toFixed(0)}px`);
  console.log(`📊 Width: ${modalWidthPercent}% of screen (Target: ~85%)`);
  console.log(`📊 Height: ${modalHeightPercent}% of screen (Target: ~85%)`);
  
  // Check if modal is properly sized
  const isCorrectWidth = parseFloat(modalWidthPercent) >= 80 && parseFloat(modalWidthPercent) <= 90;
  const isCorrectHeight = parseFloat(modalHeightPercent) >= 80 && parseFloat(modalHeightPercent) <= 90;
  
  console.log("\n✅ Size Verification:");
  console.log("─".repeat(50));
  if (isCorrectWidth) {
    console.log(`✅ Width: CORRECT (${modalWidthPercent}%)`);
  } else {
    console.log(`❌ Width: INCORRECT (${modalWidthPercent}% - should be ~85%)`);
  }
  
  if (isCorrectHeight) {
    console.log(`✅ Height: CORRECT (${modalHeightPercent}%)`);
  } else {
    console.log(`❌ Height: INCORRECT (${modalHeightPercent}% - should be ~85%)`);
  }
  
  // Check CSS classes
  const hasCorrectClasses = modal.classList.contains('signed-delivery-ticket-modal') && 
                           modalDialog.classList.contains('signed-delivery-ticket-dialog');
  
  console.log(`🎨 CSS Classes: ${hasCorrectClasses ? '✅ CORRECT' : '❌ MISSING'}`);
  
  // Check for title
  const modalTitle = modal.querySelector('.modal-header h4');
  const titleText = modalTitle ? modalTitle.textContent : 'Not found';
  
  console.log(`📝 Modal Title: "${titleText}"`);
  
  // Overall result
  if (isCorrectWidth && isCorrectHeight && hasCorrectClasses) {
    console.log(`
🎉 SUCCESS! The Signed Delivery Ticket Preview modal is now properly sized!
📐 Taking up ${modalWidthPercent}% × ${modalHeightPercent}% of the screen
🚀 This should be much more visible and usable than before
    `);
  } else {
    console.log(`
⚠️  Issues detected. The modal may need further adjustments.
🔧 Check browser zoom level and window size
📱 Try refreshing the page and reopening the modal
    `);
  }
}

// Auto-check if modal is already open
if (document.querySelector('.signed-delivery-ticket-modal')) {
  testSignedDeliveryTicketModal();
} else {
  console.log(`
🧪 Test script loaded successfully!

Instructions:
1. Open the Signed Delivery Ticket Preview modal
2. Run: testSignedDeliveryTicketModal()

Expected Results:
📐 Modal should take ~85% of screen width and height
🎯 Should be much larger and more prominent than before
👁️  PDF preview should be clearly visible and readable
  `);
}

// Make function globally available
window.testSignedDeliveryTicketModal = testSignedDeliveryTicketModal;
