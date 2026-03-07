import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

/* Layouts */
import UserLayout from "./components/UserLayout";
import AdminLayout from "./admin/pages/AdminLayout";
import RiderLayout from "./rider/RiderLayout";

/* Route guards */
import ProtectedRoute from "./components/ProtectedRoute";

/* Pages */
const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const AdminDashboard = lazy(() => import("./admin/pages/AdminDashboard"));
const AdminOrders = lazy(() => import("./admin/pages/AdminOrders"));
const AdminProducts = lazy(() => import("./admin/pages/AdminProducts"));
const AdminUsers = lazy(() => import("./admin/pages/AdminUsers"));
const AdminNotifications = lazy(() => import("./admin/pages/AdminNotifications"));

const RiderDashboard = lazy(() => import("./rider/RiderDashboard"));
const RiderOrders = lazy(() => import("./rider/RiderOrders"));

const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Inapakia...
        </div>
      }
    >
      <Routes>
        {/* USER */}
        <Route element={<UserLayout />}>
          <Route index element={<Home />} />

          {/* Shopping area requires login */}
          <Route
            path="shop"
            element={
              <ProtectedRoute>
                <Shop />
              </ProtectedRoute>
            }
          />
          <Route
            path="product/:id"
            element={
              <ProtectedRoute>
                <ProductDetails />
              </ProtectedRoute>
            }
          />
          <Route
            path="cart"
            element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            }
          />
          <Route
            path="checkout"
            element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={["user", "admin", "rider"]}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>

        {/* ADMIN */}
        <Route
          path="admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="notifications" element={<AdminNotifications />} />
        </Route>

        {/* RIDER */}
        <Route
          path="rider"
          element={
            <ProtectedRoute allowedRoles={["rider"]}>
              <RiderLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RiderDashboard />} />
          <Route path="orders" element={<RiderOrders />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
