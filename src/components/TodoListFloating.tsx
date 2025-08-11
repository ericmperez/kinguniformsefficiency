import React, { useState, useEffect, useRef } from 'react';
import UserTagInput from './UserTagInput';
import { getUsers } from '../services/firebaseService';
import { UserRecord } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';

interface TodoItem {
  id: string; // Firestore doc id
  text: string;
  done: boolean;
  readBy?: string[]; // user IDs who have read this todo
  createdAt: number;
  createdBy?: string; // User ID who created the todo
  createdByUsername?: string; // Username who created the todo
}

const TODOS_COLLECTION = 'todos';
const LOCAL_STORAGE_KEY = 'floating_todo_list';

const TodoListFloating: React.FC = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false); // Start closed by default
  const [position, setPosition] = useState({ x: 40, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);
  const notificationTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) setTodos(JSON.parse(saved));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  // Fetch all users on mount
  useEffect(() => {
    getUsers().then(setAllUsers);
  }, []);

  // Firestore real-time sync
  useEffect(() => {
    const q = query(collection(db, TODOS_COLLECTION), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setTodos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TodoItem)));
    });
    return () => unsub();
  }, []);

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    document.body.style.userSelect = 'none';
  };
  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };
    const onMouseUp = () => {
      setDragging(false);
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  // Add todo to Firestore
  const addTodo = async () => {
    if (!input.trim()) return;
    await addDoc(collection(db, TODOS_COLLECTION), {
      text: input.trim(),
      done: false,
      createdAt: Date.now(),
      createdBy: user?.id,
      createdByUsername: user?.username
    });
    setInput('');
  };

  // Toggle done in Firestore
  const toggleDone = async (id: string, done: boolean) => {
    await updateDoc(doc(db, TODOS_COLLECTION, id), { done: !done });
  };

  // Remove todo from Firestore
  const removeTodo = async (id: string) => {
    await deleteDoc(doc(db, TODOS_COLLECTION, id));
  };

  // Mark todo as read
  const markAsRead = async (todo: TodoItem) => {
    if (!userId) return;
    if (todo.readBy && todo.readBy.includes(userId)) return;
    await updateDoc(doc(db, TODOS_COLLECTION, todo.id), {
      readBy: arrayUnion(userId)
    });
  };

  // Show notification for assigned todos (but don't auto-open window anymore)
  useEffect(() => {
    if (!userId) return;
    const unreadTodos = todos.filter(todo => {
      const isTagged = todo.text.includes(`@${user.username}`);
      const isUnread = !todo.readBy || !todo.readBy.includes(userId);
      return (isTagged && isUnread) || (!isTagged && isUnread);
    });
    
    // Only show notifications, don't auto-open (TodoManager handles login screen)
    if (unreadTodos.length > 0) {
      const first = unreadTodos[0];
      if (first.text.includes(`@${user.username}`)) {
        setNotification('You have a new message for you!');
      } else {
        setNotification('There is a new message for everyone. Please mark as read.');
      }
      if (notificationTimeout.current) clearTimeout(notificationTimeout.current);
      notificationTimeout.current = setTimeout(() => setNotification(null), 6000);
    }
  }, [todos, userId, user?.username]);

  if (!isOpen) {
    return (
      <button
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          zIndex: 9999,
          background: '#0ea5e9',
          color: '#fff',
          border: 'none',
          borderRadius: '50%',
          width: 56,
          height: 56,
          fontSize: 28,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          cursor: 'pointer',
        }}
        onClick={() => setIsOpen(true)}
        title="Show Todo List"
      >
        ✓
      </button>
    );
  }

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        width: 400,
        minHeight: 140,
        background: 'linear-gradient(135deg, #fef9c3 0%, #bae6fd 60%, #fbbf24 100%)',
        border: '4px solid #0ea5e9',
        borderRadius: 22,
        boxShadow: '0 12px 40px 0 rgba(14,165,233,0.35), 0 2px 12px #fbbf24',
        zIndex: 9999,
        userSelect: dragging ? 'none' : 'auto',
        transition: 'box-shadow 0.2s',
        fontSize: 18,
        fontFamily: 'Inter, Arial, sans-serif',
        outline: '6px solid #fbbf24',
        outlineOffset: '-10px',
        animation: 'todo-float-pop 0.7s cubic-bezier(.68,-0.55,.27,1.55) 1',
        boxSizing: 'border-box',
        filter: 'drop-shadow(0 0 24px #0ea5e9)',
        animationName: 'todo-float-pop, todo-glow',
        animationDuration: '0.7s, 2.5s',
        animationIterationCount: '1, infinite',
        animationTimingFunction: 'cubic-bezier(.68,-0.55,.27,1.55), ease-in-out',
      }}
    >
      <style>{`
        @keyframes todo-float-pop {
          0% { transform: scale(0.7) translateY(40px); opacity: 0; }
          60% { transform: scale(1.08) translateY(-8px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes todo-glow {
          0% { box-shadow: 0 0 24px 4px #0ea5e9, 0 2px 12px #fbbf24; }
          50% { box-shadow: 0 0 48px 12px #fbbf24, 0 2px 24px #0ea5e9; }
          100% { box-shadow: 0 0 24px 4px #0ea5e9, 0 2px 12px #fbbf24; }
        }
        .todo-bounce {
          animation: todo-bounce 0.7s cubic-bezier(.68,-0.55,.27,1.55) 1;
        }
        @keyframes todo-bounce {
          0% { transform: scale(1) translateY(0); }
          30% { transform: scale(1.08) translateY(-8px); }
          60% { transform: scale(0.98) translateY(4px); }
          100% { transform: scale(1) translateY(0); }
        }
        .todo-header-sticky {
          position: sticky;
          top: 0;
          z-index: 2;
        }
      `}</style>
      <div
        className="todo-header-sticky"
        style={{
          cursor: 'move',
          background: 'linear-gradient(90deg, #0ea5e9 60%, #fbbf24 100%)',
          color: '#fff',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: '18px 22px',
          fontWeight: 900,
          fontSize: 26,
          letterSpacing: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 16px #bae6fd',
        }}
        onMouseDown={onMouseDown}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 32, marginRight: 10, filter: 'drop-shadow(0 0 6px #fbbf24)' }}>📝</span> Todo List
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 32,
            cursor: 'pointer',
            marginLeft: 10,
            fontWeight: 900,
            transition: 'color 0.2s',
          }}
          title="Hide Todo List"
        >
          ×
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {(user?.role === 'Supervisor' || user?.role === 'Admin' || user?.role === 'Owner') && (
            <>
              <UserTagInput
                value={input}
                onChange={setInput}
                placeholder="Add a todo and tag users with @..."
              />
              <button
                onClick={addTodo}
                style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 18 }}
              >
                Add
              </button>
            </>
          )}
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 240, overflowY: 'auto' }}>
          {todos.length === 0 && <li style={{ color: '#888', textAlign: 'center', marginTop: 18 }}>No todos yet.</li>}
          {todos.map(todo => {
            const isTagged = user && todo.text.includes(`@${user.username}`);
            const isUnread = userId && (!todo.readBy || !todo.readBy.includes(userId));
            const canWrite = user?.role === 'Supervisor' || user?.role === 'Admin' || user?.role === 'Owner';
            return (
              <li
                key={todo.id}
                className={isTagged || isUnread ? 'todo-bounce' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 8,
                  background: isTagged ? '#fef08a' : isUnread ? '#bae6fd' : undefined,
                  border: isTagged ? '2.5px solid #eab308' : isUnread ? '2.5px solid #0ea5e9' : undefined,
                  borderRadius: isTagged || isUnread ? 10 : undefined,
                  boxShadow: isTagged ? '0 2px 8px #fde047' : isUnread ? '0 2px 8px #bae6fd' : undefined,
                  fontWeight: isTagged ? 800 : isUnread ? 700 : undefined,
                  color: isTagged ? '#b45309' : isUnread ? '#0369a1' : undefined,
                  padding: isTagged || isUnread ? '8px 6px' : undefined,
                  transition: 'all 0.2s',
                }}
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggleDone(todo.id, todo.done)}
                  style={{ marginRight: 10 }}
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? '#aaa' : isTagged ? '#b45309' : isUnread ? '#0369a1' : '#222' }}>
                    {todo.text}
                    {isTagged && <span style={{ marginLeft: 10, background: '#fde047', color: '#b45309', borderRadius: 5, padding: '0 8px', fontWeight: 900 }}>For you!</span>}
                    {!isTagged && isUnread && (
                      <button
                        onClick={() => markAsRead(todo)}
                        style={{ marginLeft: 14, background: '#fbbf24', color: '#78350f', border: 'none', borderRadius: 5, padding: '3px 10px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}
                      >
                        Mark as read
                      </button>
                    )}
                  </span>
                  <small style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>
                    👤 {todo.createdByUsername || 'Unknown'} • 📅 {new Date(todo.createdAt).toLocaleString()}
                  </small>
                </div>
                {canWrite && (
                  <button
                    onClick={() => removeTodo(todo.id)}
                    style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: 20, marginLeft: 10, cursor: 'pointer' }}
                    title="Remove"
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {notification && (
        <div style={{
          position: 'fixed',
          top: 24,
          right: 24,
          zIndex: 10000,
          background: '#fbbf24',
          color: '#78350f',
          padding: '18px 36px',
          borderRadius: 14,
          fontWeight: 900,
          fontSize: 20,
          boxShadow: '0 6px 32px #fbbf24',
          border: '2.5px solid #f59e1a',
          animation: 'todo-bounce 0.7s cubic-bezier(.68,-0.55,.27,1.55) 1',
        }}>
          {notification}
        </div>
      )}
    </div>
  );
};

export default TodoListFloating;
