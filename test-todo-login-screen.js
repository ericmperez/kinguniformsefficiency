/**
 * Test Todo Creation Script
 * 
 * This script helps test the todo login screen by creating test todos
 * Run this in the browser console after logging in
 */

// Function to create a test todo
const createTestTodo = async (message, isTagged = false, username = 'testuser') => {
  try {
    // Get Firebase references from the global scope
    const { collection, addDoc } = window.firestoreLib || await import('firebase/firestore');
    const db = window.db;
    
    if (!db) {
      console.error('Firebase not initialized. Make sure you are on the app page.');
      return;
    }

    const todoText = isTagged ? `${message} @${username}` : message;
    
    const todoData = {
      text: todoText,
      done: false,
      createdAt: Date.now(),
      createdByUsername: 'Test System'
    };

    const docRef = await addDoc(collection(db, 'todos'), todoData);
    console.log('✅ Test todo created with ID:', docRef.id);
    console.log('📝 Todo text:', todoText);
    
    return docRef.id;
  } catch (error) {
    console.error('❌ Error creating test todo:', error);
  }
};

// Helper functions for easy testing
window.testTodos = {
  // Create a general todo (no @mention)
  createGeneral: (message = 'This is a test general message for everyone') => {
    return createTestTodo(message, false);
  },
  
  // Create a tagged todo for a specific user
  createTagged: (username, message = 'This is a test message specifically for you') => {
    return createTestTodo(message, true, username);
  },
  
  // Instructions
  help: () => {
    console.log(`
🧪 Todo Testing Functions:

1. Create a general todo:
   testTodos.createGeneral("Your message here")

2. Create a tagged todo for specific user:
   testTodos.createTagged("username", "Your message here")

3. Examples:
   testTodos.createGeneral("Team meeting at 3 PM")
   testTodos.createTagged("john", "Please review the report")

After creating todos, refresh the page or logout/login to see the todo login screen.
    `);
  }
};

console.log('🧪 Todo Testing Functions Loaded!');
console.log('Type testTodos.help() for instructions');

export default window.testTodos;
