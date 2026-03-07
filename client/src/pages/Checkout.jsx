import { useMemo, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import api from "../utils/axios";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/useToast";

const STEPS = ["delivery", "payment", "review"];

const Checkout = () => {
  const { cart, clearCart } = useCart();
  const toast = useToast();
  const cartItems = cart;
  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);

  const [delivery, setDelivery] = useState({
    type: "home",
    address: "",
    contactPhone: "",
  });

  const [payment, setPayment] = useState({
    method: "cash",
  });

  const summary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
    const deliveryFee = delivery.type === "home" ? 3000 : 0;
    const total = subtotal + deliveryFee;
    return { subtotal, deliveryFee, total };
  }, [cartItems, delivery.type]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canContinueDelivery =
    delivery.contactPhone && (delivery.type === "pickup" || delivery.address);

  const placeOrder = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login first");
      return;
    }

    if (cartItems.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!delivery.contactPhone) {
      toast.error("Contact phone is required");
      return;
    }

    if (delivery.type === "home" && !delivery.address) {
      toast.error("Delivery address is required for home delivery");
      return;
    }

    const payload = {
      items: cartItems.map((i) => ({
        product: i.productId,
        name: i.name,
        qty: i.qty,
        price: i.price,
      })),
      delivery,
      payment,
      totalAmount: summary.total,
    };

    try {
      setPlacing(true);
      const { data } = await api.post("/orders", payload);
      toast.success("Order placed successfully");
      console.log("ORDER:", data);
      clearCart();
      setStep(0);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-3 gap-6 md:gap-8">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Checkout</h1>
          <p className="mt-1 text-slate-500">Kamilisha order yako kwa hatua chache.</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`rounded-xl border px-3 py-2 text-center text-sm font-semibold ${
                  step === i
                    ? "border-rose-300 bg-rose-50 text-rose-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                {s.toUpperCase()}
              </div>
            ))}
          </div>

          {STEPS[step] === "delivery" && (
            <div className="mt-7 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Delivery Details</h2>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Delivery type</label>
                <select
                  value={delivery.type}
                  onChange={(e) => setDelivery({ ...delivery, type: e.target.value })}
                  className="input"
                >
                  <option value="home">Deliver to my address</option>
                  <option value="pickup">Pickup at store</option>
                </select>
              </div>

              {delivery.type === "home" && (
                <div>
                  <label className="block mb-1 text-sm font-medium text-slate-700">Delivery address</label>
                  <input
                    type="text"
                    placeholder="Street, area, city"
                    className="input"
                    value={delivery.address}
                    onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Contact phone</label>
                <input
                  type="text"
                  placeholder="07xx xxx xxx"
                  className="input"
                  value={delivery.contactPhone}
                  onChange={(e) => setDelivery({ ...delivery, contactPhone: e.target.value })}
                />
              </div>

              <button onClick={next} disabled={!canContinueDelivery} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                Continue
              </button>
            </div>
          )}

          {STEPS[step] === "payment" && (
            <div className="mt-7 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Payment Method</h2>

              <div>
                <label className="block mb-1 text-sm font-medium text-slate-700">Method</label>
                <select
                  value={payment.method}
                  onChange={(e) => setPayment({ method: e.target.value })}
                  className="input"
                >
                  <option value="cash">Cash on Delivery</option>
                  <option value="mobile_money">Mobile Money (soon)</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={back} className="btn-secondary">Back</button>
                <button onClick={next} className="btn-primary">Continue</button>
              </div>
            </div>
          )}

          {STEPS[step] === "review" && (
            <div className="mt-7 space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Review Order</h2>

              <div className="rounded-xl border border-slate-200 divide-y">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center px-4 py-3 text-sm">
                    <span className="text-slate-700">{item.name} x {item.qty}</span>
                    <span className="font-semibold text-slate-900">TZS {(Number(item.price) * Number(item.qty)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={back} className="btn-secondary">Back</button>
                <button
                  onClick={placeOrder}
                  disabled={placing}
                  className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <FiCheckCircle /> {placing ? "Placing..." : "Place Order"}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm h-fit sticky top-24">
          <h3 className="text-xl font-black text-slate-900">Order Summary</h3>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>TZS {summary.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span>{summary.deliveryFee === 0 ? "FREE" : `TZS ${summary.deliveryFee.toLocaleString()}`}</span>
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between font-black text-base text-slate-900">
              <span>Total</span>
              <span className="text-rose-600">TZS {summary.total.toLocaleString()}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Checkout;
