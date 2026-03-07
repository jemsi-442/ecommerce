import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FiMinus, FiPlus, FiTrash2, FiShoppingCart, FiArrowRight } from "react-icons/fi";
import { useCart } from "../hooks/useCart";

export default function Cart() {
  const { cart, removeFromCart, updateQty, clearCart } = useCart();

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
    const delivery = subtotal > 150000 ? 0 : 5000;
    const total = subtotal + delivery;

    return { subtotal, delivery, total };
  }, [cart]);

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="max-w-3xl mx-auto rounded-3xl border border-slate-200 bg-white p-10 md:p-14 text-center shadow-sm">
          <FiShoppingCart className="mx-auto text-5xl text-slate-400 mb-4" />
          <h2 className="text-3xl font-black text-slate-900">Cart yako iko tupu</h2>
          <p className="text-slate-500 mt-3">Ongeza bidhaa kutoka shop kwanza.</p>
          <Link to="/shop" className="inline-flex mt-7 items-center gap-2 btn-primary">
            Rudi Shop <FiArrowRight />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 md:px-6 py-8 md:py-12">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-6 md:gap-8">
        <section className="lg:col-span-2">
          <div className="rounded-2xl bg-white border border-slate-200 p-5 md:p-6 shadow-sm">
            <h1 className="text-2xl md:text-3xl font-black text-slate-900">Shopping Cart</h1>
            <p className="mt-1 text-slate-500">Kagua bidhaa zako kabla ya checkout.</p>

            <div className="mt-6 space-y-4">
              {cart.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4 md:p-5 grid sm:grid-cols-[120px_1fr] gap-4"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    onError={(e) => {
                      e.currentTarget.src = "/images/placeholder-bag.svg";
                    }}
                    className="w-full h-32 sm:h-28 object-cover rounded-xl"
                  />

                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{item.name}</h3>
                        {item.variant && <p className="text-sm text-slate-500">{item.variant.name}</p>}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-9 h-9 rounded-full border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200"
                        aria-label="remove item"
                      >
                        <FiTrash2 className="mx-auto" />
                      </button>
                    </div>

                    <p className="mt-2 text-rose-600 font-extrabold">TZS {Number(item.price).toLocaleString()}</p>

                    <div className="mt-4 flex items-center justify-between">
                      <div className="inline-flex items-center border border-slate-300 rounded-xl overflow-hidden">
                        <button onClick={() => updateQty(item.id, item.qty - 1)} className="px-3 py-2 hover:bg-slate-100">
                          <FiMinus />
                        </button>
                        <span className="px-4 font-semibold text-slate-800">{item.qty}</span>
                        <button onClick={() => updateQty(item.id, item.qty + 1)} className="px-3 py-2 hover:bg-slate-100">
                          <FiPlus />
                        </button>
                      </div>

                      <p className="text-sm text-slate-500">Item total: <span className="font-semibold text-slate-800">TZS {(Number(item.price) * Number(item.qty)).toLocaleString()}</span></p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside>
          <div className="rounded-2xl bg-white border border-slate-200 p-5 md:p-6 shadow-sm sticky top-24">
            <h2 className="text-xl font-black text-slate-900">Order Summary</h2>

            <div className="mt-5 space-y-3 text-slate-700 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>TZS {totals.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{totals.delivery === 0 ? "FREE" : `TZS ${totals.delivery.toLocaleString()}`}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-black text-slate-900">
                <span>Total</span>
                <span className="text-rose-600">TZS {totals.total.toLocaleString()}</span>
              </div>
            </div>

            <Link to="/checkout" className="mt-6 w-full btn-primary inline-flex items-center justify-center gap-2">
              Endelea Checkout <FiArrowRight />
            </Link>

            <button onClick={clearCart} className="mt-3 w-full btn-secondary">
              Clear cart
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
