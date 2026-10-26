import React from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { loginPath } from "./lib/authRedirect";

import ProviderOnboarding from "./pages/ProviderOnboarding";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Home from "./pages/Home";
import CategoryDetail from "./pages/CategoryDetail";
import ProviderDetail from "./pages/ProviderDetail";
import Profile from "./pages/Profile";
import DeleteAccount from "./pages/DeleteAccount";
import ProviderOrderView from "./pages/ProviderOrderView";
import ListingForm from "./pages/ListingForm";
import SearchResults from "./pages/SearchResults";
import Cart from "./pages/Cart";
import Ride from "./pages/Ride";
import Shop from "./pages/Shop";
import ShopAllCategories from "./pages/ShopAllCategories";
import ShopCollection from "./pages/ShopCollection";
import ProductDetail from "./pages/ProductDetail";
import MyOrders from "./pages/MyOrders";
import Services from "./pages/Services";
import ServiceBrowse from "./pages/ServiceBrowse";
import BusHome from "./pages/bus/BusHome";
import BusSearch from "./pages/bus/BusSearch";
import BusParks from "./pages/bus/BusParks";
import BusPark from "./pages/bus/BusPark";
import BusTrip from "./pages/bus/BusTrip";
import BusTickets from "./pages/bus/BusTickets";
import BusTicket from "./pages/bus/BusTicket";
import BusOnboarding from "./pages/bus/BusOnboarding";
import BusOperatorLogin from "./pages/bus/BusOperatorLogin";
import BusOperatorPortal from "./pages/bus/BusOperatorPortal";

// Pages that only make sense signed in: if the API rejects the saved token there, go to sign-in and come back
// afterwards, instead of leaving a bare "Unauthorized" under a header that still says "Log out".
const SIGNED_IN_ONLY = ["/profile", "/orders", "/welcome"];

function SessionGuard() {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    const onExpired = () => {
      if (SIGNED_IN_ONLY.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
        navigate(loginPath(location), { replace: true });
      }
    };
    window.addEventListener("gabla-session-expired", onExpired);
    return () => window.removeEventListener("gabla-session-expired", onExpired);
  }, [location, navigate]);
  return null;
}

export default function App() {
  return (
    <>
    <SessionGuard />
    <Routes>
      <Route path="/provider/onboarding" element={<ProviderOnboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/home" element={<Home />} />
      <Route path="/category/:categoryId" element={<CategoryDetail />} />
      <Route path="/provider/:providerId" element={<ProviderDetail />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/orders/:orderId" element={<ProviderOrderView />} />
      <Route path="/account/delete" element={<DeleteAccount />} />
      <Route path="/profile/listings/new" element={<ListingForm />} />
      <Route path="/profile/listings/:listingId/edit" element={<ListingForm />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/orders" element={<MyOrders />} />
      <Route path="/services" element={<Services />} />
      <Route path="/services/all" element={<ServiceBrowse />} />
      <Route path="/services/c/:categoryId" element={<ServiceBrowse />} />
      <Route path="/ride" element={<Ride />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/shop/categories" element={<ShopAllCategories />} />
      <Route path="/shop/new-arrivals" element={<ShopCollection collection="new" />} />
      <Route path="/shop/best-sellers" element={<ShopCollection collection="bestsellers" />} />
      <Route path="/shop/all" element={<ShopCollection collection="all" />} />
      <Route path="/shop/product/:listingId" element={<ProductDetail />} />
      <Route path="/shop/:categoryId" element={<Shop />} />
      <Route path="/bus" element={<BusHome />} />
      <Route path="/bus/search" element={<BusSearch />} />
      <Route path="/bus/parks" element={<BusParks />} />
      <Route path="/bus/parks/:slug" element={<BusPark />} />
      <Route path="/bus/trip/:tripId" element={<BusTrip />} />
      <Route path="/bus/tickets" element={<BusTickets />} />
      <Route path="/bus/tickets/:ticketNumber" element={<BusTicket />} />
      <Route path="/bus/onboarding" element={<BusOnboarding />} />
      <Route path="/bus/operator/login" element={<BusOperatorLogin />} />
      <Route path="/bus/operator/*" element={<BusOperatorPortal />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
    </>
  );
}
