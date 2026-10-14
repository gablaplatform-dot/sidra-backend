import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { loginPath } from "../lib/authRedirect";

import { request } from "../lib/api";
import { uploadFile } from "../lib/storage";
import { clearSession, getSession } from "../lib/session";
import { findCategoryPath, flattenCategories } from "../lib/categories";
import { isCustomFieldFilled } from "../lib/customFields";
import Field from "../components/Field";
import DynamicField from "../components/DynamicField";
import SiteHeader from "../components/SiteHeader";
import { IconClose } from "../components/icons";
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

const UNIT_LABEL = { night: "night", day: "day", hour: "hour" };

// The provider's booking set-up for a service: how it is booked, what is on offer, and the house rules.
function BookingSection({ form, setForm, blockDate, setBlockDate }) {
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
      <h3>Bookings</h3>
      <label className="booking-toggle">
        <input type="checkbox" checked={on} onChange={(e) => setForm((current) => ({ ...current, bookingMode: e.target.checked ? "request" : "none" }))} />
        <span>
          <strong>This is a booking service</strong>
          <small>Guests pick dates or a time and book it here, like hotel rooms, venues or appointments. Leave it off if customers just unlock your contact and call.</small>
        </span>
      </label>

      {on ? (
        <div className="booking-grid">
          <div className="booking-modes" role="radiogroup" aria-label="How bookings are accepted">
            {[
              { id: "request", title: "I approve each booking", text: "Guests send a request. You accept or decline within the time you set; dates are held meanwhile." },
              { id: "instant", title: "Confirm instantly", text: "Open dates are confirmed straight away, no waiting. Best when you're rarely unavailable." }
            ].map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={form.bookingMode === m.id} className={`booking-mode ${form.bookingMode === m.id ? "is-on" : ""}`} onClick={() => setForm((current) => ({ ...current, bookingMode: m.id }))}>
                <strong>{m.title}</strong>
                <small>{m.text}</small>
              </button>
            ))}
          </div>

          <div className="form-grid two">
            <Field label="Guests book by the">
              <select value={unit} onChange={(e) => set({ unit: e.target.value, maxUnits: e.target.value === "night" ? 30 : e.target.value === "day" ? 14 : 12 })}>
                <option value="night">Night (rooms, stays)</option>
                <option value="day">Day (venues, car hire)</option>
                <option value="hour">Hour (appointments, studios)</option>
              </select>
            </Field>
            <Field label={unit === "hour" ? "How many can be booked at once" : "How many do you have"} hint={unit === "night" ? "Rooms of this type" : "Identical rooms, spaces or vehicles"}>
              <input type="number" min="1" value={b.inventory} onChange={num("inventory")} />
            </Field>
            <Field label="Guests per unit" hint="Most people one room or space holds">
              <input type="number" min="1" value={b.capacity} onChange={num("capacity")} />
            </Field>
            <Field label={`Minimum ${UNIT_LABEL[unit]}s`}>
              <input type="number" min="1" value={b.minUnits} onChange={num("minUnits")} />
            </Field>
            <Field label={`Maximum ${UNIT_LABEL[unit]}s`}>
              <input type="number" min="1" value={b.maxUnits} onChange={num("maxUnits")} />
            </Field>
            <Field label="Notice needed (hours)" hint="Stops last-minute bookings; 0 for none">
              <input type="number" min="0" value={b.leadTimeHours} onChange={num("leadTimeHours")} />
            </Field>
            {unit === "night" ? (
              <>
                <Field label="Check-in from"><input type="time" value={b.checkIn} onChange={(e) => set({ checkIn: e.target.value })} /></Field>
                <Field label="Check-out by"><input type="time" value={b.checkOut} onChange={(e) => set({ checkOut: e.target.value })} /></Field>
              </>
            ) : null}
            {unit === "hour" ? (
              <>
                <Field label="Open from"><input type="time" step="3600" value={b.openFrom} onChange={(e) => set({ openFrom: e.target.value })} /></Field>
                <Field label="Closes at"><input type="time" step="3600" value={b.openTo} onChange={(e) => set({ openTo: e.target.value })} /></Field>
              </>
            ) : null}
            {form.bookingMode === "request" ? (
              <Field label="Answer within (hours)" hint="Unanswered requests expire and free the dates">
                <input type="number" min="2" max="72" value={b.responseHours} onChange={num("responseHours")} />
              </Field>
            ) : null}
            <Field label="Cancellation policy">
              <select value={b.cancellation} onChange={(e) => set({ cancellation: e.target.value })}>
                <option value="flexible">Flexible: free up to 24 hours before</option>
                <option value="moderate">Moderate: free up to 5 days before</option>
                <option value="strict">Strict: deposit is non-refundable</option>
              </select>
            </Field>
          </div>

          <div className="form-grid two">
            <Field label="Take payment online" hint="Guests pay this share by mobile money only after you confirm the booking. Nothing is charged before.">
              <select value={b.depositPercent} onChange={(e) => set({ depositPercent: Number(e.target.value) })}>
                <option value={0}>No, guests pay me directly</option>
                <option value={20}>20% deposit</option>
                <option value={30}>30% deposit</option>
                <option value={50}>50% deposit</option>
                <option value={100}>Full amount</option>
              </select>
            </Field>
            {b.depositPercent > 0 ? (
              <Field label="Guest must pay within (hours)" hint="After you confirm. Unpaid bookings expire and free the dates.">
                <input type="number" min="1" max="72" value={b.payWithinHours} onChange={num("payWithinHours")} />
              </Field>
            ) : null}
          </div>
          <Field label="Payment note (optional)" hint="Shown to guests, e.g. balance due on arrival">
            <input maxLength={200} value={b.depositNote} onChange={(e) => set({ depositNote: e.target.value })} />
          </Field>
          <Field label="House rules & instructions (optional)" hint="Guests see this once the booking is confirmed" as="div">
            <textarea rows="3" maxLength={600} value={b.instructions} onChange={(e) => set({ instructions: e.target.value })} />
          </Field>

          <Field label="Dates you're not available" as="div">
            <div className="booking-block-row">
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} />
              <button type="button" className="secondary-button" onClick={addBlocked}>Block date</button>
            </div>
            {b.blockedDates.length ? (
              <div className="booking-chips">
                {b.blockedDates.map((d) => (
                  <span key={d} className="booking-chip">{d}<button type="button" aria-label={`Unblock ${d}`} onClick={() => set({ blockedDates: b.blockedDates.filter((x) => x !== d) })}>×</button></span>
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
      .catch((loadError) => setError(loadError.message || "Unable to load this page."))
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
    if (!categoryPath[0]) {
      setError(`Choose a category for this ${form.type}.`);
      return;
    }
    if (!form[categoryIdKey]) {
      setError(`Choose a more specific subcategory for this ${form.type}.`);
      return;
    }
    if (isService && form.bookingMode !== "none" && !(Number(form.price) > 0)) {
      setError(`Set a price per ${UNIT_LABEL[form.booking.unit]} so guests can book.`);
      return;
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
      setError(submitError.message || "Unable to save this listing.");
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
            <p className="eyebrow">{isEditing ? "Edit" : "Add"}</p>
            <h2>{isEditing ? "Edit product or service" : "Add a product or service"}</h2>
          </div>

          {error ? <div className="error-message">{error}</div> : null}

          <form className="registration-form listing-form-standalone" onSubmit={submit}>
            <section>
              <h3>Details</h3>
              <div className="form-grid two">
                <Field label="Type">
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, customFields: {} })}>
                    <option value="service">Service</option>
                    <option value="product">Product</option>
                  </select>
                </Field>
                {productLevels.map((level) => (
                  <Field key={level.depth} label={level.depth === 0 ? "Category *" : "Subcategory *"}>
                    <select value={level.selectedId} onChange={(e) => selectProductCategoryAtDepth(level.depth, e.target.value)}>
                      <option value="">{level.depth === 0 ? "Choose a category" : "Choose a subcategory"}</option>
                      {level.options.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </Field>
                ))}
                <Field label="Name">
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <Field label={isService && form.bookingMode !== "none" ? `Price per ${UNIT_LABEL[form.booking.unit]} (UGX)` : "Price (UGX)"}>
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

              {!tree.length ? (
                <p className="provider-meta">
                  No {isService ? "service" : "shop"} categories exist yet — ask an admin to create one before you can add a {form.type}.
                </p>
              ) : null}

              {categoryPath[0] ? (
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
              {isService ? (
                <p className="provider-meta listing-guard-note">
                  Describe the service itself. Don&apos;t put phone numbers, WhatsApp, emails, links or addresses in the text or the photos &mdash; customers get your contact details when they unlock them, and listings that include them are rejected.
                </p>
              ) : null}
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
                    <span>Let customers pay online with mobile money after you accept their order</span>
                  </label>
                </Field>
              ) : null}
            </section>

            {isService ? (
              <BookingSection form={form} setForm={setForm} blockDate={blockDate} setBlockDate={setBlockDate} />
            ) : null}

            {listingFields.length ? (
              <section>
                <h3>More about this {activeFieldsCategory?.name?.toLowerCase() || "listing"}</h3>
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
