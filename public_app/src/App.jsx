import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProviderOnboarding from "./pages/ProviderOnboarding";
import Login from "./pages/Login";
import Welcome from "./pages/Welcome";
import Home from "./pages/Home";
import CategoryDetail from "./pages/CategoryDetail";
import ProviderDetail from "./pages/ProviderDetail";
import Profile from "./pages/Profile";
import ListingForm from "./pages/ListingForm";
import SearchResults from "./pages/SearchResults";
import Cart from "./pages/Cart";
import Ride from "./pages/Ride";
import Shop from "./pages/Shop";
import ShopAllCategories from "./pages/ShopAllCategories";
import ShopCollection from "./pages/ShopCollection";
import ProductDetail from "./pages/ProductDetail";
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

export default function App() {
  return (
    <Routes>
      <Route path="/provider/onboarding" element={<ProviderOnboarding />} />
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/home" element={<Home />} />
      <Route path="/category/:categoryId" element={<CategoryDetail />} />
      <Route path="/provider/:providerId" element={<ProviderDetail />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/listings/new" element={<ListingForm />} />
      <Route path="/profile/listings/:listingId/edit" element={<ListingForm />} />
      <Route path="/search" element={<SearchResults />} />
      <Route path="/cart" element={<Cart />} />
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
  );
}
