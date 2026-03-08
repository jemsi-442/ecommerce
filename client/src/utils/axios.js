import axios from "axios";

const PRODUCTION_API_URL = "https://perceptive-enthusiasm-production-9455.up.railway.app/api";
const baseURL = import.meta.env.VITE_API_URL || PRODUCTION_API_URL;

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
