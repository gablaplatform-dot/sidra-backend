import React, { useEffect, useState } from "react";

import { request } from "../../lib/api";
import { IconBox, IconClose } from "../icons";

// Flattens the category tree into rows with a depth for indentation, and a separate flat option
// list (root option first) for the parent picker.
const flatten = (nodes, depth = 0) =>
  nodes.flatMap((node) => [{ ...node, depth }, ...flatten(node.children || [], depth + 1)]);

export default function ProfileShopCategoriesTab() {
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
      .catch((loadError) => setError(loadError.message || "Unable to load your shop categories."))
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
      setNotice("Category added.");
      load();
    } catch (submitError) {
      setError(submitError.message || "Unable to add this category.");
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
      setError(renameError.message || "Unable to rename this category.");
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    try {
      await request(`/shop-categories/${row.id}`, { method: "DELETE" });
      load();
    } catch (removeError) {
      setError(removeError.message || "Unable to delete this category.");
    }
  };

  if (loading) return <p className="home-empty page-loading">Loading your shop categories…</p>;

  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h2>Shop categories</h2>
      </div>
      <p className="provider-meta profile-section-hint">
        Organize your products and services the way a real store would &mdash; e.g. &ldquo;Electronics&rdquo; with
        &ldquo;TVs&rdquo; and &ldquo;Speakers&rdquo; inside it. These are yours alone; customers browse them on your shop page.
      </p>

      {error ? <div className="error-message home-error">{error}</div> : null}
      {notice ? <div className="notice-message">{notice}</div> : null}

      <form className="form-grid two" onSubmit={submitCreate} style={{ marginBottom: 24 }}>
        <label className="field">
          <span>New category name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electronics" required />
        </label>
        <label className="field">
          <span>Parent (optional)</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">No parent (top level)</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>{"— ".repeat(row.depth)}{row.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="cta-button" disabled={saving} style={{ gridColumn: "1 / -1", width: "auto" }}>
          {saving ? "Adding…" : "+ Add category"}
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
                    <button type="button" onClick={() => submitRename(row.id)}>Save</button>
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{row.name}</strong>
                  <div className="listing-actions">
                    <button type="button" onClick={() => startRename(row)}>Rename</button>
                    <button type="button" onClick={() => remove(row)}>
                      <IconClose /> Delete
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
          <p>No shop categories yet. Add your first one above.</p>
        </div>
      )}
    </section>
  );
}
