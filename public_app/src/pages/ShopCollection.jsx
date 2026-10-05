import React, { useState } from "react";

import { clearSession, getSession } from "../lib/session";
import ShopBrowse from "./ShopBrowse";

// "View all new arrivals" / "View all best sellers": the browse page without a category.
export default function ShopCollection({ collection }) {
  const [session] = useState(() => getSession());
  const logout = () => {
    clearSession();
    window.location.reload();
  };
  return <ShopBrowse collection={collection} session={session} onLogout={logout} />;
}
