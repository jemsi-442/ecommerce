import { useCart } from "../hooks/useCart";

export default function CartSummary() {
  const { cart } = useCart();

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h3 className="font-semibold text-lg mb-4 text-primary">
        Muhtasari wa Ununuzi 
      </h3>

      {cart.map((item) => (
        <div
          key={item.id}
          className="flex justify-between text-sm mb-2"
        >
          <span>{item.name} × {item.qty}</span>
          <span>TZS {item.price * item.qty}</span>
        </div>
      ))}

      <hr className="my-3" />

      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span className="text-primary">TZS {total}</span>
      </div>
    </div>
  );
}
