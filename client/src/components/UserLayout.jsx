import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

function UserLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />
      <main className="min-h-[calc(100vh-64px)]">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export default UserLayout;
