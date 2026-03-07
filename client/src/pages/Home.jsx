import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FiArrowRight, FiShield, FiTruck, FiGift } from "react-icons/fi";
import { useAuth } from "../hooks/useAuth";

const features = [
  {
    icon: <FiShield />,
    title: "Verified Quality",
    desc: "Kila bidhaa inapitia quality check kabla ya kufika kwa mteja.",
  },
  {
    icon: <FiTruck />,
    title: "Reliable Delivery",
    desc: "Order assignment na rider workflow inafanya delivery kuwa ya uhakika.",
  },
  {
    icon: <FiGift />,
    title: "Premium Selection",
    desc: "Collections zilizoandaliwa kwa style ya kisasa na matumizi ya kila siku.",
  },
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="w-full overflow-hidden bg-slate-950 text-slate-100">
      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(251,113,133,0.35),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(244,114,182,0.3),transparent_35%),linear-gradient(130deg,#020617_10%,#111827_60%,#1f2937_100%)]" />

        <div className="relative max-w-7xl mx-auto px-4 md:px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <span className="inline-flex items-center rounded-full border border-rose-300/40 bg-rose-200/10 px-4 py-1 text-xs uppercase tracking-[0.2em] text-rose-200">
              Fashion Commerce Platform
            </span>

            <h1 className="mt-5 text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight">
              Shop With Confidence,
              <span className="block text-rose-300">Built For Modern Women</span>
            </h1>

            <p className="mt-6 max-w-xl text-slate-300 text-base md:text-lg">
              Chagua pochi na accessories bora kwa experience ya kisasa. Ili kuendelea na shop, fungua account kwanza kisha login.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3">
              {!user ? (
                <>
                  <Link to="/register" className="btn-primary inline-flex items-center justify-center gap-2">
                    Jisajili Kwanza <FiArrowRight />
                  </Link>
                  <Link to="/login" className="btn-secondary inline-flex items-center justify-center gap-2 bg-white/10 text-white border border-white/20 hover:bg-white/20">
                    Tayari Nina Account
                  </Link>
                </>
              ) : (
                <Link to="/shop" className="btn-primary inline-flex items-center justify-center gap-2">
                  Endelea Shop <FiArrowRight />
                </Link>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative"
          >
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-4 backdrop-blur-xl shadow-2xl shadow-black/40">
              <div className="aspect-[4/5] rounded-[1.5rem] bg-[linear-gradient(155deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] border border-white/10 flex items-center justify-center">
                <img src="/images/hero-bag.png" alt="Rihan Collection" className="h-[82%] object-contain drop-shadow-2xl" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-slate-50 text-slate-900 py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8">
            {features.map((item, index) => (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition"
              >
                <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center text-xl">
                  {item.icon}
                </div>
                <h3 className="mt-4 text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
