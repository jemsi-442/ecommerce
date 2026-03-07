import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiClock } from "react-icons/fi";
import api from "../utils/axios";
import OrderCard from "../components/OrderCard";
import { extractList } from "../utils/apiShape";

export default function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    api
      .get("/orders/my")
      .then((res) => {
        setOrders(extractList(res.data, ["orders", "items"]));
      })
      .catch(() => {
        setOrders([]);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm"
        >
          <h1 className="text-3xl font-black text-slate-900">My Orders</h1>
          <p className="mt-1 text-slate-500">Fuatilia order history yako na status zake.</p>
        </motion.div>

        <div className="mt-6 grid gap-4">
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              <FiClock className="mx-auto text-3xl mb-3" />
              Bado huja-order chochote.
            </div>
          ) : (
            orders.map((order) => <OrderCard key={order._id} order={order} />)
          )}
        </div>
      </div>
    </div>
  );
}
