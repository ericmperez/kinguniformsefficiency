import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { getUsers, startUserSession, endUserSession, updateUserActivity } from "../services/firebaseService";

export type UserRole = "Employee" | "Supervisor" | "Admin" | "Owner" | "Driver";

interface AuthUser {
  id: string;
  role: UserRole;
  username: string;
  allowedComponents?: import("../permissions").AppComponentKey[];
  defaultPage?: import("../permissions").AppComponentKey;
  logoutTimeout?: number;
  sessionId?: string; // Track current session ID
}

interface AuthContextType {
  user: AuthUser | null;
  login: (id: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser());
  const [users, setUsers] = useState<any[]>([]); // Store all users in state
  const activityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time Firestore listener for users (only if authenticated)
  React.useEffect(() => {
    if (!user) return; // Only subscribe if logged in
    let unsub: (() => void) | undefined;
    (async () => {
      const { collection, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      unsub = onSnapshot(collection(db, "users"), (snapshot) => {
        setUsers(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      });
    })();
    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  // Track user activity periodically
  useEffect(() => {
    if (!user?.sessionId) return;

    // Update activity every 30 seconds for active sessions
    const interval = setInterval(() => {
      updateUserActivity(user.sessionId!).catch(console.error);
    }, 30000);

    activityIntervalRef.current = interval;

    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
      }
    };
  }, [user?.sessionId]);

  // Track user interactions on any user activity
  useEffect(() => {
    if (!user?.sessionId) return;

    const handleUserInteraction = () => {
      updateUserActivity(user.sessionId!).catch(console.error);
    };

    // Listen for various user interactions
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    
    // Throttle to avoid excessive calls
    let lastUpdate = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastUpdate > 10000) { // Update at most every 10 seconds
        lastUpdate = now;
        handleUserInteraction();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, throttledHandler, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandler);
      });
    };
  }, [user?.sessionId]);

  const login = async (id: string) => {
    if (!/^\d{4}$/.test(id)) return false;
    // Use real-time users state if available
    const userList = users.length > 0 ? users : await getUsers();
    const found = userList.find((u: any) => u.id === id);
    if (!found) return false;
    // Owner must be 1991 (enforced by user creation UI, but double check)
    if (found.role === "Owner" && id !== "1991") return false;
    
    try {
      // Start a new user session
      const sessionId = await startUserSession(id, found.username);
      
      const userObj: AuthUser = {
        id,
        role: found.role as UserRole,
        username: found.username,
        allowedComponents: found.allowedComponents,
        defaultPage: found.defaultPage,
        logoutTimeout: found.logoutTimeout || 20,
        sessionId,
      };
      
      setUser(userObj);
      localStorage.setItem("auth_user", JSON.stringify(userObj));
      return true;
    } catch (error) {
      console.error("Error starting user session:", error);
      return false;
    }
  };

  const logout = () => {
    if (user?.sessionId) {
      // End the current session
      endUserSession(user.sessionId, user.username).catch(console.error);
    }
    
    // Clear activity interval
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
    
    setUser(null);
    localStorage.removeItem("auth_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export { AuthContext };
