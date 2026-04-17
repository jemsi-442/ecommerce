import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

/* Layouts */
import UserLayout from "./components/UserLayout";
import AdminLayout from "./admin/pages/AdminLayout";
import RiderLayout from "./rider/RiderLayout";
import VendorLayout from "./vendor/VendorLayout";

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
const Storefront = lazy(() => import("./pages/Storefront"));

const AdminDashboard = lazy(() => import("./admin/pages/AdminDashboard"));
const AdminOrders = lazy(() => import("./admin/pages/AdminOrders"));
const AdminProducts = lazy(() => import("./admin/pages/AdminProducts"));
const AdminUsers = lazy(() => import("./admin/pages/AdminUsers"));
const AdminNotifications = lazy(() => import("./admin/pages/AdminNotifications"));
const AdminPayouts = lazy(() => import("./admin/pages/AdminPayouts"));

const RiderDashboard = lazy(() => import("./rider/RiderDashboard"));
const RiderOrders = lazy(() => import("./rider/RiderOrders"));
const VendorDashboard = lazy(() => import("./vendor/VendorDashboard"));
const VendorProducts = lazy(() => import("./vendor/VendorProducts"));
const VendorOrders = lazy(() => import("./vendor/VendorOrders"));
const VendorProfile = lazy(() => import("./vendor/VendorProfile"));
const VendorPayouts = lazy(() => import("./vendor/VendorPayouts"));

const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-slate-500">
          Loading...
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
            path="account"
            element={
              <ProtectedRoute allowedRoles={["customer"]}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={["customer", "admin", "rider"]}>
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="stores/:slug" element={<Storefront />} />
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
          <Route path="payouts" element={<AdminPayouts />} />
        </Route>


        {/* VENDOR */}
        <Route
          path="vendor"
          element={
            <ProtectedRoute allowedRoles={["vendor"]}>
              <VendorLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<VendorDashboard />} />
          <Route path="products" element={<VendorProducts />} />
          <Route path="orders" element={<VendorOrders />} />
          <Route path="profile" element={<VendorProfile />} />
          <Route path="payouts" element={<VendorPayouts />} />
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
