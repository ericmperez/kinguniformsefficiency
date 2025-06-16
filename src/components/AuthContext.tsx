import React, { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  user: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<string | null>(
    localStorage.getItem("auth_user") || null
  );

  const login = async (username: string, password: string) => {
    // Simple local auth: username: admin, password: password123
    if (username === "admin" && password === "password123") {
      setUser(username);
      localStorage.setItem("auth_user", username);
      return true;
    }
    return false;
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
