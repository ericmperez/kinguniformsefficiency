import React, { createContext, useContext, useState, ReactNode } from "react";
import { getUsers } from "../services/firebaseService";

export type UserRole = "Employee" | "Supervisor" | "Admin" | "Owner";

interface AuthUser {
  id: string;
  role: UserRole;
  username: string;
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

  const login = async (id: string) => {
    if (!/^\d{4}$/.test(id)) return false;
    // Fetch users from Firebase
    const users = await getUsers();
    const found = users.find(u => u.id === id);
    if (!found) return false;
    // Owner must be 1991 (enforced by user creation UI, but double check)
    if (found.role === "Owner" && id !== "1991") return false;
    const userObj: AuthUser = { id, role: found.role as UserRole, username: found.username };
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
