/**
 * Script to create a test todo for verifying the modal implementation
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (you'll need to set up your credentials)
// This script assumes you have Firebase Admin SDK credentials configured

const serviceAccount = require('./path/to/your/serviceAccountKey.json'); // Update this path

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Update with your project details
  databaseURL: "https://your-project-id.firebaseio.com"
});

const db = admin.firestore();

async function createTestTodo() {
  try {
    // Create a general todo (no @ mention, should show to all users)
    const generalTodo = {
      text: "Test general message - This is a test todo for all users",
      done: false,
      createdAt: Date.now(),
      createdByUsername: "Test System"
    };

    // Create a tagged todo (with @ mention)
    const taggedTodo = {
      text: "Test @username message - This todo is tagged for a specific user",
      done: false,
      createdAt: Date.now(),
      createdByUsername: "Test System"
    };

    // Add both todos to Firestore
    const generalRef = await db.collection('todos').add(generalTodo);
    const taggedRef = await db.collection('todos').add(taggedTodo);

    console.log('✅ Test todos created successfully!');
    console.log(`General todo ID: ${generalRef.id}`);
    console.log(`Tagged todo ID: ${taggedRef.id}`);
    
    console.log('\n🧪 Test what you should see:');
    console.log('1. Login to the app');
    console.log('2. You should see a todo modal popup automatically');
    console.log('3. The modal should contain the test messages');
    console.log('4. Test the acknowledge, mark as done, and skip buttons');
    
    console.log('\n🧹 To clean up test data:');
    console.log('Delete the todos from Firebase console or create a cleanup script');

  } catch (error) {
    console.error('❌ Error creating test todos:', error);
  }
}

// Uncomment the line below and run: node create-test-todo.js
// createTestTodo();

console.log('📝 To use this script:');
console.log('1. Update the serviceAccount path with your Firebase credentials');
console.log('2. Update the databaseURL with your project details');
console.log('3. Uncomment the createTestTodo() call at the bottom');
console.log('4. Run: node create-test-todo.js');
