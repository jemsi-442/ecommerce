import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiCheckCircle, FiClock, FiMapPin, FiShield, FiSmartphone, FiTruck } from "react-icons/fi";
import api from "../utils/axios";
import PaymentNetworkBadge from "../components/PaymentNetworkBadge";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/useToast";
import { MOBILE_PAYMENT_NETWORK_OPTIONS } from "../utils/paymentNetworkLogo";
import {
  detectMobileNetworkFromPhone,
  getMobileNetworkLabel,
  validatePhoneForNetwork,
} from "../utils/mobileMoneyNetworks";

const STEPS = [
  { key: "delivery", label: "Delivery", description: "Where should this order reach you?" },
  { key: "payment", label: "Payment", description: "Choose the mobile money network for your prompt." },
  { key: "review", label: "Review", description: "Confirm everything before we send the payment request." },
];

const Checkout = () => {
  const { cart, clearCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const cartItems = cart;
  const [step, setStep] = useState(0);
  const [placing, setPlacing] = useState(false);

  const [delivery, setDelivery] = useState({
    type: "home",
    address: "",
    contactPhone: "",
  });

  const [payment, setPayment] = useState({
    method: "mobile_money",
    network: MOBILE_PAYMENT_NETWORK_OPTIONS[0]?.value || "",
  });
  const inferredNetwork = detectMobileNetworkFromPhone(delivery.contactPhone);
  const inferredNetworkLabel = inferredNetwork ? getMobileNetworkLabel(inferredNetwork) : null;

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
  const canContinuePayment = payment.method !== "mobile_money" || Boolean(payment.network);
  const phoneNetworkValidation =
    payment.method === "mobile_money" && delivery.contactPhone && payment.network
      ? validatePhoneForNetwork(delivery.contactPhone, payment.network)
      : null;

  useEffect(() => {
    if (!inferredNetwork) {
      return;
    }

    setPayment((current) =>
      current.method === "mobile_money" && current.network !== inferredNetwork
        ? { ...current, network: inferredNetwork }
        : current
    );
  }, [inferredNetwork]);

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

    if (payment.method === "mobile_money" && !payment.network) {
      toast.error("Please choose a mobile money network first");
      return;
    }

    if (payment.method === "mobile_money" && phoneNetworkValidation && !phoneNetworkValidation.valid) {
      toast.error(phoneNetworkValidation.message);
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
    };

    try {
      setPlacing(true);
      const { data } = await api.post("/orders", payload);
      if (payment.method === "mobile_money" && data?.paymentIntent?.reference) {
        toast.success(data.paymentIntent.message || "Payment request sent. Check your phone.");
      } else {
        toast.success("Order placed successfully");
      }
      clearCart();
      setStep(0);
      navigate("/orders");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fffaf5_0%,#f8fafc_45%,#eef2ff_100%)] px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_50px_rgba(15,23,42,0.08)] md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A43]">Secure checkout</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 md:text-4xl">Finish your order with clearer steps and one mobile money prompt.</h1>
              <p className="mt-3 max-w-2xl text-slate-600">Confirm delivery details, match the right network to your phone number, and review everything before we send the payment request.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <TrustChip icon={FiShield} title="Protected" text="Checkout stays on secure order flow" />
              <TrustChip icon={FiSmartphone} title="Phone prompt" text="Pay through your selected network" />
              <TrustChip icon={FiTruck} title="Tracked" text="Follow payment and delivery updates" />
            </div>
          </div>
        </section>

        <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
          <section className="lg:col-span-2 rounded-[32px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.08)] md:p-7">
            <div className="grid grid-cols-3 gap-2">
              {STEPS.map((item, index) => (
                <div
                  key={item.key}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm shadow-sm transition ${
                    step === index
                      ? "border-[#102A43]/15 bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)] text-[#102A43]"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs leading-5">{item.description}</p>
                </div>
              ))}
            </div>

            {STEPS[step].key === "delivery" && (
              <div className="mt-7 space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Delivery details</h2>
                  <p className="mt-1 text-sm text-slate-500">Tell us where this order should reach you and which number should receive the payment prompt.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-sm font-semibold text-slate-700">Delivery type</span>
                    <select
                      value={delivery.type}
                      onChange={(e) => setDelivery({ ...delivery, type: e.target.value })}
                      className="input mt-2"
                    >
                      <option value="home">Deliver to my address</option>
                      <option value="pickup">Pickup at store</option>
                    </select>
                  </label>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                        <FiClock />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">What happens next</p>
                        <p className="mt-1">After this step, you will choose the network and review the exact total before payment is requested.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {delivery.type === "home" && (
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">Delivery address</label>
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
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Contact phone</label>
                  <input
                    type="text"
                    placeholder="07xx xxx xxx"
                    className="input"
                    value={delivery.contactPhone}
                    onChange={(e) => setDelivery({ ...delivery, contactPhone: e.target.value })}
                  />
                  {payment.method === "mobile_money" && inferredNetworkLabel ? (
                    <p className="mt-2 text-sm text-[#102A43]">
                      This number appears to belong to {inferredNetworkLabel}.
                    </p>
                  ) : null}
                  {payment.method === "mobile_money" && phoneNetworkValidation && !phoneNetworkValidation.valid ? (
                    <p className="mt-2 text-sm text-red-600">{phoneNetworkValidation.message}</p>
                  ) : null}
                </div>

                <button onClick={next} disabled={!canContinueDelivery} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2">
                  Continue to payment <FiArrowRight />
                </button>
              </div>
            )}

            {STEPS[step].key === "payment" && (
              <div className="mt-7 space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Payment method</h2>
                  <p className="mt-1 text-sm text-slate-500">Choose the mobile money network that matches your number so the payment prompt reaches you correctly.</p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Method</label>
                  <select
                    value={payment.method}
                    onChange={(e) =>
                      setPayment((current) => ({
                        method: e.target.value,
                        network: e.target.value === "mobile_money" ? current.network : "",
                      }))
                    }
                    className="input mt-2"
                  >
                    <option value="mobile_money">Mobile Money</option>
                  </select>
                  <p className="mt-2 text-sm text-slate-500">
                    We will send a payment prompt through Snippe after you place the order.
                  </p>
                  {payment.method === "mobile_money" && inferredNetworkLabel ? (
                    <p className="mt-2 text-sm text-[#102A43]">
                      Your network was selected automatically from your phone number: {inferredNetworkLabel}.
                    </p>
                  ) : null}
                </div>

                {payment.method === "mobile_money" ? (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Mobile money network
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {MOBILE_PAYMENT_NETWORK_OPTIONS.map((network) => {
                        const active = payment.network === network.value;

                        return (
                          <button
                            key={network.value}
                            type="button"
                            onClick={() =>
                              setPayment((current) => ({ ...current, network: network.value }))
                            }
                            className={`rounded-[24px] border px-4 py-3 text-left shadow-sm transition ${
                              active
                                ? "border-[#102A43]/15 bg-[linear-gradient(135deg,#eff6ff_0%,#fff7ed_100%)]"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <PaymentNetworkBadge
                              provider={network.value}
                              className="text-sm font-semibold text-slate-900"
                            />
                            <p className="mt-2 text-xs text-slate-500">{network.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={back} className="btn-secondary">Back</button>
                  <button
                    onClick={next}
                    disabled={!canContinuePayment}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    Continue to review <FiArrowRight />
                  </button>
                </div>
              </div>
            )}

            {STEPS[step].key === "review" && (
              <div className="mt-7 space-y-5">
                <div>
                  <h2 className="text-xl font-black text-slate-900">Review order</h2>
                  <p className="mt-1 text-sm text-slate-500">Check the basket, delivery plan, and payment route one more time before we request payment.</p>
                </div>

                <div className="rounded-[24px] border border-slate-200 divide-y bg-white">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center px-4 py-3 text-sm">
                      <span className="text-slate-700">{item.name} x {item.qty}</span>
                      <span className="font-semibold text-slate-900">TZS {(Number(item.price) * Number(item.qty)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-4 text-sm text-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Delivery plan</p>
                    <p className="mt-2 font-semibold text-slate-900">{delivery.type === 'home' ? 'Deliver to address' : 'Pickup at store'}</p>
                    <p className="mt-2 text-slate-600">{delivery.type === 'home' ? delivery.address : 'You will collect this order from the seller.'}</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-slate-600"><FiMapPin /> {delivery.contactPhone}</p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#fff7ed_100%)] px-4 py-4 text-sm text-slate-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment route</p>
                    <p className="mt-2 font-semibold text-slate-900">Mobile Money</p>
                    {payment.network ? (
                      <div className="mt-2">
                        <PaymentNetworkBadge provider={payment.network} className="font-medium text-slate-900" />
                      </div>
                    ) : null}
                    {payment.method === "mobile_money" && inferredNetworkLabel ? (
                      <p className="mt-2 text-sm text-slate-500">
                        This number is detected as {inferredNetworkLabel}.
                      </p>
                    ) : null}
                    {payment.method === "mobile_money" && phoneNetworkValidation && !phoneNetworkValidation.valid ? (
                      <p className="mt-2 text-sm text-red-600">{phoneNetworkValidation.message}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button onClick={back} className="btn-secondary">Back</button>
                  <button
                    onClick={placeOrder}
                    disabled={placing}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <FiCheckCircle /> {placing ? "Sending payment prompt..." : "Place order and send payment prompt"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <aside className="sticky top-24 h-fit space-y-4 rounded-[32px] border border-white/80 bg-white/92 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.08)] md:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-500">Quick Summary</p>
              <h3 className="mt-1 text-xl font-black text-slate-900">Order Summary</h3>
            </div>

            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-[linear-gradient(135deg,#fffaf5_0%,#f8fafc_100%)] p-4 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>TZS {summary.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <span>{summary.deliveryFee === 0 ? "FREE" : `TZS ${summary.deliveryFee.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-black text-slate-900">
                <span>Total</span>
                <span className="text-[#102A43]">TZS {summary.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 text-[#102A43]">
                  <FiShield />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Protected payment request</p>
                  <p className="mt-1">Your order is created first, then the mobile money prompt is sent to your phone.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-orange-50 p-3 text-orange-700">
                  <FiSmartphone />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">One clear confirmation step</p>
                  <p className="mt-1">Approve payment from your selected network once the prompt arrives.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                  <FiTruck />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Post-payment updates</p>
                  <p className="mt-1">You will keep seeing payment and delivery progress in your account after checkout.</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

function TrustChip({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="w-fit rounded-2xl bg-white p-3 text-[#102A43] shadow-sm">
        <Icon />
      </div>
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{text}</p>
    </div>
  );
}

export default Checkout;
