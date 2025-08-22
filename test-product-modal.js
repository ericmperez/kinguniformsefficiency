// Test script to verify product modal full-screen functionality
console.log("🔍 Testing Product Modal Full-Screen Implementation");

// Function to test modal visibility and layout
function testProductModalLayout() {
    console.log("✅ Looking for modal elements...");
    
    // Check if the add-product-modal class exists
    const addProductModal = document.querySelector('.add-product-modal');
    if (addProductModal) {
        console.log("✅ Found .add-product-modal element");
        
        // Check computed styles
        const computedStyle = window.getComputedStyle(addProductModal);
        console.log(`📏 Modal width: ${computedStyle.width}`);
        console.log(`📏 Modal height: ${computedStyle.height}`);
        console.log(`📏 Z-index: ${computedStyle.zIndex}`);
        console.log(`🎨 Background: ${computedStyle.background}`);
        
        // Check modal dialog
        const modalDialog = addProductModal.querySelector('.modal-dialog');
        if (modalDialog) {
            const dialogStyle = window.getComputedStyle(modalDialog);
            console.log(`📏 Dialog width: ${dialogStyle.width}`);
            console.log(`📏 Dialog height: ${dialogStyle.height}`);
        }
        
        // Check product grid
        const productGrid = addProductModal.querySelector('.product-grid');
        if (productGrid) {
            console.log("✅ Found .product-grid element");
            const productCards = productGrid.querySelectorAll('.product-card-selectable');
            console.log(`📦 Found ${productCards.length} product cards`);
            
            // Test responsive layout
            productCards.forEach((card, index) => {
                const cardStyle = window.getComputedStyle(card);
                console.log(`📦 Card ${index + 1}: ${cardStyle.width} x ${cardStyle.height}`);
            });
        }
        
        return true;
    } else {
        console.log("❌ No .add-product-modal found. Modal may not be open.");
        return false;
    }
}

// Function to test modal opening
function testModalOpening() {
    console.log("🔍 Looking for 'Add New Item' buttons...");
    const addButtons = document.querySelectorAll('button');
    let foundAddButton = false;
    
    addButtons.forEach((button) => {
        if (button.textContent && button.textContent.includes('Add New Item')) {
            console.log("✅ Found 'Add New Item' button");
            foundAddButton = true;
            
            // Simulate click to open modal
            console.log("🖱️ Simulating button click...");
            button.click();
            
            // Wait for modal to appear
            setTimeout(() => {
                testProductModalLayout();
            }, 500);
        }
    });
    
    if (!foundAddButton) {
        console.log("❌ No 'Add New Item' button found. Make sure you're on the invoice details page.");
    }
}

// Run the test
console.log("🚀 Starting Product Modal Test...");
console.log("📝 This test will:");
console.log("   1. Look for 'Add New Item' buttons");
console.log("   2. Simulate clicking to open the product modal");
console.log("   3. Check if the modal uses full-screen layout");
console.log("   4. Verify the product grid layout");
console.log("");

// First check if modal is already open
if (!testProductModalLayout()) {
    // If not open, try to open it
    testModalOpening();
}

// Also add a manual test function to the window
window.testProductModal = function() {
    console.log("🔧 Manual test initiated...");
    testProductModalLayout();
};

console.log("💡 You can also run 'testProductModal()' in the console manually");
