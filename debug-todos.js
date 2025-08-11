/**
 * Debug script to check current todos in Firebase
 * Run this in browser console to see what todos exist
 */

// This should be run in the browser console when logged into the app
const debugTodos = async () => {
  console.log('🔍 Debugging Todo State...');
  
  // Check if Firebase and user are available
  if (typeof window === 'undefined') {
    console.log('❌ This script should be run in the browser console');
    return;
  }
  
  // Try to access the user from localStorage
  const authUser = localStorage.getItem('auth_user');
  if (!authUser) {
    console.log('❌ No user logged in');
    return;
  }
  
  const user = JSON.parse(authUser);
  console.log('👤 Current user:', user.username, '(ID:', user.id, ')');
  
  // Check if we can access Firebase from window object
  if (!window.db) {
    console.log('❌ Firebase not accessible. Make sure you are on the app page.');
    return;
  }
  
  try {
    // Get all todos from Firestore
    const { collection, getDocs, query, orderBy } = window.firestore;
    const todosQuery = query(collection(window.db, 'todos'), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(todosQuery);
    
    console.log('📋 Total todos in database:', snapshot.size);
    
    const allTodos = [];
    snapshot.forEach(doc => {
      allTodos.push({ id: doc.id, ...doc.data() });
    });
    
    console.log('📊 All todos:', allTodos);
    
    // Filter for pending todos for this user
    const pendingTodos = allTodos.filter(todo => {
      if (todo.done) return false;
      
      const isTaggedForUser = todo.text.includes(`@${user.username}`);
      const isGeneralTodo = !todo.text.includes('@');
      
      if (!isTaggedForUser && !isGeneralTodo) return false;
      
      if (isTaggedForUser) return true;
      
      if (isGeneralTodo) {
        const hasRead = todo.readBy && todo.readBy.includes(user.id);
        return !hasRead;
      }
      
      return false;
    });
    
    console.log('✅ Pending todos for', user.username + ':', pendingTodos);
    
    if (pendingTodos.length === 0) {
      console.log('🎉 No pending todos - modal should NOT appear');
    } else {
      console.log('⚠️  Found', pendingTodos.length, 'pending todos - modal WILL appear');
    }
    
  } catch (error) {
    console.error('❌ Error checking todos:', error);
  }
};

// Instructions
console.log('📝 Todo Debug Script Loaded');
console.log('To use: Run debugTodos() in the browser console while logged into the app');

// Export for use
window.debugTodos = debugTodos;
