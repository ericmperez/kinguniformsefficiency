import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import TodoLoginScreen from './TodoLoginScreen';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  readBy?: string[];
  createdAt: number;
  createdBy?: string;
  createdByUsername?: string;
}

const TodoManager: React.FC = () => {
  const { user } = useAuth();
  const [hasPendingTodos, setHasPendingTodos] = useState(false);
  const [showTodoModal, setShowTodoModal] = useState(false);

  // Listen for pending todos and auto-show modal when todos are available
  useEffect(() => {
    if (!user?.id) {
      setHasPendingTodos(false);
      setShowTodoModal(false);
      return;
    }

    const q = query(collection(db, 'todos'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const allTodos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TodoItem));
      
      // Filter to get pending todos for this user
      const pendingTodos = allTodos.filter(todo => {
        if (todo.done) return false; // Skip completed todos
        
        // Check if this todo is relevant to the user
        const isTaggedForUser = todo.text.includes(`@${user.username}`);
        const isGeneralTodo = !todo.text.includes('@'); // No @ mentions means it's for everyone
        
        // If not relevant to this user, skip it
        if (!isTaggedForUser && !isGeneralTodo) return false;
        
        // For tagged todos (@username), always show until marked as done
        if (isTaggedForUser) return true;
        
        // For general todos, only show if user hasn't read them yet
        if (isGeneralTodo) {
          const hasRead = todo.readBy && todo.readBy.includes(user.id);
          return !hasRead;
        }
        
        return false;
      });
      
      const hasTodos = pendingTodos.length > 0;
      setHasPendingTodos(hasTodos);
      
      // Only show modal if there are actually pending todos
      if (hasTodos) {
        setShowTodoModal(true);
      } else {
        setShowTodoModal(false);
      }
    });

    return () => unsub();
  }, [user?.id, user?.username]);

  // Handle todo completion
  const handleTodoComplete = () => {
    setShowTodoModal(false);
    setHasPendingTodos(false);
  };

  // Only render the todo modal if:
  // 1. User is logged in
  // 2. There are pending todos
  // 3. Modal should be shown
  if (!user || !hasPendingTodos || !showTodoModal) {
    return null;
  }

  return (
    <TodoLoginScreen
      onComplete={handleTodoComplete}
      show={showTodoModal}
    />
  );
};

export default TodoManager;
