import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { loginPath } from "./lib/authRedirect";

const ProviderOnboarding = lazy(() => import("./pages/ProviderOnboarding"));
const Login = lazy(() => import("./pages/Login"));
const Welcome = lazy(() => import("./pages/Welcome"));
import Home from "./pages/Home";
const CategoryDetail = lazy(() => import("./pages/CategoryDetail"));
const ProviderDetail = lazy(() => import("./pages/ProviderDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const ProviderOrderView = lazy(() => import("./pages/ProviderOrderView"));
const ListingForm = lazy(() => import("./pages/ListingForm"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Cart = lazy(() => import("./pages/Cart"));
const Ride = lazy(() => import("./pages/Ride"));
const Shop = lazy(() => import("./pages/Shop"));
const ShopAllCategories = lazy(() => import("./pages/ShopAllCategories"));
const ShopCollection = lazy(() => import("./pages/ShopCollection"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Services = lazy(() => import("./pages/Services"));
const ServiceBrowse = lazy(() => import("./pages/ServiceBrowse"));
const BusHome = lazy(() => import("./pages/bus/BusHome"));
const BusSearch = lazy(() => import("./pages/bus/BusSearch"));
const BusParks = lazy(() => import("./pages/bus/BusParks"));
const BusPark = lazy(() => import("./pages/bus/BusPark"));
const BusTrip = lazy(() => import("./pages/bus/BusTrip"));
const BusTickets = lazy(() => import("./pages/bus/BusTickets"));
const BusTicket = lazy(() => import("./pages/bus/BusTicket"));
const BusOnboarding = lazy(() => import("./pages/bus/BusOnboarding"));
const BusOperatorLogin = lazy(() => import("./pages/bus/BusOperatorLogin"));
const BusOperatorPortal = lazy(() => import("./pages/bus/BusOperatorPortal"));

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
    <Suspense fallback={<div className="route-loading" role="status" aria-label="Loading"><span /></div>}>
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
    </Suspense>
    </>
  );
}
