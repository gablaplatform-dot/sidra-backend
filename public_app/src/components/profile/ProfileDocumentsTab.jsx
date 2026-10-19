import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import DocumentStudio from "./DocumentStudio";
import IssuedDocuments from "./IssuedDocuments";

const VIEWS = [
  { key: "design" },
  { key: "issued" }
];

// Provider "Quotes & receipts": a studio to design how quotations and receipts look, and the list of everything
// issued to buyers. Both views stay mounted once opened so an unsaved design isn't lost when you peek at the list.
export default function ProfileDocumentsTab({ provider, onOpenOrder, onDirtyChange }) {
  const { t } = useTranslation();
  const [view, setView] = useState("design");
  const [visitedIssued, setVisitedIssued] = useState(false);

  const show = (next) => {
    setView(next);
    if (next === "issued") setVisitedIssued(true);
  };

  return (
    <section className="docs-tab detail-block">
      <header className="docs-head">
        <div>
          <h2>{t("profile.tabs.documents")}</h2>
          <p className="docs-head-sub">{t("docs.tab.sub")}</p>
        </div>
        <div className="docs-seg" role="tablist" aria-label={t("docs.tab.viewsAria")}>
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`docs-tab-${item.key}`}
              aria-selected={view === item.key}
              aria-controls={`docs-panel-${item.key}`}
              className={view === item.key ? "is-active" : ""}
              onClick={() => show(item.key)}
            >
              {t(`docs.tab.${item.key}`)}
            </button>
          ))}
        </div>
      </header>

      <div id="docs-panel-design" role="tabpanel" aria-labelledby="docs-tab-design" hidden={view !== "design"}>
        <DocumentStudio provider={provider} onDirtyChange={onDirtyChange} active={view === "design"} />
      </div>
      <div id="docs-panel-issued" role="tabpanel" aria-labelledby="docs-tab-issued" hidden={view !== "issued"}>
        {visitedIssued ? <IssuedDocuments onOpenOrder={onOpenOrder} active={view === "issued"} /> : null}
      </div>
    </section>
  );
}
