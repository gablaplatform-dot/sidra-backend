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
  const [productTopCategoryId, setProductTopCategoryId] = useState("");
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
      request("/categories?viewType=ecommerce"),
      request("/providers/me"),
      request("/shop-categories/mine"),
      isEditing ? request("/listings/me?limit=200") : Promise.resolve(null)
    ])
      .then(([categoryResult, productCategoryResult, providerResult, shopCategoryResult, listingResult]) => {
        if (!active) return;
        const flatCategories = categoryResult?.items || categoryResult || [];
        setCategories(flatCategories);
        const ecommerceCategories = productCategoryResult?.items || productCategoryResult || [];
        setProductCategories(ecommerceCategories);
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
            shopCategoryId: listing.shopCategoryId || "",
            imageUrl: listing.media?.imageUrl || "",
            gallery: listing.media?.gallery || [],
            customFields: listing.customFields || {},
            featured: Boolean(listing.featured),
            onlinePaymentEnabled: listing.onlinePaymentEnabled !== false
          });
          if (listing.type === "product" && listing.categoryId) {
            const found = findCategoryPath(ecommerceCategories, listing.categoryId);
            const topId = found?.ancestors?.[0]?.id || listing.categoryId;
            setProductTopCategoryId(topId);
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
  // leaf of it - if the chosen top category has subcategories, one of them has to be picked too
  // (mirrors the server-side rule in listing.service.js#assertProductCategory).
  const productTopNode = productCategories.find((c) => c.id === productTopCategoryId) || null;
  const productSubcategoryOptions = productTopNode?.children || [];
  const productNeedsSubcategory = productSubcategoryOptions.length > 0;

  const selectProductTopCategory = (id) => {
    const node = productCategories.find((c) => c.id === id) || null;
    setProductTopCategoryId(id);
    setForm((current) => ({ ...current, categoryId: node?.children?.length ? "" : id, customFields: {} }));
  };

  const selectProductSubcategory = (id) => {
    setForm((current) => ({ ...current, categoryId: id, customFields: {} }));
  };

  const startNewCategory = (scope) => {
    setNewCategoryDraft(scope);
    setNewCategoryName("");
  };

  const cancelNewCategory = () => {
    setNewCategoryDraft(null);
    setNewCategoryName("");
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setError("");
    try {
      const parentId = newCategoryDraft === "sub" ? productTopCategoryId : undefined;
      const created = await request("/categories/mine", {
        method: "POST",
        body: JSON.stringify(parentId ? { name, parentId } : { name })
      });
      if (newCategoryDraft === "sub") {
        setProductCategories((current) =>
          current.map((node) =>
            node.id === productTopCategoryId ? { ...node, children: [...(node.children || []), created] } : node
          )
        );
        setForm((current) => ({ ...current, categoryId: created.id, customFields: {} }));
      } else {
        setProductCategories((current) => [...current, created]);
        setProductTopCategoryId(created.id);
        setForm((current) => ({ ...current, categoryId: created.id, customFields: {} }));
      }
      cancelNewCategory();
    } catch (createError) {
      setError(createError.message || "Unable to create this category.");
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
      if (!productTopCategoryId) {
        setError("Choose a category for this product.");
        return;
      }
      if (productNeedsSubcategory && !form.categoryId) {
        setError("Choose a subcategory for this product.");
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
    <main className="home-shell">
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
                    <Field label="Category *">
                      <select value={productTopCategoryId} onChange={(e) => selectProductTopCategory(e.target.value)}>
                        <option value="">Choose a category</option>
                        {productCategories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </Field>
                    {productNeedsSubcategory ? (
                      <Field label="Subcategory *">
                        <select value={form.categoryId} onChange={(e) => selectProductSubcategory(e.target.value)}>
                          <option value="">Choose a subcategory</option>
                          {productSubcategoryOptions.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </Field>
                    ) : null}
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

              {form.type === "product" ? (
                <div className="new-category-panel">
                  {newCategoryDraft ? (
                    <div className="form-grid two">
                      <Field label={newCategoryDraft === "sub" ? "New subcategory name" : "New category name"}>
                        <input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={newCategoryDraft === "sub" ? "e.g. Drones" : "e.g. Electronics"}
                          autoFocus
                        />
                      </Field>
                      <div className="checkbox-row" style={{ alignItems: "center", gap: 8 }}>
                        <button type="button" className="cta-button" disabled={creatingCategory || !newCategoryName.trim()} onClick={createCategory}>
                          {creatingCategory ? "Creating…" : "Create"}
                        </button>
                        <button type="button" className="secondary-button" onClick={cancelNewCategory}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="checkbox-row" style={{ gap: 12 }}>
                      <button type="button" className="secondary-button" onClick={() => startNewCategory("top")}>+ Add new category</button>
                      {productTopCategoryId ? (
                        <button type="button" className="secondary-button" onClick={() => startNewCategory("sub")}>+ Add new subcategory</button>
                      ) : null}
                    </div>
                  )}
                  <p className="provider-meta" style={{ marginTop: 8 }}>
                    Can&apos;t find the right category? Create one — it goes live immediately and is queued for admin review.
                  </p>
                </div>
              ) : null}

              <Field label="Description" as="div">
                <textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
