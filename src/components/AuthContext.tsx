import React, { createContext, useContext, useState, ReactNode } from "react";
import { getUsers } from "../services/firebaseService";

export type UserRole = "Employee" | "Supervisor" | "Admin" | "Owner";

interface AuthUser {
  id: string;
  role: UserRole;
  username: string;
  allowedComponents?: import("../permissions").AppComponentKey[];
  defaultPage?: import("../permissions").AppComponentKey;
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

  // Real-time Firestore listener for users
  React.useEffect(() => {
    const unsub = (async () => {
      const { collection, onSnapshot } = await import("firebase/firestore");
      const { db } = await import("../firebase");
      return onSnapshot(collection(db, "users"), (snapshot) => {
        setUsers(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      });
    })();
    return () => {
      unsub.then && unsub.then((u) => u && u());
    };
  }, []);

  const login = async (id: string) => {
    if (!/^\d{4}$/.test(id)) return false;
    // Use real-time users state if available
    const userList = users.length > 0 ? users : await getUsers();
    const found = userList.find((u: any) => u.id === id);
    if (!found) return false;
    // Owner must be 1991 (enforced by user creation UI, but double check)
    if (found.role === "Owner" && id !== "1991") return false;
    const userObj: AuthUser = {
      id,
      role: found.role as UserRole,
      username: found.username,
      allowedComponents: found.allowedComponents,
      defaultPage: found.defaultPage,
    };
    setUser(userObj);
    localStorage.setItem("auth_user", JSON.stringify(userObj));
    return true;
  };

  const logout = () => {
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
