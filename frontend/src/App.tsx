import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminConsole from "./pages/AdminConsole";
import Browse from "./pages/Browse";
import Home from "./pages/Home";
import ListingDetail from "./pages/ListingDetail";
import ListingEdit from "./pages/ListingEdit";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import MyListings from "./pages/MyListings";
import NotFound from "./pages/NotFound";
import OrderDetail from "./pages/OrderDetail";
import Orders from "./pages/Orders";
import Register from "./pages/Register";
import Sell from "./pages/Sell";
import SellerDashboard from "./pages/SellerDashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/listing/:id" element={<ListingDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Route-protected shell for authenticated pages (orders, profile, …) */}
        <Route element={<ProtectedRoute />}>
          <Route path="/sell" element={<Sell />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:conversationId" element={<Messages />} />
          <Route path="/admin-console" element={<AdminConsole />} />
          <Route path="/seller-dashboard" element={<SellerDashboard />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/listing/:id/edit" element={<ListingEdit />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
