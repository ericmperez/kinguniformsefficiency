import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  readBy?: string[];
  createdAt: number;
  createdBy?: string; // User ID who created the todo
  createdByUsername?: string; // Username who created the todo  
}

interface TodoLoginScreenProps {
  onComplete: () => void;
}

const TodoLoginScreen: React.FC<TodoLoginScreenProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTodoIndex, setCurrentTodoIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);

  // Get pending todos for the current user
  useEffect(() => {
    if (!user?.id) return;

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
      
      setTodos(pendingTodos);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // Mark current todo as read and move to next
  const handleAcknowledge = async () => {
    if (!user?.id || currentTodoIndex >= todos.length) return;
    
    setAcknowledging(true);
    const currentTodo = todos[currentTodoIndex];
    
    try {
      // Mark todo as read by this user
      await updateDoc(doc(db, 'todos', currentTodo.id), {
        readBy: arrayUnion(user.id)
      });
      
      // Move to next todo or complete if this was the last one
      if (currentTodoIndex + 1 >= todos.length) {
        // All todos acknowledged, proceed to main app
        onComplete();
      } else {
        setCurrentTodoIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error acknowledging todo:', error);
    } finally {
      setAcknowledging(false);
    }
  };

  // Mark current todo as done (completed) and move to next
  const handleMarkAsDone = async () => {
    if (!user?.id || currentTodoIndex >= todos.length) return;
    
    setAcknowledging(true);
    const currentTodo = todos[currentTodoIndex];
    
    try {
      // Mark todo as done (completed)
      await updateDoc(doc(db, 'todos', currentTodo.id), {
        done: true,
        readBy: arrayUnion(user.id)
      });
      
      // Move to next todo or complete if this was the last one
      if (currentTodoIndex + 1 >= todos.length) {
        // All todos processed, proceed to main app
        onComplete();
      } else {
        setCurrentTodoIndex(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error marking todo as done:', error);
    } finally {
      setAcknowledging(false);
    }
  };

  // Skip all remaining todos
  const handleSkipAll = async () => {
    if (!user?.id) return;
    
    setAcknowledging(true);
    
    try {
      // Mark all remaining todos as read by this user
      const promises = todos.slice(currentTodoIndex).map(todo =>
        updateDoc(doc(db, 'todos', todo.id), {
          readBy: arrayUnion(user.id)
        })
      );
      
      await Promise.all(promises);
      onComplete();
    } catch (error) {
      console.error('Error skipping todos:', error);
      onComplete(); // Proceed anyway on error
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ minHeight: "100vh", background: "#f8f9fa" }}
      >
        <div className="card shadow p-5 text-center" style={{ maxWidth: 500 }}>
          <div className="spinner-border text-primary mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h3 className="mb-0">Checking for messages...</h3>
        </div>
      </div>
    );
  }

  // No pending todos, show "no messages" screen
  if (todos.length === 0) {
    return (
      <div
        className="d-flex flex-column justify-content-center align-items-center"
        style={{ 
          minHeight: "100vh", 
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          position: "relative"
        }}
      >
        <div 
          className="card shadow-lg p-5 text-center" 
          style={{ 
            maxWidth: 600,
            margin: "20px",
            borderRadius: "20px",
            border: "none",
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(10px)"
          }}
        >
          {/* Header */}
          <div className="mb-4">
            <div 
              className="badge bg-success fs-6 px-3 py-2 mb-3"
              style={{ borderRadius: "20px" }}
            >
              ✅ All Caught Up!
            </div>
            <h2 className="mb-2" style={{ color: "#333", fontWeight: 700 }}>
              No New Messages
            </h2>
            <p className="text-muted mb-0">
              You're all caught up! No pending messages or tasks.
            </p>
          </div>

          {/* Content */}
          <div 
            className="p-4 mb-4" 
            style={{ 
              background: "#d4edda",
              borderRadius: "15px",
              border: "2px solid #c3e6cb",
              fontSize: "18px",
              lineHeight: "1.6"
            }}
          >
            <div style={{ color: "#155724", fontWeight: 500 }}>
              🎉 Great! You have no pending messages or tasks.<br/>
              You can proceed directly to the main application.
            </div>
          </div>

          {/* Action button */}
          <div className="d-flex justify-content-center">
            <button
              className="btn btn-primary px-4 py-2"
              onClick={onComplete}
              style={{ 
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "16px",
                minWidth: "140px"
              }}
            >
              Continue to App
            </button>
          </div>

          {/* Footer info */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid #eee" }}>
            <small className="text-muted">
              This screen appears every time you log in to check for new messages and tasks.
            </small>
          </div>
        </div>
      </div>
    );
  }

  const currentTodo = todos[currentTodoIndex];
  const isTaggedForUser = user ? currentTodo.text.includes(`@${user.username}`) : false;
  const isGeneralTodo = !currentTodo.text.includes('@'); // No @ mentions means it's for everyone
  const isAdminUser = user && ['Supervisor', 'Admin', 'Owner'].includes(user.role);
  
  // User can mark as done if: 1) They are tagged, 2) It's a general todo, or 3) They are admin
  const canMarkAsDone = isTaggedForUser || isGeneralTodo || isAdminUser;
  
  const progress = ((currentTodoIndex + 1) / todos.length) * 100;

  return (
    <div
      className="d-flex flex-column justify-content-center align-items-center"
      style={{ 
        minHeight: "100vh", 
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        position: "relative"
      }}
    >
      {/* Progress bar */}
      <div 
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "rgba(255,255,255,0.2)"
        }}
      >
        <div 
          style={{
            height: "100%",
            background: "#28a745",
            width: `${progress}%`,
            transition: "width 0.3s ease"
          }}
        />
      </div>

      <div 
        className="card shadow-lg p-5 text-center" 
        style={{ 
          maxWidth: 600,
          margin: "20px",
          borderRadius: "20px",
          border: "none",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)"
        }}
      >
        {/* Header */}
        <div className="mb-4">
          <div 
            className={`badge fs-6 px-3 py-2 mb-3 ${isTaggedForUser ? 'bg-warning text-dark' : 'bg-info text-white'}`}
            style={{ borderRadius: "20px" }}
          >
            {isTaggedForUser ? '👤 Personal Message' : '📢 Team Announcement'}
          </div>
          <h2 className="mb-2" style={{ color: "#333", fontWeight: 700 }}>
            {isTaggedForUser ? `Hello, ${user?.username}!` : 'Important Message'}
          </h2>
          <p className="text-muted mb-0">
            Message {currentTodoIndex + 1} of {todos.length}
          </p>
        </div>

        {/* Todo content */}
        <div 
          className="p-4 mb-4" 
          style={{ 
            background: isTaggedForUser ? "#fff3cd" : "#d1ecf1",
            borderRadius: "15px",
            border: `2px solid ${isTaggedForUser ? "#ffeaa7" : "#bee5eb"}`,
            fontSize: "18px",
            lineHeight: "1.6"
          }}
        >
          {/* Author and timestamp info */}
          <div className="mb-3 pb-3" style={{ borderBottom: "1px solid #ddd" }}>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center">
                <span className="badge bg-secondary me-2">
                  👤 {currentTodo.createdByUsername || 'Unknown'}
                </span>
                <small className="text-muted">
                  📅 {new Date(currentTodo.createdAt).toLocaleString()}
                </small>
              </div>
            </div>
          </div>
          
          {/* Todo message */}
          <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>
            {currentTodo.text}
          </div>
        </div>

        {/* Action buttons */}
        <div className="d-flex flex-column flex-md-row gap-3 justify-content-center">
          <button
            className="btn btn-success px-4 py-2"
            onClick={handleAcknowledge}
            disabled={acknowledging}
            style={{ 
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "16px",
              minWidth: "140px"
            }}
          >
            {acknowledging ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Processing...
              </>
            ) : (
              <>
                ✓ Acknowledge
              </>
            )}
          </button>

          {/* Only show "Mark as Done" button for users who can complete the task */}
          {canMarkAsDone && (
            <button
              className="btn btn-primary px-4 py-2"
              onClick={handleMarkAsDone}
              disabled={acknowledging}
              style={{ 
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "16px",
                minWidth: "140px"
              }}
            >
              {acknowledging ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  ✅ Mark as Done
                </>
              )}
            </button>
          )}
          
          {todos.length > 1 && (
            <button
              className="btn btn-outline-secondary px-4 py-2"
              onClick={handleSkipAll}
              disabled={acknowledging}
              style={{ 
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "16px",
                minWidth: "140px"
              }}
            >
              Skip All Remaining
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3" style={{ borderTop: "1px solid #eee" }}>
          <small className="text-muted">
            <strong>Acknowledge:</strong> Mark as read (message stays active for others)<br/>
            {canMarkAsDone && (
              <>
                <strong>Mark as Done:</strong> Complete the task (removes message for everyone)<br/>
              </>
            )}
            {!canMarkAsDone && (
              <>
                <em>Note: Only tagged users, admins, or general message recipients can mark todos as done</em><br/>
              </>
            )}
            {todos.length > 1 && `${todos.length - currentTodoIndex - 1} more message${todos.length - currentTodoIndex - 1 !== 1 ? 's' : ''} remaining.`}
          </small>
        </div>
      </div>
    </div>
  );
};

export default TodoLoginScreen;
