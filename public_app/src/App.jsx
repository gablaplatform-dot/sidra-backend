import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import ProviderOnboarding from "./pages/ProviderOnboarding";
import Login from "./pages/Login";
import Home from "./pages/Home";
import CategoryDetail from "./pages/CategoryDetail";
import ProviderDetail from "./pages/ProviderDetail";
import Profile from "./pages/Profile";
import ListingForm from "./pages/ListingForm";
import SearchResults from "./pages/SearchResults";
import Cart from "./pages/Cart";
import Ride from "./pages/Ride";
import Shop from "./pages/Shop";

export default function App() {
  return (
    <Routes>
      <Route path="/provider/onboarding" element={<ProviderOnboarding />} />
      <Route path="/login" element={<Login />} />
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
      <Route path="/shop/:categoryId" element={<Shop />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
