import { createContext, useState, useEffect } from "react";

export const AuthContext = createContext(null);

const normalizeRole = (role) => (role === "user" ? "customer" : role);
const normalizeUser = (user) => (user ? { ...user, role: normalizeRole(user.role) } : user);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("token");
      if (storedUser && token) {
        setUser({ ...normalizeUser(JSON.parse(storedUser)), token });
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage");
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  }, []);

  const login = ({ user: u, token }) => {
    if (!u || !token) return console.error("Invalid login data");
    const normalizedUser = normalizeUser(u);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    setUser({ ...normalizedUser, token });
  };

  const updateUser = (nextUser) => {
    setUser((current) => {
      const merged = normalizeUser({ ...(current || {}), ...(nextUser || {}) });
      const token = merged?.token || current?.token || localStorage.getItem("token");

      if (token) {
        localStorage.setItem("token", token);
      }

      if (merged) {
        localStorage.setItem("user", JSON.stringify({ ...merged, token: undefined }));
        return token ? { ...merged, token } : merged;
      }

      localStorage.removeItem("user");
      return merged;
    });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
