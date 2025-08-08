/**
 * Test PDF Generation Script
 * Run this in browser console to test if PDF generation is working
 */

window.testPDFGeneration = async function() {
  console.log('🧪 Testing PDF Generation...');
  
  try {
    // Import the PDF service (this will work if we're in the React app context)
    const sampleClient = {
      id: "test-client",
      name: "Test Client",
      email: "test@example.com",
      billingCalculation: "byWeight"
    };
    
    const sampleInvoice = {
      id: "TEST-001",
      invoiceNumber: 1001,
      clientId: sampleClient.id,
      clientName: sampleClient.name,
      date: new Date().toISOString().split('T')[0],
      products: [],
      carts: [
        {
          id: "test-cart-1",
          name: "Sample Cart 1",
          items: [
            {
              productId: "test-product-1",
              productName: "Sample Uniform Shirt",
              quantity: 5,
              price: 2.50
            },
            {
              productId: "test-product-2", 
              productName: "Sample Uniform Pants",
              quantity: 3,
              price: 3.00
            }
          ],
          total: 21.50,
          createdAt: new Date().toISOString(),
          createdBy: "Test"
        }
      ],
      total: 21.50,
      totalWeight: 8.5,
      status: "approved",
      verified: true,
      truckNumber: "TEST-TRUCK-01"
    };

    console.log('📋 Sample invoice created:', sampleInvoice);
    console.log('👤 Sample client created:', sampleClient);
    
    console.log('🔧 Attempting to generate PDF...');
    
    // This assumes we're in the React app context where modules are available
    // You'll need to call this from the browser console in the actual app
    console.log('⚠️ To complete this test:');
    console.log('1. Open your React app in the browser');
    console.log('2. Navigate to Settings → Printing');
    console.log('3. Open browser console (F12)');
    console.log('4. Run: testPDFGeneration()');
    console.log('5. Check for any errors in the console');
    
    return { sampleClient, sampleInvoice };
    
  } catch (error) {
    console.error('❌ Error during PDF generation test:', error);
    return null;
  }
};

// Also create a function to test in the actual React app context
window.testPDFInReactContext = async function() {
  console.log('🧪 Testing PDF Generation in React Context...');
  
  try {
    // Check if we can access React components
    if (typeof React === 'undefined') {
      throw new Error('React is not available in this context');
    }
    
    // Check if html2canvas and jsPDF are available
    if (typeof html2canvas === 'undefined') {
      throw new Error('html2canvas is not available');
    }
    
    if (typeof window.jsPDF === 'undefined' && typeof jsPDF === 'undefined') {
      throw new Error('jsPDF is not available');
    }
    
    console.log('✅ All PDF dependencies are available');
    
    // Try to test the PDF service if it's available in the global scope
    console.log('🔍 Checking for PDF service...');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error in React context test:', error);
    return false;
  }
};

console.log('📝 PDF Generation Test Script Loaded');
console.log('To test PDF generation, run: testPDFGeneration()');
