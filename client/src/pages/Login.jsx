import { useState } from "react";
import { motion } from "framer-motion";
import { FiEye, FiEyeOff } from "react-icons/fi";
import api from "../utils/axios";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link, useLocation } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;
  const infoMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });
      const { _id, name, email: em, role, token } = res.data;

      login({
        user: { _id, name, email: em, role },
        token,
      });

      if (from) {
        navigate(from, { replace: true });
        return;
      }

      switch (role) {
        case "admin":
          navigate("/admin", { replace: true });
          break;
        case "rider":
          navigate("/rider", { replace: true });
          break;
        case "vendor":
          navigate("/vendor", { replace: true });
          break;
        default:
          navigate("/shop", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#020617_0%,#111827_45%,#3b0764_100%)] px-4 py-12">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/30">
        <aside className="hidden lg:flex flex-col justify-between bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.35),transparent_45%),#0f172a] p-10 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-200">Ecommerce</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">Secure Access To Premium Shop</h1>
            <p className="mt-4 text-slate-300">Log in to access the product catalog, cart, checkout, and order tracking.</p>
          </div>
          <p className="text-sm text-slate-400">Commerce platform with role-based access and modern delivery workflow.</p>
        </aside>

        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white p-6 md:p-10"
        >
          <h2 className="text-3xl font-black text-slate-900">Welcome Back</h2>
          <p className="mt-1 text-slate-500">Sign in to continue shopping.</p>

          {infoMessage && (
            <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {infoMessage}
            </p>
          )}

          {error && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  className="input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 text-slate-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full btn-primary rounded-xl py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="mt-4 text-right text-sm">
            <Link to="/forgot-password" className="font-semibold text-rose-600 hover:text-rose-700">
              Forgot password?
            </Link>
          </p>

          <p className="text-center mt-5 text-sm text-slate-600">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-rose-600 hover:text-rose-700">
              Register
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
