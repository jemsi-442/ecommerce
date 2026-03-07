import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../utils/axios";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Reset token is missing.");
      return;
    }

    if (password.length < 6) {
      setError("Password lazima iwe angalau characters 6.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords hazifanani.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/auth/reset-password", { token, password });
      setMessage(data.message || "Password updated successfully.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#0f172a_0%,#1e1b4b_50%,#be185d_100%)] px-4 py-12">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-white/15 shadow-2xl shadow-black/30">
        <aside className="hidden lg:flex flex-col justify-between bg-[radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.35),transparent_42%),#111827] p-10 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-200">Set New Password</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">Choose A Strong New Password</h1>
            <p className="mt-4 text-slate-300">Baada ya kubadilisha password, reset link ya zamani inakuwa invalid moja kwa moja.</p>
          </div>
          <p className="text-sm text-slate-400">Use a password you can remember, but still hard to guess.</p>
        </aside>

        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white p-6 md:p-10"
        >
          <h2 className="text-3xl font-black text-slate-900">Reset Password</h2>
          <p className="mt-1 text-slate-500">Weka password mpya ya account yako.</p>

          {error && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          {message && (
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
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

            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your new password"
                  className="input pr-12"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 text-slate-500"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full btn-primary rounded-xl py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Inabadilisha..." : "Update Password"}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-slate-600">
            Rudi kwenye{" "}
            <Link to="/login" className="font-semibold text-rose-600 hover:text-rose-700">
              Login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
