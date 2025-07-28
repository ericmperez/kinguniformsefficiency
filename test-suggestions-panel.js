// Test script for Suggestions Panel functionality
// Run this in the browser console when logged in as user 1991 or a supervisor

console.log('🧪 Testing Suggestions Panel functionality...');

// Test 1: Check if suggestions collection exists and is accessible
async function testSuggestionsCollection() {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('./src/firebase.js');
    
    const suggestionsRef = collection(db, 'suggestions');
    const snapshot = await getDocs(suggestionsRef);
    
    console.log('✅ Suggestions collection accessible');
    console.log(`📊 Found ${snapshot.docs.length} existing suggestions`);
    
    return true;
  } catch (error) {
    console.error('❌ Error accessing suggestions collection:', error);
    return false;
  }
}

// Test 2: Check if user has proper permissions
function testUserPermissions() {
  // Get user from React context (this would be available in the actual app)
  const user = window.currentUser; // This would be set by the app
  
  if (!user) {
    console.log('⚠️  No user found - make sure you are logged in');
    return false;
  }
  
  const canSee = user.id === '1991' || ['Supervisor', 'Admin', 'Owner'].includes(user.role);
  
  if (canSee) {
    console.log(`✅ User ${user.username} (${user.role}) has suggestions panel access`);
  } else {
    console.log(`❌ User ${user.username} (${user.role}) does not have suggestions panel access`);
  }
  
  return canSee;
}

// Test 3: Test adding a sample suggestion
async function testAddSuggestion() {
  try {
    const { addSuggestion } = await import('./src/services/firebaseService.js');
    
    const testSuggestion = {
      title: 'Test Suggestion - ' + new Date().toISOString(),
      description: 'This is a test suggestion created by the test script.',
      category: 'improvement',
      priority: 'low',
      status: 'pending',
      submittedBy: 'test-user',
      submittedByName: 'Test User'
    };
    
    const suggestionId = await addSuggestion(testSuggestion);
    console.log('✅ Test suggestion added successfully with ID:', suggestionId);
    
    return suggestionId;
  } catch (error) {
    console.error('❌ Error adding test suggestion:', error);
    return null;
  }
}

// Test 4: Test updating suggestion status
async function testUpdateSuggestion(suggestionId) {
  if (!suggestionId) {
    console.log('⚠️  No suggestion ID provided for update test');
    return false;
  }
  
  try {
    const { updateSuggestion } = await import('./src/services/firebaseService.js');
    
    await updateSuggestion(suggestionId, {
      status: 'reviewed',
      reviewedBy: 'test-reviewer',
      reviewedByName: 'Test Reviewer'
    });
    
    console.log('✅ Test suggestion updated successfully');
    return true;
  } catch (error) {
    console.error('❌ Error updating test suggestion:', error);
    return false;
  }
}

// Test 5: Clean up test suggestion
async function testDeleteSuggestion(suggestionId) {
  if (!suggestionId) {
    console.log('⚠️  No suggestion ID provided for deletion test');
    return false;
  }
  
  try {
    const { deleteSuggestion } = await import('./src/services/firebaseService.js');
    
    await deleteSuggestion(suggestionId);
    console.log('✅ Test suggestion deleted successfully');
    return true;
  } catch (error) {
    console.error('❌ Error deleting test suggestion:', error);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive suggestions panel tests...\n');
  
  // Test 1: Collection access
  const collectionTest = await testSuggestionsCollection();
  if (!collectionTest) return;
  
  // Test 2: User permissions
  const permissionTest = testUserPermissions();
  if (!permissionTest) {
    console.log('ℹ️  Permission test failed - continuing with other tests anyway');
  }
  
  // Test 3: Add suggestion
  const suggestionId = await testAddSuggestion();
  if (!suggestionId) return;
  
  // Wait a moment for the suggestion to be persisted
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 4: Update suggestion
  const updateTest = await testUpdateSuggestion(suggestionId);
  if (!updateTest) return;
  
  // Wait a moment for the update to be persisted
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test 5: Delete suggestion (cleanup)
  const deleteTest = await testDeleteSuggestion(suggestionId);
  
  console.log('\n🎉 All tests completed!');
  console.log('✅ The Suggestions Panel is ready for use.');
  console.log('\nTo use the suggestions panel:');
  console.log('1. Look for the 💡 lightbulb icon in the navigation bar');
  console.log('2. Click it to open the suggestions panel');
  console.log('3. Click "New Suggestion" to submit a suggestion');
  console.log('4. Supervisors+ can manage suggestion statuses');
}

// Export functions for manual testing
window.testSuggestions = {
  runAllTests,
  testSuggestionsCollection,
  testUserPermissions,
  testAddSuggestion,
  testUpdateSuggestion,
  testDeleteSuggestion
};

console.log('📝 Test functions loaded. Run `testSuggestions.runAllTests()` to test everything.');
