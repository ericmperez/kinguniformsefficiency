// Test script to verify signature saving functionality
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0h7T2Qg9T5eP9-e4Hl0TRHiRl7D6V0Ec",
  authDomain: "react-app-c0b9c.firebaseapp.com",
  projectId: "react-app-c0b9c",
  storageBucket: "react-app-c0b9c.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testSignatureUpdate() {
  console.log('🧪 Testing signature update functionality...');
  
  try {
    // First, let's find an existing invoice to test with
    console.log('📋 Looking for test invoice...');
    
    // You'll need to replace this with an actual invoice ID from your database
    const testInvoiceId = 'test-invoice-id'; // Replace with real ID
    
    const invoiceRef = doc(db, 'invoices', testInvoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      console.log('❌ Test invoice not found. Please check the invoice ID.');
      return;
    }
    
    console.log('✅ Test invoice found:', invoiceSnap.data());
    
    // Test signature update
    console.log('💾 Testing signature update...');
    
    const testSignature = {
      image: 'data:image/png;base64,test-signature-data',
      name: 'Test Receiver',
      timestamp: Timestamp.now(),
      noPersonnelAvailable: false,
    };
    
    await updateDoc(invoiceRef, {
      signature: testSignature,
      receivedBy: 'Test Receiver',
    });
    
    console.log('✅ Signature update successful!');
    
    // Verify the update
    const updatedSnap = await getDoc(invoiceRef);
    const updatedData = updatedSnap.data();
    
    if (updatedData?.signature && updatedData?.receivedBy) {
      console.log('✅ Signature data verified in database:');
      console.log('  - Receiver:', updatedData.receivedBy);
      console.log('  - Signature name:', updatedData.signature.name);
      console.log('  - No personnel flag:', updatedData.signature.noPersonnelAvailable);
    } else {
      console.log('❌ Signature data not found after update');
    }
    
  } catch (error) {
    console.error('❌ Error during signature test:', error);
    
    // Detailed error analysis
    if (error instanceof Error) {
      console.log('Error name:', error.name);
      console.log('Error message:', error.message);
      console.log('Error stack:', error.stack);
    }
  }
}

// Test "no personnel available" scenario
async function testNoPersonnelSignature() {
  console.log('\n🧪 Testing "no personnel available" signature...');
  
  try {
    const testInvoiceId = 'test-invoice-id'; // Replace with real ID
    const invoiceRef = doc(db, 'invoices', testInvoiceId);
    
    const noPersonnelSignature = {
      image: null,
      name: "No authorized personnel available at the time of delivery",
      timestamp: Timestamp.now(),
      noPersonnelAvailable: true,
    };
    
    await updateDoc(invoiceRef, {
      signature: noPersonnelSignature,
      receivedBy: "No authorized personnel available at the time of delivery",
    });
    
    console.log('✅ No personnel signature update successful!');
    
  } catch (error) {
    console.error('❌ Error during no personnel test:', error);
  }
}

// Run tests
async function runAllTests() {
  await testSignatureUpdate();
  await testNoPersonnelSignature();
  console.log('\n🎯 Test completed. Check the console output above for results.');
}

runAllTests().catch(console.error);
