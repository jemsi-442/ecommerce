import { useState } from "react";
import { motion } from "framer-motion";
import api from "../utils/axios";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/register", { name, email, password });
      const { _id, name: n, email: em, role, token } = res.data;

      login({
        user: { _id, name: n, email: em, role },
        token,
      });

      switch (role) {
        case "admin":
          navigate("/admin", { replace: true });
          break;
        case "rider":
          navigate("/rider", { replace: true });
          break;
        default:
          navigate("/shop", { replace: true });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Imeshindikana kusajili account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#1f2937_0%,#312e81_40%,#be185d_100%)] px-4 py-12">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-2 rounded-3xl overflow-hidden border border-white/15 shadow-2xl shadow-black/30">
        <aside className="hidden lg:flex flex-col justify-between bg-[radial-gradient(circle_at_bottom_left,rgba(251,113,133,0.35),transparent_40%),#111827] p-10 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-rose-200">Create Account</p>
            <h1 className="mt-4 text-4xl font-black leading-tight">Start Shopping The Right Way</h1>
            <p className="mt-4 text-slate-300">Baada ya kusajili na login, utapata access ya full shop, cart na order history.</p>
          </div>
          <p className="text-sm text-slate-400">Built for secure user-first commerce workflow.</p>
        </aside>

        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-white p-6 md:p-10"
        >
          <h2 className="text-3xl font-black text-slate-900">Create Your Account</h2>
          <p className="mt-1 text-slate-500">Jaza taarifa zako kisha uende shop moja kwa moja.</p>

          {error && (
            <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium text-slate-700">Full name</label>
              <input
                type="text"
                placeholder="Jina lako"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
              <input
                type="password"
                placeholder="At least 6 characters"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              disabled={loading}
              className="w-full btn-primary rounded-xl py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Inatengeneza account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center mt-5 text-sm text-slate-600">
            Tayari una account?{" "}
            <Link to="/login" className="font-semibold text-rose-600 hover:text-rose-700">
              Login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
