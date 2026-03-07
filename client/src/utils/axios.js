import axios from "axios";

// Base URL fallback to localhost for dev
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const instance = axios.create({
  baseURL,
  withCredentials: true, // optional if backend uses cookies
});

// Request interceptor: attach token
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // JWT stored in localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor (optional: handle errors globally)
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Example: handle 401 globally
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login"; // redirect to login
    }
    return Promise.reject(error);
  }
);

export default instance;
