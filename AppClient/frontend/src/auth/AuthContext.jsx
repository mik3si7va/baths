import { createContext, useContext, useMemo, useState } from "react";
import users from "./users.json";

const STORAGE_KEY = "bt-client-session";
const AuthContext = createContext(null);

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const value = useMemo(
    () => ({
      user,
      login: ({ email, password }) => {
        const normalizedEmail = email.trim().toLowerCase();
        const validUser = users.find(
          (candidate) =>
            candidate.email.toLowerCase() === normalizedEmail &&
            candidate.password === password,
        );

        if (!validUser) {
          throw new Error("Email ou palavra-passe invalidos.");
        }

        const session = {
          name: validUser.name,
          email: validUser.email,
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        setUser(session);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
