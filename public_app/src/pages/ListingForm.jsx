import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginPath } from "../lib/authRedirect";

import { request } from "../lib/api";
import { uploadFile } from "../lib/storage";
import { PhotoField, PhotoGrid } from "../components/PhotoPicker";
import { clearSession, getSession } from "../lib/session";
import { findCategoryPath, flattenCategories } from "../lib/categories";
import { isCustomFieldFilled } from "../lib/customFields";
import Field from "../components/Field";
import DynamicField from "../components/DynamicField";
import SiteHeader from "../components/SiteHeader";
import { FormSkeleton } from "../components/Skeleton";

// One dropdown per level of a category tree; the walk stops at a leaf or an unselected level.
const buildLevels = (tree, path) => {
  const levels = [];
  let options = tree;
  let depth = 0;
  while (options && options.length) {
    const selectedId = path[depth] || "";
    levels.push({ depth, options, selectedId });
    const node = options.find((c) => c.id === selectedId);
    if (!node || !node.children?.length) break;
    options = node.children;
    depth += 1;
  }
  return levels;
};

const defaultBooking = (unit = "night") => ({
  unit,
  inventory: 1,
  capacity: 2,
  minUnits: 1,
  maxUnits: unit === "night" ? 30 : unit === "day" ? 14 : 12,
  leadTimeHours: 0,
  responseHours: 24,
  checkIn: "14:00",
  checkOut: "11:00",
  openFrom: "08:00",
  openTo: "20:00",
  cancellation: "flexible",
  depositPercent: 0,
  payWithinHours: 24,
  depositNote: "",
  instructions: "",
  blockedDates: []
});

// The provider's booking set-up for a service: how it is booked, what is on offer, and the house rules.
function BookingSection({ form, setForm, blockDate, setBlockDate }) {
  const { t } = useTranslation();
  const b = form.booking;
  const unit = b.unit;
  const set = (patch) => setForm((current) => ({ ...current, booking: { ...current.booking, ...patch } }));
  const num = (key) => (e) => set({ [key]: e.target.value === "" ? "" : Number(e.target.value) });
  const on = form.bookingMode !== "none";
  const addBlocked = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockDate) || b.blockedDates.includes(blockDate)) return;
    set({ blockedDates: [...b.blockedDates, blockDate].sort() });
    setBlockDate("");
  };
  return (
    <section className="booking-setup">
      <h3>{t("listing.booking.title")}</h3>
      <label className="booking-toggle">
        <input type="checkbox" checked={on} onChange={(e) => setForm((current) => ({ ...current, bookingMode: e.target.checked ? "request" : "none" }))} />
        <span>
          <strong>{t("listing.booking.isBooking")}</strong>
          <small>{t("listing.booking.isBookingHint")}</small>
        </span>
      </label>

      {on ? (
        <div className="booking-grid">
          <div className="booking-modes" role="radiogroup" aria-label={t("listing.booking.howAccepted")}>
            {[
              { id: "request", title: t("listing.booking.modeRequestTitle"), text: t("listing.booking.modeRequestText") },
              { id: "instant", title: t("listing.booking.modeInstantTitle"), text: t("listing.booking.modeInstantText") }
            ].map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={form.bookingMode === m.id} className={`booking-mode ${form.bookingMode === m.id ? "is-on" : ""}`} onClick={() => setForm((current) => ({ ...current, bookingMode: m.id }))}>
                <strong>{m.title}</strong>
                <small>{m.text}</small>
              </button>
            ))}
          </div>

          <div className="form-grid two">
            <Field label={t("listing.booking.bookBy")}>
              <select value={unit} onChange={(e) => set({ unit: e.target.value, maxUnits: e.target.value === "night" ? 30 : e.target.value === "day" ? 14 : 12 })}>
                <option value="night">{t("listing.booking.unitNight")}</option>
                <option value="day">{t("listing.booking.unitDay")}</option>
                <option value="hour">{t("listing.booking.unitHour")}</option>
              </select>
            </Field>
            <Field label={unit === "hour" ? t("listing.booking.inventoryHour") : t("listing.booking.inventory")} hint={unit === "night" ? t("listing.booking.inventoryHintNight") : t("listing.booking.inventoryHint")}>
              <input type="number" min="1" value={b.inventory} onChange={num("inventory")} />
            </Field>
            <Field label={t("listing.booking.capacity")} hint={t("listing.booking.capacityHint")}>
              <input type="number" min="1" value={b.capacity} onChange={num("capacity")} />
            </Field>
            <Field label={t(`listing.booking.min.${unit}`)}>
              <input type="number" min="1" value={b.minUnits} onChange={num("minUnits")} />
            </Field>
            <Field label={t(`listing.booking.max.${unit}`)}>
              <input type="number" min="1" value={b.maxUnits} onChange={num("maxUnits")} />
            </Field>
            <Field label={t("listing.booking.notice")} hint={t("listing.booking.noticeHint")}>
              <input type="number" min="0" value={b.leadTimeHours} onChange={num("leadTimeHours")} />
            </Field>
            {unit === "night" ? (
              <>
                <Field label={t("listing.booking.checkIn")}><input type="time" value={b.checkIn} onChange={(e) => set({ checkIn: e.target.value })} /></Field>
                <Field label={t("listing.booking.checkOut")}><input type="time" value={b.checkOut} onChange={(e) => set({ checkOut: e.target.value })} /></Field>
              </>
            ) : null}
            {unit === "hour" ? (
              <>
                <Field label={t("listing.booking.openFrom")}><input type="time" step="3600" value={b.openFrom} onChange={(e) => set({ openFrom: e.target.value })} /></Field>
                <Field label={t("listing.booking.closesAt")}><input type="time" step="3600" value={b.openTo} onChange={(e) => set({ openTo: e.target.value })} /></Field>
              </>
            ) : null}
            {form.bookingMode === "request" ? (
              <Field label={t("listing.booking.answerWithin")} hint={t("listing.booking.answerHint")}>
                <input type="number" min="2" max="72" value={b.responseHours} onChange={num("responseHours")} />
              </Field>
            ) : null}
            <Field label={t("listing.booking.cancellation")}>
              <select value={b.cancellation} onChange={(e) => set({ cancellation: e.target.value })}>
                <option value="flexible">{t("listing.booking.cancelFlexible")}</option>
                <option value="moderate">{t("listing.booking.cancelModerate")}</option>
                <option value="strict">{t("listing.booking.cancelStrict")}</option>
              </select>
            </Field>
          </div>

          <div className="form-grid two">
            <Field label={t("listing.booking.takePayment")} hint={t("listing.booking.takePaymentHint")}>
              <select value={b.depositPercent} onChange={(e) => set({ depositPercent: Number(e.target.value) })}>
                <option value={0}>{t("listing.booking.payDirect")}</option>
                <option value={20}>{t("listing.booking.deposit", { percent: 20 })}</option>
                <option value={30}>{t("listing.booking.deposit", { percent: 30 })}</option>
                <option value={50}>{t("listing.booking.deposit", { percent: 50 })}</option>
                <option value={100}>{t("listing.booking.fullAmount")}</option>
              </select>
            </Field>
            {b.depositPercent > 0 ? (
              <Field label={t("listing.booking.payWithin")} hint={t("listing.booking.payWithinHint")}>
                <input type="number" min="1" max="72" value={b.payWithinHours} onChange={num("payWithinHours")} />
              </Field>
            ) : null}
          </div>
          <Field label={t("listing.booking.paymentNote")} hint={t("listing.booking.paymentNoteHint")}>
            <input maxLength={200} value={b.depositNote} onChange={(e) => set({ depositNote: e.target.value })} />
          </Field>
          <Field label={t("listing.booking.houseRules")} hint={t("listing.booking.houseRulesHint")} as="div">
            <textarea rows="3" maxLength={600} value={b.instructions} onChange={(e) => set({ instructions: e.target.value })} />
          </Field>

          <Field label={t("listing.booking.unavailable")} as="div">
            <div className="booking-block-row">
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
              <button type="button" className="secondary-button" onClick={addBlocked}>{t("listing.booking.blockDate")}</button>
            </div>
            {b.blockedDates.length ? (
              <div className="booking-chips">
                {b.blockedDates.map((d) => (
                  <span key={d} className="booking-chip">{d}<button type="button" aria-label={t("listing.booking.unblock", { date: d })} onClick={() => set({ blockedDates: b.blockedDates.filter((x) => x !== d) })}>×</button></span>
                ))}
              </div>
            ) : null}
          </Field>
        </div>
      ) : null}
    </section>
  );
}

export default function ListingForm() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { listingId } = useParams();
  const isEditing = Boolean(listingId);
  const [session] = useState(() => getSession());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productCategories, setProductCategories] = useState([]);
  const [productCategoryPath, setProductCategoryPath] = useState([]); // selected id at each depth, root first
  const [serviceCategories, setServiceCategories] = useState([]);
  const [serviceCategoryPath, setServiceCategoryPath] = useState([]);
  const [blockDate, setBlockDate] = useState("");
  const [newCategoryDraft, setNewCategoryDraft] = useState(null); // 'top' | 'sub' | null
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [shopCategories, setShopCategories] = useState([]);
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
    serviceCategoryId: "",
    bookingMode: "none",
    booking: defaultBooking(),
    shopCategoryId: "",
    imageUrl: "",
    gallery: [],
    customFields: {},
    featured: false,
    onlinePaymentEnabled: true
  });

  useEffect(() => {
    if (!session?.provider) {
      navigate(session ? "/login" : loginPath(location), { replace: true });
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!session?.provider) return;
    let active = true;
    Promise.all([
      request("/product-categories"),
      request("/service-categories"),
      request("/providers/me"),
      request("/shop-categories/mine"),
      // GET /listings/me caps `limit` at 100 (see src/routes/listing.routes.js) - asking for 200
      // always failed with a 400, breaking every edit page load regardless of how many listings
      // the provider has. There's no dedicated "fetch my one listing by id" endpoint yet, so this
      // still can't find a listing outside the newest 100 - a real but much narrower gap than the
      // 400 it replaces.
      isEditing ? request("/listings/me?limit=100") : Promise.resolve(null)
    ])
      .then(([productCategoryResult, serviceCategoryResult, providerResult, shopCategoryResult, listingResult]) => {
        if (!active) return;
        const shopProductCategories = productCategoryResult?.items || productCategoryResult || [];
        setProductCategories(shopProductCategories);
        const serviceTree = serviceCategoryResult?.items || serviceCategoryResult || [];
        setServiceCategories(serviceTree);
        setShopCategories(shopCategoryResult?.items || []);

        if (isEditing) {
          const listing = (listingResult?.items || []).find((item) => item.id === listingId);
          if (!listing) {
            setError(t("listing.errNotFound"));
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
            serviceCategoryId: listing.serviceCategoryId || "",
            bookingMode: listing.bookingMode || "none",
            booking: { ...defaultBooking(listing.booking?.unit), ...(listing.booking || {}) },
            shopCategoryId: listing.shopCategoryId || "",
            imageUrl: listing.media?.imageUrl || "",
            gallery: listing.media?.gallery || [],
            customFields: listing.customFields || {},
            featured: Boolean(listing.featured),
            onlinePaymentEnabled: listing.onlinePaymentEnabled !== false
          });
          if (listing.type === "service" && listing.serviceCategoryId) {
            const found = findCategoryPath(serviceTree, listing.serviceCategoryId);
            setServiceCategoryPath(found ? [...found.ancestors.map((a) => a.id), found.node.id] : [listing.serviceCategoryId]);
          }
          if (listing.type === "product" && listing.productCategoryId) {
            const found = findCategoryPath(shopProductCategories, listing.productCategoryId);
            const path = found ? [...found.ancestors.map((a) => a.id), found.node.id] : [listing.productCategoryId];
            setProductCategoryPath(path);
          }
        } else {
          setForm((current) => ({ ...current, categoryId: providerResult?.categoryId || "" }));
        }
      })
      .catch((loadError) => setError(loadError.message || t("listing.errLoad")))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, isEditing, listingId]);

  const isService = form.type === "service";
  const tree = isService ? serviceCategories : productCategories;
  const categoryPath = isService ? serviceCategoryPath : productCategoryPath;
  const setCategoryPath = isService ? setServiceCategoryPath : setProductCategoryPath;
  const categoryIdKey = isService ? "serviceCategoryId" : "productCategoryId";
  const selectedCategoryNode = form[categoryIdKey] ? findCategoryPath(tree, form[categoryIdKey])?.node || null : null;
  const listingFields = selectedCategoryNode?.effectiveListingFields || selectedCategoryNode?.listingFields || [];
  const activeFieldsCategory = selectedCategoryNode;
  const flatShopCategoryOptions = flattenCategories(shopCategories);

  // Both products and services sit at a leaf of their own category tree, however deep it goes
  // (mirrors listing.service.js#assertProductCategory / assertServiceCategory).
  const productLevels = buildLevels(tree, categoryPath);
  const selectProductCategoryAtDepth = (depth, id) => {
    const level = productLevels[depth];
    const node = level?.options.find((c) => c.id === id) || null;
    setCategoryPath((current) => {
      const next = current.slice(0, depth);
      next[depth] = id;
      return next;
    });
    const isLeaf = id && !node?.children?.length;
    setForm((current) => ({
      ...current,
      [categoryIdKey]: isLeaf ? id : "",
      customFields: {},
      // A bookable category suggests taking bookings, with its usual unit, on a service that has none set yet.
      ...(isService && isLeaf && node?.bookable && current.bookingMode === "none" && !isEditing
        ? { bookingMode: "request", booking: defaultBooking(node.bookingUnit || "night") }
        : {})
    }));
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
    const parentId = categoryPath[categoryPath.length - 1];
    if (!name || !parentId) return;
    setCreatingCategory(true);
    setError("");
    try {
      const created = await request(isService ? "/service-categories/mine" : "/product-categories/mine", {
        method: "POST",
        body: JSON.stringify({ name, parentId })
      });
      (isService ? setServiceCategories : setProductCategories)((current) => insertChildIntoTree(current, parentId, created));
      setCategoryPath((current) => [...current, created.id]);
      setForm((current) => ({ ...current, [categoryIdKey]: created.id, customFields: {} }));
      cancelNewCategory();
    } catch (createError) {
      setError(createError.message || t("listing.errCreateSub"));
    } finally {
      setCreatingCategory(false);
    }
  };

  const removeGalleryPhoto = (url) => {
    setForm((current) => ({ ...current, gallery: current.gallery.filter((item) => item !== url) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(t("listing.errName"));
      return;
    }
    if (!categoryPath[0]) {
      setError(t(`listing.errCategory.${form.type}`));
      return;
    }
    if (!form[categoryIdKey]) {
      setError(t(`listing.errSubcategory.${form.type}`));
      return;
    }
    if (isService && form.bookingMode !== "none" && !(Number(form.price) > 0)) {
      setError(t(`listing.errPricePer.${form.booking.unit}`));
      return;
    }
    const missingField = listingFields.find(
      (field) => field.required && !isCustomFieldFilled(field, form.customFields[field.key])
    );
    if (missingField) {
      setError(t("listing.errFillField", { field: missingField.label }));
      return;
    }
    const priceNum = form.price === "" ? 0 : Number(form.price);
    const originalPriceNum = form.originalPrice === "" ? null : Number(form.originalPrice);
    const discountPercentNum = form.discountPercent === "" ? null : Number(form.discountPercent);
    if (discountPercentNum !== null) {
      if (!Number.isInteger(discountPercentNum) || discountPercentNum < 1 || discountPercentNum > 100) {
        setError(t("listing.errDiscount"));
        return;
      }
      if (!originalPriceNum || originalPriceNum <= 0) {
        setError(t("listing.errOriginalRequired"));
        return;
      }
      if (originalPriceNum < priceNum) {
        setError(t("listing.errOriginalLower"));
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
        productCategoryId: isService ? null : form.productCategoryId || null,
        ...(isService ? { serviceCategoryId: form.serviceCategoryId || null, bookingMode: form.bookingMode, booking: form.bookingMode === "none" ? {} : form.booking } : {}),
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
      setError(submitError.message || t("listing.errSave"));
      window.scrollTo({ top: 0, behavior: "smooth" });
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
        <FormSkeleton fields={6} />
      ) : (
        <div className="listing-form-page">
          <div className="form-heading">
            <p className="eyebrow">{isEditing ? t("listing.edit") : t("listing.add")}</p>
            <h2>{isEditing ? t("listing.editTitle") : t("listing.addTitle")}</h2>
          </div>

          {error ? <div className="error-message">{error}</div> : null}

          <form className="registration-form listing-form-standalone" onSubmit={submit}>
            <section>
              <h3>{t("listing.details")}</h3>
              <div className="form-grid two">
                <Field label={t("listing.type")}>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, customFields: {} })}>
                    <option value="service">{t("listing.service")}</option>
                    <option value="product">{t("listing.product")}</option>
                  </select>
                </Field>
                {productLevels.map((level) => (
                  <Field key={level.depth} label={level.depth === 0 ? t("listing.categoryReq") : t("listing.subcategoryReq")}>
                    <select value={level.selectedId} onChange={(e) => selectProductCategoryAtDepth(level.depth, e.target.value)}>
                      <option value="">{level.depth === 0 ? t("listing.chooseCategory") : t("listing.chooseSubcategory")}</option>
                      {level.options.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                ))}
                <Field label={t("listing.name")}>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label={isService && form.bookingMode !== "none" ? t(`listing.pricePer.${form.booking.unit}`) : t("listing.price")}>
                  <input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </Field>
                {form.type === "product" ? (
                  <>
                    <Field label={t("listing.originalPrice")} hint={t("listing.originalPriceHint")}>
                      <input type="number" min="0" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
                    </Field>
                    <Field label={t("listing.discount")} hint={t("listing.discountHint")}>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={form.discountPercent}
                        onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                        placeholder={t("listing.discountPlaceholder")}
                      />
                    </Field>
                    <Field label={t("listing.sku")} hint={t("listing.skuHint")}>
                      <input
                        value={form.sku}
                        onChange={(e) => setForm({ ...form, sku: e.target.value })}
                        placeholder={t("listing.skuPlaceholder")}
                        maxLength={120}
                      />
                    </Field>
                    <Field label={t("listing.inventory")} hint={t("listing.inventoryHint")}>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.inventory}
                        onChange={(e) => setForm({ ...form, inventory: e.target.value })}
                        placeholder={t("listing.inventoryPlaceholder")}
                      />
                    </Field>
                  </>
                ) : null}
                <Field label={t("listing.shopCategory")} hint={t("listing.shopCategoryHint")}>
                  <select value={form.shopCategoryId} onChange={(e) => setForm({ ...form, shopCategoryId: e.target.value })}>
                    <option value="">{t("listing.noShopCategory")}</option>
                    {flatShopCategoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.path}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {!tree.length ? (
                <p className="provider-meta">
                  {t(`listing.noCategories.${form.type}`)}
                </p>
              ) : null}

              {categoryPath[0] ? (
                <div className="new-category-panel">
                  {newCategoryDraft ? (
                    <div className="form-grid two">
                      <Field label={t("listing.newSubName")}>
                        <input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder={t("listing.newSubPlaceholder")}
                          autoFocus
                        />
                      </Field>
                      <div className="checkbox-row" style={{ alignItems: "center", gap: 8 }}>
                        <button type="button" className="cta-button" disabled={creatingCategory || !newCategoryName.trim()} onClick={createSubcategory}>
                          {creatingCategory ? t("listing.creating") : t("listing.create")}
                        </button>
                        <button type="button" className="secondary-button" onClick={cancelNewCategory}>{t("listing.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="checkbox-row" style={{ gap: 12 }}>
                      <button type="button" className="secondary-button" onClick={startNewSubcategory}>{t("listing.addSub")}</button>
                    </div>
                  )}
                  <p className="provider-meta" style={{ marginTop: 8 }}>
                    {t("listing.addSubHint")}
                  </p>
                </div>
              ) : null}

              <Field label={t("listing.description")} as="div">
                <textarea rows="8" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              {isService ? (
                <p className="provider-meta listing-guard-note">
                  {t("listing.guardNote")}
                </p>
              ) : null}
              <Field label={t("listing.highlight")} as="div">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.featured}
                    onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  />
                  <span>{t("listing.featureBest")}</span>
                </label>
              </Field>
              {form.type === "product" ? (
                <Field label={t("listing.newArrival")} as="div">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isNew}
                      onChange={(e) => setForm({ ...form, isNew: e.target.checked })}
                    />
                    <span>{t("listing.markNew")}</span>
                  </label>
                </Field>
              ) : null}
              {form.type === "product" ? (
                <Field label={t("listing.onlinePurchase")} as="div">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.onlinePaymentEnabled}
                      onChange={(e) => setForm({ ...form, onlinePaymentEnabled: e.target.checked })}
                    />
                    <span>{t("listing.letPayOnline")}</span>
                  </label>
                </Field>
              ) : null}
            </section>

            {isService ? (
              <BookingSection form={form} setForm={setForm} blockDate={blockDate} setBlockDate={setBlockDate} />
            ) : null}

            {listingFields.length ? (
              <section>
                <h3>{activeFieldsCategory?.name ? t("listing.moreAbout", { name: activeFieldsCategory.name.toLowerCase() }) : t("listing.moreAboutListing")}</h3>
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
              <h3>{t("listing.coverPhoto")}</h3>
              <PhotoField
                value={form.imageUrl}
                onChange={(url) => setForm((current) => ({ ...current, imageUrl: url }))}
                upload={(file) => uploadFile(file, "provider-listings")}
                onError={setError}
              />
            </section>

            <section>
              <h3>{t("listing.additionalPhotos")}</h3>
              <p className="provider-meta" style={{ marginTop: -4, marginBottom: 12 }}>
                {t(`listing.galleryHint.${form.type === "product" ? "product" : "service"}`)}
              </p>
              <PhotoGrid
                values={form.gallery}
                onAdd={(url) => setForm((current) => ({ ...current, gallery: [...current.gallery, url] }))}
                onRemove={removeGalleryPhoto}
                upload={(file) => uploadFile(file, "provider-listings")}
                onError={setError}
              />
            </section>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? t("listing.saving") : isEditing ? t("listing.saveChanges") : t("listing.addListing")}
            </button>
            <Link to="/profile" className="secondary-button" style={{ display: "block", textAlign: "center" }}>{t("listing.cancel")}</Link>
          </form>
        </div>
      )}
    </main>
  );
}
