import React, { useState } from "react";
import { useParams } from "react-router-dom";

import { clearSession, getSession } from "../lib/session";
import ShopBrowse from "./ShopBrowse";

// /services/c/:categoryId (one service category) and /services/all: the browse page for services.
export default function ServiceBrowse() {
  const { categoryId } = useParams();
  const [session] = useState(() => getSession());
  const logout = () => {
    clearSession();
    window.location.reload();
  };
  return <ShopBrowse kind="service" categoryId={categoryId} session={session} onLogout={logout} />;
}
