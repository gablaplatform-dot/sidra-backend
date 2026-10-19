import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { request } from "../../lib/api";
import { IconBox, IconClose } from "../icons";
import { SectionSkeleton } from "../Skeleton";

// Flattens the category tree into rows with a depth for indentation, and a separate flat option
// list (root option first) for the parent picker.
const flatten = (nodes, depth = 0) =>
  nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children || [], depth + 1)]);

export default function ProfileShopCategoriesTab() {
  const { t } = useTranslation();
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const load = () => {
    setLoading(true);
    request("/shop-categories/mine")
      .then((result) => setTree(result?.items || []))
      .catch((loadError) => setError(loadError.message || t("profile.shopCats.errLoad")))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows = flatten(tree);

  const submitCreate = async (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request("/shop-categories", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), parentId: parentId || null })
      });
      setName("");
      setParentId("");
      setNotice(t("profile.shopCats.added"));
      load();
    } catch (submitError) {
      setError(submitError.message || t("profile.shopCats.errAdd"));
    } finally {
      setSaving(false);
    }
  };

  const startRename = (row) => {
    setEditingId(row.id);
    setEditingName(row.name);
  };

  const submitRename = async (id) => {
    if (!editingName.trim()) return;
    try {
      await request(`/shop-categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editingName.trim() })
      });
      setEditingId(null);
      load();
    } catch (renameError) {
      setError(renameError.message || t("profile.shopCats.errRename"));
    }
  };

  const remove = async (row) => {
    if (!window.confirm(t("profile.shopCats.confirmDelete", { name: row.name }))) return;
    try {
      await request(`/shop-categories/${row.id}`, { method: "DELETE" });
      load();
    } catch (removeError) {
      setError(removeError.message || t("profile.shopCats.errDelete"));
    }
  };

  if (loading) return <SectionSkeleton rows={4} label={t("profile.shopCats.loading")} />;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>{t("profile.tabs.shopCategories")}</h2>
      </div>
      <p className="provider-meta profile-section-hint">
        {t("profile.shopCats.hint")}
      </p>

      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <form className="form-grid two" onSubmit={submitCreate} style={{ marginBottom: 24 }}>
        <label className="field">
          <span>{t("profile.shopCats.newName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("profile.shopCats.namePlaceholder")} required />
        </label>
        <label className="field">
          <span>{t("profile.shopCats.parent")}</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t("profile.shopCats.noParent")}</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>{"— ".repeat(row.depth)}{row.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="cta-button" disabled={saving} style={{ gridColumn: "1 / -1", width: "auto" }}>
          {saving ? t("profile.shopCats.adding") : t("profile.shopCats.add")}
        </button>
      </form>

      {rows.length ? (
        <div className="wallet-list">
          {rows.map((row) => (
            <div key={row.id} className="wallet-list-row" style={{ paddingLeft: 16 + row.depth * 20 }}>
              {editingId === row.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitRename(row.id)}
                    autoFocus
                  />
                  <div className="listing-actions">
                    <button type="button" onClick={() => submitRename(row.id)}>{t("profile.shopCats.save")}</button>
                    <button type="button" onClick={() => setEditingId(null)}>{t("profile.shopCats.cancel")}</button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{row.name}</strong>
                  <div className="listing-actions">
                    <button type="button" onClick={() => startRename(row)}>{t("profile.shopCats.rename")}</button>
                    <button type="button" onClick={() => remove(row)}>
                      <IconClose /> {t("profile.shopCats.delete")}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <IconBox />
          <p>{t("profile.shopCats.empty")}</p>
        </div>
      )}
    </section>
  );
}
