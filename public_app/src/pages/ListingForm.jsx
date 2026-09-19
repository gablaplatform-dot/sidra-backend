import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { request } from "../lib/api";
import { uploadFile } from "../lib/storage";
import { clearSession, getSession } from "../lib/session";
import { findCategoryPath, flattenCategories } from "../lib/categories";
import { isCustomFieldFilled } from "../lib/customFields";
import Field from "../components/Field";
import DynamicField from "../components/DynamicField";
import SiteHeader from "../components/SiteHeader";
import { IconClose } from "../components/icons";

export default function ListingForm() {
  const navigate = useNavigate();
  const { listingId } = useParams();
  const isEditing = Boolean(listingId);
  const [session] = useState(() => getSession());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState([]);
  const [productCategories, setProductCategories] = useState([]);
  const [productCategoryPath, setProductCategoryPath] = useState([]); // selected id at each depth, root first
  const [newCategoryDraft, setNewCategoryDraft] = useState(null); // 'top' | 'sub' | null
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [shopCategories, setShopCategories] = useState([]);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryFileRef = useRef(null);
  const [form, setForm] = useState({
    type: "service",
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    discountPercent: "",
    isNew: false,
    sku: "",
    inventory: "",
    categoryId: "",
    productCategoryId: "",
    shopCategoryId: "",
    imageUrl: "",
    gallery: [],
    customFields: {},
    featured: false,
    onlinePaymentEnabled: true
  });

  useEffect(() => {
    if (!session?.provider) {
      navigate("/login", { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session?.provider) return;
    let active = true;
    Promise.all([
      request("/categories"),
      request("/product-categories"),
      request("/providers/me"),
      request("/shop-categories/mine"),
      isEditing ? request("/listings/me?limit=200") : Promise.resolve(null)
    ])
      .then(([categoryResult, productCategoryResult, providerResult, shopCategoryResult, listingResult]) => {
        if (!active) return;
        const flatCategories = categoryResult?.items || categoryResult || [];
        setCategories(flatCategories);
        const shopProductCategories = productCategoryResult?.items || productCategoryResult || [];
        setProductCategories(shopProductCategories);
        setShopCategories(shopCategoryResult?.items || []);

        if (isEditing) {
          const listing = (listingResult?.items || []).find((item) => item.id === listingId);
          if (!listing) {
            setError("This listing could not be found.");
            return;
          }
          setForm({
            type: listing.type,
            name: listing.name,
            description: listing.description || "",
            price: listing.price ?? "",
            originalPrice: listing.originalPrice ?? "",
            discountPercent: listing.discountPercent ?? "",
            isNew: Boolean(listing.isNew),
            sku: listing.sku ?? "",
            inventory: listing.inventory ?? "",
            categoryId: listing.categoryId || "",
            productCategoryId: listing.productCategoryId || "",
            shopCategoryId: listing.shopCategoryId || "",
            imageUrl: listing.media?.imageUrl || "",
            gallery: listing.media?.gallery || [],
            customFields: listing.customFields || {},
            featured: Boolean(listing.featured),
            onlinePaymentEnabled: listing.onlinePaymentEnabled !== false
          });
          if (listing.type === "product" && listing.productCategoryId) {
            const found = findCategoryPath(shopProductCategories, listing.productCategoryId);
            const path = found ? [...found.ancestors.map((a) => a.id), found.node.id] : [listing.productCategoryId];
            setProductCategoryPath(path);
          }
        } else {
          setForm((current) => ({ ...current, categoryId: providerResult?.categoryId || "" }));
        }
      })
      .catch((loadError) => setError(loadError.message || "Unable to load this page."))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, isEditing, listingId]);

  const flatCategoryOptions = flattenCategories(categories);
  const selectedCategory = flatCategoryOptions.find((c) => c.id === form.categoryId) || null;
  const listingFields = selectedCategory?.effectiveListingFields || selectedCategory?.listingFields || [];
  const flatShopCategoryOptions = flattenCategories(shopCategories);

  // Products use the admin/provider-managed e-commerce category tree, and must be placed at a
  // leaf of it, however deep that tree goes (mirrors listing.service.js#assertProductCategory).
  // Each level's dropdown is derived from the previous level's selection; the walk stops once it
  // reaches a node with no children (a leaf, i.e. a valid product category) or an unselected level.
  const productLevels = [];
  {
    let options = productCategories;
    let depth = 0;
    while (options && options.length) {
      const selectedId = productCategoryPath[depth] || "";
      productLevels.push({ depth, options, selectedId });
      const node = options.find((c) => c.id === selectedId);
      if (!node || !node.children?.length) break;
      options = node.children;
      depth += 1;
    }
  }
  const selectProductCategoryAtDepth = (depth, id) => {
    const level = productLevels[depth];
    const node = level?.options.find((c) => c.id === id) || null;
    setProductCategoryPath((current) => {
      const next = current.slice(0, depth);
      next[depth] = id;
      return next;
    });
    const isLeaf = id && !node?.children?.length;
    setForm((current) => ({ ...current, productCategoryId: isLeaf ? id : "", customFields: {} }));
  };

  const startNewSubcategory = () => {
    setNewCategoryDraft("sub");
    setNewCategoryName("");
  };

  const cancelNewCategory = () => {
    setNewCategoryDraft(null);
    setNewCategoryName("");
  };

  const insertChildIntoTree = (nodes, parentId, child) =>
    nodes.map((node) => {
      if (node.id === parentId) {
        return { ...node, children: [...(node.children || []), child] };
      }
      if (node.children?.length) {
        return { ...node, children: insertChildIntoTree(node.children, parentId, child) };
      }
      return node;
    });

  const createSubcategory = async () => {
    const name = newCategoryName.trim();
    const parentId = productCategoryPath[productCategoryPath.length - 1];
    if (!name || !parentId) return;
    setCreatingCategory(true);
    setError("");
    try {
      const created = await request("/product-categories/mine", {
        method: "POST",
        body: JSON.stringify({ name, parentId })
      });
      setProductCategories((current) => insertChildIntoTree(current, parentId, created));
      setProductCategoryPath((current) => [...current, created.id]);
      setForm((current) => ({ ...current, productCategoryId: created.id, customFields: {} }));
      cancelNewCategory();
    } catch (createError) {
      setError(createError.message || "Unable to create this subcategory.");
    } finally {
      setCreatingCategory(false);
    }
  };

  const pickCoverImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setError("");
    try {
      const url = await uploadFile(file, "provider-listings");
      setForm((current) => ({ ...current, imageUrl: url }));
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload photo.");
    } finally {
      setUploadingCover(false);
    }
  };

  const addGalleryPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingGallery(true);
    setError("");
    try {
      const url = await uploadFile(file, "provider-listings");
      setForm((current) => ({ ...current, gallery: [...current.gallery, url] }));
    } catch (uploadError) {
      setError(uploadError.message || "Unable to upload photo.");
    } finally {
      setUploadingGallery(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  };

  const removeGalleryPhoto = (url) => {
    setForm((current) => ({ ...current, gallery: current.gallery.filter((item) => item !== url) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Give it a name.");
      return;
    }
    if (form.type === "product") {
      if (!productCategoryPath[0]) {
        setError("Choose a category for this product.");
        return;
      }
      if (!form.productCategoryId) {
        setError("Choose a more specific subcategory for this product.");
        return;
      }
    }
    const missingField = listingFields.find(
      (field) => field.required && !isCustomFieldFilled(field, form.customFields[field.key])
    );
    if (missingField) {
      setError(`Please fill in "${missingField.label}".`);
      return;
    }
    const priceNum = form.price === "" ? 0 : Number(form.price);
    const originalPriceNum = form.originalPrice === "" ? null : Number(form.originalPrice);
    const discountPercentNum = form.discountPercent === "" ? null : Number(form.discountPercent);
    if (discountPercentNum !== null) {
      if (!Number.isInteger(discountPercentNum) || discountPercentNum < 1 || discountPercentNum > 100) {
        setError("Discount percent must be a whole number between 1 and 100.");
        return;
      }
      if (!originalPriceNum || originalPriceNum <= 0) {
        setError("Original price must be set to use a discount.");
        return;
      }
      if (originalPriceNum < priceNum) {
        setError("Original price cannot be lower than the current price.");
        return;
      }
    }
    const inventoryNum = form.inventory === "" ? null : Number(form.inventory);
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: priceNum,
        originalPrice: originalPriceNum,
        discountPercent: discountPercentNum,
        isNew: Boolean(form.isNew),
        sku: form.sku.trim() === "" ? null : form.sku.trim(),
        inventory: inventoryNum !== null && Number.isInteger(inventoryNum) && inventoryNum >= 0 ? inventoryNum : null,
        type: form.type,
        categoryId: form.categoryId || null,
        productCategoryId: form.productCategoryId || null,
        shopCategoryId: form.shopCategoryId || null,
        media: { imageUrl: form.imageUrl || null, gallery: form.gallery },
        customFields: form.customFields,
        featured: form.featured,
        onlinePaymentEnabled: form.onlinePaymentEnabled
      };
      if (isEditing) {
        await request(`/listings/${listingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await request("/listings", { method: "POST", body: JSON.stringify(payload) });
      }
      navigate("/profile", { replace: true });
    } catch (submitError) {
      setError(submitError.message || "Unable to save this listing.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  if (!session?.provider) return null;

  return (
    <main className="home-shell home-themed">
      <SiteHeader session={session} onLogout={logout} />

      {loading ? (
        <p className="home-empty page-loading">Loading…</p>
      ) : (
        <div className="listing-form-page">
          <div className="form-heading">
            <p className="eyebrow">{isEditing ? "Edit" : "Add"}</p>
            <h2>{isEditing ? "Edit product or service" : "Add a product or service"}</h2>
          </div>

          {error ? <div className="error-message">{error}</div> : null}

          <form className="registration-form listing-form-standalone" onSubmit={submit}>
            <section>
              <h3>Details</h3>
              <div className="form-grid two">
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="service">Service</option>
                    <option value="product">Product</option>
                  </select>
                </Field>
                {form.type === "product" ? (
                  <>
                    {productLevels.map((level) => (
                      <Field key={level.depth} label={level.depth === 0 ? "Category *" : "Subcategory *"}>
                        <select
                          value={level.selectedId}
                          onChange={(e) => selectProductCategoryAtDepth(level.depth, e.target.value)}
                        >
                          <option value="">{level.depth === 0 ? "Choose a category" : "Choose a subcategory"}</option>
                          {level.options.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </>
                ) : (
                  <Field label="Category">
                    <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, customFields: {} })}>
                      <option value="">Uncategorized</option>
                      {flatCategoryOptions.map((c) => (
                        <option key={c.id} value={c.id}>{c.path}</option>
                      ))}
                    </select>
                  </Field>
                )}
                <Field label="Name">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label="Price (UGX)">
                  <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </Field>
                {form.type === "product" ? (
                  <>
                    <Field label="Original price (UGX)" hint="Before discount — leave blank if none">
                      <input type="number" min="0" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                    </Field>
                    <Field label="Discount %" hint="1-100 whole number. Requires original price.">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={form.discountPercent}
                        onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                        placeholder="e.g. 30"
                      />
                    </Field>
                    <Field label="SKU (optional)" hint="Internal stock keeping unit code">
                      <input
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        placeholder="e.g. SHOE-MEN-042"
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Inventory (optional)" hint="Number of units in stock — leave blank for unlimited">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.inventory}
                        onChange={(e) => setForm({ ...form, inventory: e.target.value })}
                        placeholder="e.g. 50"
                      />
                    </Field>
                  </>
                ) : null}
                <Field label="Shop category (optional)" hint="Manage these under Profile → Shop categories">
                  <select value={form.shopCategoryId} onChange={(e) => setForm({ ...form, shopCategoryId: e.target.value })}>
                    <option value="">No shop category</option>
                    {flatShopCategoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.path}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.type === "product" && !productCategories.length ? (
                <p className="provider-meta">
                  No shop categories exist yet — ask an admin to create one before you can add a product.
                </p>
              ) : null}

              {form.type === "product" && productCategoryPath[0] ? (
                <div className="new-category-panel">
                  {newCategoryDraft ? (
                    <div className="form-grid two">
                      <Field label="New subcategory name">
                        <input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g. Drones"
                          autoFocus
                        />
                      </Field>
                      <div className="checkbox-row" style={{ alignItems: "center", gap: 8 }}>
                        <button type="button" className="cta-button" disabled={creatingCategory || !newCategoryName.trim()} onClick={createSubcategory}>
                          {creatingCategory ? "Creating…" : "Create"}
                        </button>
                        <button type="button" className="secondary-button" onClick={cancelNewCategory}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="checkbox-row" style={{ gap: 12 }}>
                      <button type="button" className="secondary-button" onClick={startNewSubcategory}>+ Add new subcategory</button>
                    </div>
                  )}
                  <p className="provider-meta" style={{ marginTop: 8 }}>
                    Can&apos;t find the right subcategory? Add one — it goes live immediately and is queued for admin review.
                  </p>
                </div>
              ) : null}

              <Field label="Description" as="div">
                <textarea rows="8" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <Field label="Highlight this listing" as="div">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                  <span>Feature it as a best seller on your storefront</span>
                </label>
              </Field>
              {form.type === "product" ? (
                <Field label="New arrival" as="div">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isNew}
                      onChange={(e) => setForm({ ...form, isNew: e.target.checked })}
                    />
                    <span>Mark this product as a new arrival for 30 days</span>
                  </label>
                </Field>
              ) : null}
              {form.type === "product" ? (
                <Field label="Online purchase" as="div">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.onlinePaymentEnabled}
                      onChange={(e) => setForm({ ...form, onlinePaymentEnabled: e.target.checked })}
                    />
                    <span>Let customers pay for this product online with mobile money</span>
                  </label>
                </Field>
              ) : null}
            </section>

            {listingFields.length ? (
              <section>
                <h3>More about this {selectedCategory?.name?.toLowerCase() || "listing"}</h3>
                <div className="form-grid two">
                  {listingFields.map((field) => (
                    <Field
                      key={field.key}
                      label={field.required ? `${field.label} *` : field.label}
                      hint={field.unit}
                      as={field.type === "boolean" || field.type === "multi_select" ? "div" : "label"}
                    >
                      <DynamicField
                        field={field}
                        value={form.customFields[field.key]}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            customFields: { ...current.customFields, [field.key]: value }
                          }))
                        }
                      />
                    </Field>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <h3>Cover photo</h3>
              {form.imageUrl ? <div className="listing-cover" style={{ backgroundImage: `url("${form.imageUrl}")`, height: 160 }} /> : null}
              <input type="file" accept="image/*" onChange={pickCoverImage} disabled={uploadingCover} />
              {uploadingCover ? <small>Uploading…</small> : null}
            </section>

            <section>
              <div className="detail-block-header">
                <h3>Additional photos</h3>
                <button type="button" className="cta-button" onClick={() => galleryFileRef.current?.click()} disabled={uploadingGallery}>
                  {uploadingGallery ? "Uploading…" : "+ Add photo"}
                </button>
                <input ref={galleryFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={addGalleryPhoto} />
              </div>
              <p className="provider-meta" style={{ marginTop: -8, marginBottom: 12 }}>
                Extra angles or details for this specific {form.type === "product" ? "product" : "service"} &mdash; not your business gallery.
              </p>
              {form.gallery.length ? (
                <div className="gallery-grid">
                  {form.gallery.map((url) => (
                    <div key={url} className="gallery-item" style={{ backgroundImage: `url("${url}")` }}>
                      <button type="button" className="gallery-remove" onClick={() => removeGalleryPhoto(url)} aria-label="Remove photo">
                        <IconClose />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="provider-meta">No gallery photos yet.</p>
              )}
            </section>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add listing"}
            </button>
            <Link to="/profile" className="secondary-button" style={{ display: "block", textAlign: "center" }}>Cancel</Link>
          </form>
        </div>
      )}
    </main>
  );
}
