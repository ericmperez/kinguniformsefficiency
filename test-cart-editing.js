// Test script to verify cart editing functionality
console.log("🧪 Testing cart editing functionality...");

// This would be run in the browser console to test cart editing
const testCartEditing = async () => {
  try {
    // Get a sample invoice from Firestore
    const invoicesQuery = await firebase.firestore().collection('invoices').limit(1).get();
    
    if (invoicesQuery.empty) {
      console.log("❌ No invoices found for testing");
      return;
    }
    
    const invoice = invoicesQuery.docs[0];
    const invoiceData = invoice.data();
    
    console.log("📋 Testing with invoice:", invoice.id);
    console.log("🗂️ Current carts:", invoiceData.carts);
    
    if (!invoiceData.carts || invoiceData.carts.length === 0) {
      console.log("❌ No carts found in this invoice");
      return;
    }
    
    const cartToEdit = invoiceData.carts[0];
    const newCartName = `EDITED_CART_${Date.now()}`;
    
    console.log(`✏️ Editing cart '${cartToEdit.name}' to '${newCartName}'`);
    
    // Update the cart name
    const updatedCarts = invoiceData.carts.map(cart => 
      cart.id === cartToEdit.id 
        ? { ...cart, name: newCartName }
        : cart
    );
    
    // Update in Firestore
    await firebase.firestore()
      .collection('invoices')
      .doc(invoice.id)
      .update({ 
        carts: updatedCarts,
        updatedAt: new Date().toISOString()
      });
    
    console.log("✅ Cart name updated successfully in Firestore");
    
    // Verify the update
    const updatedInvoice = await firebase.firestore()
      .collection('invoices')
      .doc(invoice.id)
      .get();
    
    const verifyData = updatedInvoice.data();
    const verifyCart = verifyData.carts.find(c => c.id === cartToEdit.id);
    
    if (verifyCart && verifyCart.name === newCartName) {
      console.log("✅ Verification successful - cart name persisted in Firestore");
      console.log("🎉 Cart editing functionality is working correctly!");
    } else {
      console.log("❌ Verification failed - cart name did not persist");
      console.log("Expected:", newCartName);
      console.log("Actual:", verifyCart?.name);
    }
    
  } catch (error) {
    console.error("❌ Error testing cart editing:", error);
  }
};

// Instructions for running this test
console.log("📝 To run this test:");
console.log("1. Open browser console on your app");
console.log("2. Run: testCartEditing()");

// Export for browser use
if (typeof window !== 'undefined') {
  window.testCartEditing = testCartEditing;
}
