import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { useTranslation } from "react-i18next";

import "./i18n";
import App from "./App.jsx";
import "@fontsource/noto-sans-ethiopic/ethiopic-400.css";
import "@fontsource/noto-sans-ethiopic/ethiopic-700.css";
import "./styles.css";
import "./bus.css";
import "./busOperator.css";
import "./orders.css";
import "./mobilehome.css";
import "./booking.css";

// Remount on language change so non-hook helpers (timeAgo, formatters) pick up the new language too.
function Root() {
  const { i18n } = useTranslation();
  return <App key={i18n.resolvedLanguage} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>
);
