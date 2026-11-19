import React, { useEffect, useRef, useState, useCallback } from "react";
import { apiRequest } from "../../lib/api.js";
import { uploadFileToStorage } from "../../lib/upload.js";
import { ModalShell } from "./shared.jsx";
import "./managed-bus.css";
const money = (v) => `UGX ${Number(v || 0).toLocaleString()}`;
const when = (v) =>
  v
    ? new Date(v).toLocaleString("en-GB", {
        timeZone: "Africa/Kampala",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }) + " EAT"
    : "—";
const human = (v) => (v || "").replaceAll("_", " ");
const Icon = ({ name }) => <i aria-hidden="true" className={`ph ph-${name}`} />;
function Field({ label, children, ...p }) {
  return (
    <label className="bm-field">
      <span>{label}</span>
      {children || <input {...p} />}
    </label>
  );
}
export function StageMap({ loadMaps, value, onChange }) {
  const node = useRef(null),
    map = useRef(null),
    marker = useRef(null);
  const [error, setError] = useState("");
  const latest = useRef(value);
  latest.current = value;
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    let active = true,
      listener;
    if (!loadMaps) {
      setError("Map unavailable. Enter coordinates below.");
      return;
    }
    loadMaps()
      .then(() => {
        if (!active) return;
        const current = latest.current;
        const pos = {
          lat: Number(current.parkLat || 0.3136),
          lng: Number(current.parkLng || 32.5811),
        };
        map.current = new window.google.maps.Map(node.current, {
          center: pos,
          zoom: 14,
          mapTypeId: "hybrid",
          mapTypeControl: true,
          streetViewControl: false,
        });
        marker.current = new window.google.maps.Marker({
          map: map.current,
          position:
            current.parkLat !== undefined && current.parkLat !== ""
              ? pos
              : null,
        });
        listener = map.current.addListener("click", (e) => {
          const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          marker.current.setPosition(point);
          cb.current(point);
        });
      })
      .catch(() =>
        setError(
          "Map could not load. Check the Maps key, or enter coordinates below.",
        ),
      );
    return () => {
      active = false;
      listener?.remove();
    };
  }, [loadMaps]);
  useEffect(() => {
    const lat = Number(value.parkLat),
      lng = Number(value.parkLng);
    if (
      value.parkLat !== "" &&
      value.parkLng !== "" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      marker.current
    ) {
      marker.current.setPosition({ lat, lng });
      map.current?.panTo({ lat, lng });
    }
  }, [value.parkLat, value.parkLng]);
  return (
    <div className="bm-map">
      <div ref={node} style={{ height: 260 }} />
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <small>
          Tap the exact boarding stage. Switch map type using the map controls.
        </small>
      )}
    </div>
  );
}
export function CroppedUpload({ token, value, onChange }) {
  const [source, setSource] = useState(""),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(50),
    [y, setY] = useState(50),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const canvas = useRef(null),
    img = useRef(null);
  useEffect(() => {
    if (!source) return;
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (alive) {
        img.current = image;
        draw(image);
      }
    };
    image.src = source;
    return () => {
      alive = false;
    };
  }, [source]);
  const draw = useCallback(
    (image = img.current) => {
      if (!image || !canvas.current) return;
      const c = canvas.current,
        ctx = c.getContext("2d"),
        side = Math.min(image.width, image.height) / zoom;
      ctx.drawImage(
        image,
        ((image.width - side) * x) / 100,
        ((image.height - side) * y) / 100,
        side,
        side,
        0,
        0,
        512,
        512,
      );
    },
    [zoom, x, y],
  );
  useEffect(() => draw(), [draw]);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source);
    },
    [source],
  );
  async function save() {
    setBusy(true);
    setError("");
    try {
      const blob = await new Promise((r) =>
        canvas.current.toBlob(r, "image/jpeg", 0.9),
      );
      if (!blob) throw Error("Choose a valid image");
      const result = await uploadFileToStorage({
        file: new File([blob], "bus-logo.jpg", { type: "image/jpeg" }),
        token,
        folder: "bus-operators",
      });
      onChange(result.url);
      setSource("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bm-upload">
      {value && !source ? (
        <img src={value} alt="Company or bus picture" />
      ) : null}
      <Field label="Logo or bus picture">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const f = e.target.files[0];
            if (!f) return;
            if (f.size > 10 * 1024 * 1024) {
              setError("Choose a picture below 10 MB");
              return;
            }
            setZoom(1);
            setX(50);
            setY(50);
            setSource(URL.createObjectURL(f));
          }}
        />
      </Field>
      {source ? (
        <>
          <canvas width="512" height="512" ref={canvas} className="bm-crop" />
          <div className="bm-grid">
            <Field label="Zoom">
              <input
                type="range"
                min="1"
                max="4"
                step=".05"
                value={zoom}
                onChange={(e) => setZoom(+e.target.value)}
              />
            </Field>
            <Field label="Horizontal position">
              <input
                type="range"
                min="0"
                max="100"
                value={x}
                onChange={(e) => setX(+e.target.value)}
              />
            </Field>
            <Field label="Vertical position">
              <input
                type="range"
                min="0"
                max="100"
                value={y}
                onChange={(e) => setY(+e.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            className="bm-btn"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Uploading…" : "Use this crop"}
          </button>
          <button type="button" onClick={() => setSource("")}>
            Discard crop
          </button>
          <small>Finish the crop before saving the form.</small>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
export function ManagedBusDesk({
  token,
  loadMaps,
  initialTab = "companies",
  embedded = false,
}) {
  const [companies, setCompanies] = useState([]),
    [company, setCompany] = useState(null),
    [tab, setTab] = useState(initialTab),
    [trips, setTrips] = useState([]),
    [bookings, setBookings] = useState([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [ops, setOps] = useState(""),
    [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const request = useCallback(
    (path, method = "GET", body) =>
      apiRequest(`/bus/admin${path}`, {
        token,
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    [token],
  );
  const selected = company?.id;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "companies") {
        const d = await request("/operators?limit=100");
        setCompanies(d.items || []);
      } else if (tab === "bookings") {
        const p = new URLSearchParams({
          page,
          limit: 30,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(ops ? { operationStatus: ops } : {}),
          ...(selected ? { operatorId: selected } : {}),
        });
        const d = await request(`/desk/bookings?${p}`);
        setBookings(d.items);
        setTotal(d.total);
      } else if (tab === "departures" && selected) {
        const d = await request(`/companies/${selected}/trips`);
        setTrips(d.items);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [request, tab, selected, page, q, status, ops]);
  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);
  useEffect(() => {
    if (tab !== "bookings" && tab !== "departures") return;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load, tab]);
  async function openCompany(id) {
    setError("");
    try {
      setCompany(await request(`/companies/${id}`));
      setTab("fleet");
    } catch (e) {
      setError(e.message);
    }
  }
  function edit(kind, data = {}) {
    setError("");
    setModal({ kind, data });
    const values = { ...data };
    if (kind === "company") {
      Object.assign(values, {
        ...data,
        email: data.contactEmail || "",
        contactName: data.contactName || data.operationalContact || "",
        parkLat: data.parkLat ?? "",
        parkLng: data.parkLng ?? "",
      });
    }
    if (kind === "bus") {
      Object.assign(values, {
        seats: 60,
        cancellationMinutes: 120,
        ...data,
        amenities: (data.amenities || []).join(", "),
      });
    }
    if (kind === "route") {
      Object.assign(values, {
        originName: company?.parkDistrict || "Kampala",
        boardingPoint: company?.parkName || "",
        durationMinutes: 180,
        vehicleId: company?.vehicles?.[0]?.id || "",
        price: 30000,
        fareName: "Standard",
        time: "08:00",
        ...data,
      });
    }
    if (kind === "schedule") {
      Object.assign(values, {
        departureTime: "08:00",
        seats: 60,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        routeId: company?.routes?.[0]?.id || "",
        ...data,
      });
    }
    if (kind === "handover")
      Object.assign(values, {
        amount: data.netAmount,
        recipient: data.trip.vehicle?.contactName || "",
        phone: data.trip.vehicle?.contactPhone || "",
        reference: "",
      });
    setForm(values);
  }
  const field = (name, label, type = "text", extra = {}) => (
    <Field
      label={label}
      type={type}
      value={form[name] ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      {...extra}
    />
  );
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const kind = modal.kind,
      old = modal.data;
    try {
      let path,
        method = "POST",
        body;
      if (kind === "company") {
        path = old.id ? `/companies/${old.id}` : "/companies";
        method = old.id ? "PATCH" : "POST";
        body = Object.fromEntries(
          [
            "companyName",
            "contactName",
            "contactPhone",
            "email",
            "parkName",
            "parkDistrict",
            "parkAddress",
            "logoUrl",
            "description",
            "parkLat",
            "parkLng",
          ].map((k) => [
            k,
            ["parkLat", "parkLng"].includes(k)
              ? Number(form[k])
              : (form[k] ?? ""),
          ]),
        );
        if (form.parkLat === "" || form.parkLng === "")
          throw Error("Pick the stage on the map or enter both coordinates.");
      }
      if (kind === "bus") {
        path = `/companies/${selected}/buses${old.id ? `/${old.id}` : ""}`;
        method = old.id ? "PATCH" : "POST";
        body = {
          name: form.name,
          registration: form.registration,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          seats: +form.seats,
          cancellationMinutes: +form.cancellationMinutes,
          amenities: form.amenities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          imageUrl: form.imageUrl || null,
          isActive: form.isActive ?? true,
        };
      }
      if (kind === "route") {
        path = `/companies/${selected}/routes${old.id ? `/${old.id}` : ""}`;
        method = old.id ? "PATCH" : "POST";
        body = {
          originName: form.originName,
          destinationName: form.destinationName,
          boardingPoint: form.boardingPoint,
          dropoffPoint: form.dropoffPoint || "",
          durationMinutes: +form.durationMinutes,
          vehicleId: form.vehicleId,
          ...(!old.id
            ? {
                ticketTypes: [{ name: form.fareName, price: +form.price }],
                departures: [
                  {
                    departureTime: form.time,
                    seats:
                      company.vehicles.find((v) => v.id === form.vehicleId)
                        ?.seats || 60,
                  },
                ],
              }
            : {}),
        };
      }
      if (kind === "schedule") {
        path = `/companies/${selected}/schedules${old.id ? `/${old.id}` : ""}`;
        method = old.id ? "PATCH" : "POST";
        body = {
          departureTime: form.departureTime,
          seats: +form.seats,
          daysOfWeek: form.daysOfWeek,
          ...(!old.id ? { routeId: form.routeId } : {}),
          ...(form.startDate ? { startDate: form.startDate } : {}),
          endDate: form.endDate || null,
          isActive: form.isActive ?? true,
        };
      }
      if (kind === "fare") {
        path = old.id
          ? `/companies/${selected}/prices/${old.id}`
          : `/companies/${selected}/routes/${old.routeId}/prices`;
        method = old.id ? "PATCH" : "POST";
        body = {
          name: form.name,
          description: form.description || "",
          price: +form.price,
          ...(old.id ? { isActive: form.isActive ?? true } : {}),
        };
      }
      if (["check", "handover", "refund"].includes(kind)) {
        path = `/desk/bookings/${old.id}/${kind}`;
        body =
          kind === "check"
            ? { available: form.available !== "no", note: form.note }
            : kind === "handover"
              ? {
                  amount: +form.amount,
                  recipient: form.recipient,
                  phone: form.phone,
                  reference: form.reference,
                }
              : { reference: form.reference };
      }
      if (["delay", "availability", "cancel", "status"].includes(kind)) {
        path = `/companies/${old.operatorId || selected}/trips/${old.id}/${kind}`;
        body =
          kind === "delay"
            ? { delayMinutes: +form.delayMinutes, note: form.note }
            : kind === "availability"
              ? { available: form.available !== "no", note: form.note }
              : kind === "cancel"
                ? { reason: form.reason }
                : { status: form.status };
      }
      const result = await request(path, method, body);
      setModal(null);
      setNotice("Saved successfully.");
      if (kind === "company") await openCompany(old.id || result.id);
      else if (["bus", "route", "schedule", "fare"].includes(kind))
        await openCompany(selected);
      else await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bm-desk">
      {!embedded && (
        <>
          <header className="bm-head">
            <div>
              <span className="bm-eyebrow">
                <Icon name="bus" /> GABLA TRANSPORT
              </span>
              <h1>Bus operations</h1>
              <p>
                Companies, departures and passenger bookings. Managed by your
                team.
              </p>
            </div>
            <button className="bm-btn bm-white" onClick={() => edit("company")}>
              <Icon name="plus" /> Add company
            </button>
          </header>
          <nav className="bm-nav" aria-label="Bus operations">
            {[
              ["companies", "buildings", "Companies"],
              ["departures", "clock", "Departure board"],
              ["bookings", "ticket", "Bookings & money"],
            ].map(([id, icon, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => {
                  setTab(id);
                  setPage(1);
                }}
              >
                <Icon name={icon} />
                {label}
              </button>
            ))}
            <button className="bm-refresh" onClick={load} aria-label="Refresh">
              <Icon name="arrow-clockwise" />
            </button>
          </nav>
        </>
      )}
      {notice ? (
        <div role="status" className="bm-notice">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {error && !modal ? (
        <div className="bm-error" role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </div>
      ) : null}
      {company ? (
        <div className="bm-context">
          <button
            onClick={() => {
              setCompany(null);
              setTab("companies");
            }}
          >
            All companies
          </button>
          <span>/</span>
          <b>{company.companyName}</b>
          <button onClick={() => edit("company", company)}>Edit profile</button>
        </div>
      ) : null}
      {loading ? (
        <div className="bm-loading" role="status">
          Loading bus operations…
        </div>
      ) : null}
      {tab === "companies" ? (
        <>
          <div className="bm-section-head">
            <div>
              <h2>Bus service providers</h2>
              <p>
                Select a company to manage its fleet, fares and departure times.
              </p>
            </div>
            <div className="bm-actions">
              <span>{companies.length} companies</span>
              <button onClick={() => edit("company")}>+ Add company</button>
            </div>
          </div>
          <div className="bm-companies">
            {companies.map((c) => (
              <button
                key={c.id}
                className="bm-company"
                onClick={() => openCompany(c.id)}
              >
                <div className="bm-company-image">
                  {c.logoUrl ? (
                    <img src={c.logoUrl} alt="" />
                  ) : (
                    <Icon name="bus" />
                  )}
                  <span className={`bm-tag ${c.isDemo ? "amber" : ""}`}>
                    {c.isDemo ? "Demo · no payments" : human(c.status)}
                  </span>
                </div>
                <div className="bm-company-body">
                  <h3>{c.companyName}</h3>
                  <p>
                    <Icon name="map-pin" /> {c.parkName || "Stage not set"} ·{" "}
                    {c.parkDistrict || "Location not set"}
                  </p>
                  <div>
                    <span>
                      {c.operationalContact ||
                        c.contactName ||
                        "Contact not set"}
                    </span>
                    <Icon name="arrow-up-right" />
                  </div>
                </div>
              </button>
            ))}
          </div>
          {!loading && !companies.length ? (
            <div className="bm-empty">
              <Icon name="bus" />
              <h3>Add your first bus company</h3>
              <p>
                Save the company, contact person and boarding stage. Then add
                its buses.
              </p>
              <button className="bm-btn" onClick={() => edit("company")}>
                Add company
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      {tab === "fleet" && company ? (
        <>
          <section className="bm-company-summary">
            <div>
              <h2>{company.companyName}</h2>
              <p>
                {company.parkName} · {company.parkAddress}
              </p>
              <a href={`tel:${company.contactPhone}`}>
                <Icon name="phone" /> {company.contactName} ·{" "}
                {company.contactPhone}
              </a>
            </div>
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${company.parkLat},${company.parkLng}`}
            >
              View stage <Icon name="map-pin" />
            </a>
          </section>
          <div className="bm-section-head">
            <div>
              <h2>Fleet</h2>
              <p>
                Each bus has its own contact, capacity and cancellation policy.
              </p>
            </div>
            <button className="bm-btn" onClick={() => edit("bus")}>
              + Add bus
            </button>
          </div>
          <div className="bm-fleet">
            {company.vehicles.map((v) => (
              <article className="bm-bus" key={v.id}>
                <div className="bm-bus-icon">
                  {v.imageUrl ? (
                    <img src={v.imageUrl} alt="" />
                  ) : (
                    <Icon name="bus" />
                  )}
                </div>
                <div>
                  <span className="bm-eyebrow">{v.registration}</span>
                  <h3>{v.name}</h3>
                  <p>
                    {v.seats} seats · Cancel until {v.cancellationMinutes} min
                    before departure{!v.isActive ? " · Inactive" : ""}
                  </p>
                  <a href={`tel:${v.contactPhone}`}>
                    {v.contactName} · {v.contactPhone}
                  </a>
                  <p>{(v.amenities || []).join(" · ")}</p>
                </div>
                <button className="bm-link" onClick={() => edit("bus", v)}>
                  Edit bus
                </button>
              </article>
            ))}
          </div>
        </>
      ) : null}
      {tab === "departures" ? (
        selected ? (
          <>
            <div className="bm-section-head">
              <div>
                <h2>Departure board</h2>
                <p>
                  Automatic time updates run every minute. Call the bus contact
                  to check availability.
                </p>
              </div>
            </div>
            <div className="bm-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Departure</th>
                    <th>Route / bus contact</th>
                    <th>Seats</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>
                          {when(t.effectiveDepartureAt || t.departureAt)}
                        </strong>
                        {t.delayMinutes > 0 ? (
                          <small>Delayed {t.delayMinutes} min</small>
                        ) : null}
                      </td>
                      <td>
                        <b>{t.route.name}</b>
                        <small>{t.vehicle?.name || "Bus not assigned"}</small>
                        {t.vehicle ? (
                          <a href={`tel:${t.vehicle.contactPhone}`}>
                            {t.vehicle.contactName} · {t.vehicle.contactPhone}
                          </a>
                        ) : null}
                      </td>
                      <td>
                        {t.seatsTaken}/{t.seats}
                      </td>
                      <td>
                        <span
                          className={`bm-tag ${t.availability === "unavailable" ? "amber" : ""}`}
                        >
                          {human(t.status)}
                        </span>
                        <small>
                          {t.availability}
                          {t.availabilityCheckedAt
                            ? ` · checked ${when(t.availabilityCheckedAt)}`
                            : ""}
                        </small>
                        <small>{t.availabilityNote}</small>
                      </td>
                      <td>
                        <div className="bm-actions">
                          {t.status === "scheduled" ? (
                            <>
                              <button onClick={() => edit("availability", t)}>
                                Availability
                              </button>
                              <button onClick={() => edit("delay", t)}>
                                Adjust time
                              </button>
                              <button
                                onClick={() =>
                                  edit("status", { ...t, status: "departed" })
                                }
                              >
                                Depart
                              </button>
                              <button onClick={() => edit("cancel", t)}>
                                Cancel trip
                              </button>
                            </>
                          ) : t.status === "departed" ? (
                            <>
                              <button onClick={() => edit("delay", t)}>
                                Still at stage? Adjust time
                              </button>
                              <button
                                onClick={() =>
                                  edit("status", { ...t, status: "completed" })
                                }
                              >
                                Complete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bm-empty">
            <Icon name="buildings" />
            <h3>Choose a company first</h3>
            <p>Open a company card, then return to the departure board.</p>
            <button className="bm-btn" onClick={() => setTab("companies")}>
              View companies
            </button>
          </div>
        )
      ) : null}
      {tab === "bookings" ? (
        <>
          <div className="bm-section-head">
            <div>
              <h2>Bookings & cash handovers</h2>
              <p>
                Check the bus by phone, then record the cash paid to its contact
                after cancellation closes.
              </p>
            </div>
          </div>
          <div className="bm-filters">
            <input
              aria-label="Search bookings"
              placeholder="Reference, passenger or payment phone"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Booking status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All payment states</option>
              {[
                "confirmed",
                "pending_payment",
                "refund_due",
                "cancelled",
                "failed",
                "expired",
              ].map((v) => (
                <option key={v} value={v}>
                  {human(v)}
                </option>
              ))}
            </select>
            <select
              aria-label="Operations status"
              value={ops}
              onChange={(e) => {
                setOps(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All operations</option>
              {[
                "awaiting_call",
                "bus_confirmed",
                "needs_attention",
                "handed_over",
              ].map((v) => (
                <option key={v} value={v}>
                  {human(v)}
                </option>
              ))}
            </select>
          </div>
          <div className="bm-bookings">
            {bookings.map((b) => (
              <article key={b.id} className="bm-booking">
                <div className="bm-booking-title">
                  <span>
                    <b>{b.reference}</b> · {b.operator.companyName}
                  </span>
                  <span className="bm-tag">{human(b.status)}</span>
                </div>
                <div className="bm-booking-columns">
                  <section>
                    <h3>
                      {b.trip.route.originName} → {b.trip.route.destinationName}
                    </h3>
                    <p>
                      {when(b.effectiveDepartureAt)} · {b.seatCount}{" "}
                      passenger(s)
                    </p>
                    <strong>{b.passengerName}</strong>
                    <p>
                      <a href={`tel:${b.passengerPhone}`}>{b.passengerPhone}</a>{" "}
                      · {b.passengerEmail || "Account email"}
                    </p>
                    <small>
                      Payment phone: {b.payPhone} · Received{" "}
                      {when(b.confirmedAt)}
                    </small>
                    <p className="bm-policy">
                      Cancellation closes {when(b.cancellationClosesAt)}
                      {b.lockedAt ? " · Locked" : ""}
                    </p>
                  </section>
                  <section className="bm-money">
                    <span>Customer paid</span>
                    <b>{money(b.total)}</b>
                    <small>
                      Gabla fee {money(b.fee)} · Bus receives{" "}
                      {money(b.netAmount)}
                    </small>
                    <p>
                      <span className="bm-tag">{human(b.operationStatus)}</span>
                    </p>
                    {b.trip.vehicle ? (
                      <a href={`tel:${b.trip.vehicle.contactPhone}`}>
                        <Icon name="phone" /> {b.trip.vehicle.contactName} ·{" "}
                        {b.trip.vehicle.contactPhone}
                      </a>
                    ) : null}
                    <small>{b.operationNote}</small>
                    {b.handoverAt ? (
                      <p>
                        Handed over {money(b.handoverAmount)} to{" "}
                        {b.handoverRecipient} ({b.handoverPhone}) ·{" "}
                        {when(b.handoverAt)}
                        <br />
                        Reference: {b.handoverReference}
                      </p>
                    ) : null}
                    {b.refundedAt ? (
                      <p>
                        Refund recorded {when(b.refundedAt)} ·{" "}
                        {b.refundReference}
                      </p>
                    ) : null}
                  </section>
                </div>
                <footer className="bm-booking-foot">
                  <span>
                    {b.notifications.filter((n) => n.status === "sent").length}{" "}
                    email(s) sent
                    {b.notifications.some((n) => n.status !== "sent")
                      ? " · Email retry pending"
                      : ""}
                  </span>
                  <div className="bm-actions">
                    {b.status === "confirmed" && !b.handoverAt ? (
                      <>
                        <button onClick={() => edit("check", b)}>
                          Record availability call
                        </button>
                        <button
                          disabled={
                            b.canCancel || b.operationStatus !== "bus_confirmed"
                          }
                          onClick={() => edit("handover", b)}
                        >
                          Record cash handover
                        </button>
                      </>
                    ) : null}
                    {b.status === "refund_due" ? (
                      <button onClick={() => edit("refund", b)}>
                        Record completed refund
                      </button>
                    ) : null}
                  </div>
                </footer>
              </article>
            ))}
          </div>
          {!loading && !bookings.length ? (
            <div className="bm-empty">No bookings match these filters.</div>
          ) : null}
          <div className="bm-pagination">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>
              {total} bookings · Page {page}
            </span>
            <button
              disabled={page * 30 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
      <ModalShell
        open={!!modal}
        onClose={() => {
          if (!busy) {
            setModal(null);
            setError("");
          }
        }}
        maxWidth="max-w-3xl"
      >
        {modal ? (
          <form className="bm-form" onSubmit={save}>
            <header>
              <div>
                <span className="bm-eyebrow">BUS OPERATIONS</span>
                <h2>
                  {
                    {
                      company: "Company profile",
                      bus: "Bus details",
                      route: "Route & fare",
                      schedule: "Departure schedule",
                      fare: "Ticket price",
                      check: "Record availability call",
                      handover: "Record physical cash handover",
                      refund: "Record completed refund",
                      delay: "Adjust this departure",
                      availability: "Bus availability",
                      cancel: "Cancel trip",
                      status: "Update trip status",
                    }[modal.kind]
                  }
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close form"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                ×
              </button>
            </header>
            {modal.kind === "company" ? (
              <>
                <div className="bm-grid">
                  {field("companyName", "Company name", "text", {
                    required: true,
                    maxLength: 120,
                  })}
                  {field("contactName", "Contact person", "text", {
                    required: true,
                  })}
                  {field("contactPhone", "Contact phone", "tel", {
                    required: true,
                    minLength: 7,
                  })}
                  {field("email", "Contact email (optional)", "email")}
                  {field("parkName", "Stage / bus park name", "text", {
                    required: true,
                  })}
                  {field("parkDistrict", "Town / district", "text", {
                    required: true,
                  })}
                </div>
                {field("parkAddress", "Stage address")}
                <StageMap
                  loadMaps={loadMaps}
                  value={form}
                  onChange={(p) =>
                    setForm((f) => ({ ...f, parkLat: p.lat, parkLng: p.lng }))
                  }
                />
                <div className="bm-grid">
                  {field("parkLat", "Stage latitude", "number", {
                    step: "any",
                    min: -90,
                    max: 90,
                    required: true,
                  })}
                  {field("parkLng", "Stage longitude", "number", {
                    step: "any",
                    min: -180,
                    max: 180,
                    required: true,
                  })}
                </div>
                <CroppedUpload
                  token={token}
                  value={form.logoUrl}
                  onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                />
                {field("description", "About the company")}
              </>
            ) : null}
            {modal.kind === "bus" ? (
              <>
                <div className="bm-grid">
                  {field("name", "Bus name / model", "text", {
                    required: true,
                  })}
                  {field(
                    "registration",
                    "Registration / fleet number",
                    "text",
                    { required: true },
                  )}
                  {field("contactName", "Bus contact person", "text", {
                    required: true,
                  })}
                  {field("contactPhone", "Bus contact phone", "tel", {
                    required: true,
                    minLength: 7,
                  })}
                  {field("seats", "Passenger capacity", "number", {
                    required: true,
                    min: 1,
                    max: 120,
                  })}
                  {field(
                    "cancellationMinutes",
                    "Cancellation closes (minutes before departure)",
                    "number",
                    { required: true, min: 0, max: 10080 },
                  )}
                </div>
                {field(
                  "amenities",
                  "Included services, separated by commas",
                  "text",
                  { placeholder: "Air conditioning, USB charging, Luggage" },
                )}
                <CroppedUpload
                  token={token}
                  value={form.imageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                  />{" "}
                  Bus active for new routes
                </label>
              </>
            ) : null}
            {modal.kind === "route" ? (
              <>
                <Field label="Bus">
                  <select
                    required
                    value={form.vehicleId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, vehicleId: e.target.value }))
                    }
                  >
                    <option value="">Choose a bus</option>
                    {company.vehicles
                      .filter((v) => v.isActive)
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.registration} · {v.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <div className="bm-grid">
                  {field("originName", "From", "text", { required: true })}
                  {field("destinationName", "To", "text", { required: true })}
                  {field("boardingPoint", "Boarding point", "text", {
                    required: true,
                  })}
                  {field("dropoffPoint", "Drop-off point")}
                  {field(
                    "durationMinutes",
                    "Journey duration (minutes)",
                    "number",
                    { min: 10, max: 4000, required: true },
                  )}
                  {!modal.data.id
                    ? field("time", "Daily departure · EAT", "time", {
                        required: true,
                      })
                    : null}
                </div>
                {!modal.data.id ? (
                  <div className="bm-grid">
                    {field("fareName", "Ticket type", "text", {
                      required: true,
                    })}
                    {field("price", "Price per passenger · UGX", "number", {
                      min: 0,
                      required: true,
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
            {modal.kind === "schedule" ? (
              <>
                <Field label="Route">
                  <select
                    disabled={!!modal.data.id}
                    required
                    value={form.routeId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, routeId: e.target.value }))
                    }
                  >
                    {company.routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="bm-grid">
                  {field("departureTime", "Departure · EAT", "time", {
                    required: true,
                  })}
                  {field("seats", "Available seats", "number", {
                    min: 1,
                    max: 120,
                    required: true,
                  })}
                  {field("startDate", "Start date", "date")}
                  {field("endDate", "End date (optional)", "date")}
                </div>
                <fieldset>
                  <legend>Operating days</legend>
                  <div className="bm-days">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (d, i) => (
                        <label key={d}>
                          <input
                            type="checkbox"
                            checked={form.daysOfWeek.includes(i)}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                daysOfWeek: e.target.checked
                                  ? [...f.daysOfWeek, i]
                                  : f.daysOfWeek.filter((n) => n !== i),
                              }))
                            }
                          />
                          {d}
                        </label>
                      ),
                    )}
                  </div>
                </fieldset>
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                  />{" "}
                  Schedule active
                </label>
              </>
            ) : null}
            {modal.kind === "fare" ? (
              <>
                {field("name", "Ticket type", "text", { required: true })}
                {field("price", "Price · UGX", "number", {
                  required: true,
                  min: 0,
                })}
                {field("description", "Included extras")}
                <label>
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                  />{" "}
                  Available to passengers
                </label>
              </>
            ) : null}
            {["check", "availability"].includes(modal.kind) ? (
              <>
                <p>Call the bus contact before recording the result.</p>
                <Field label="Is the bus available?">
                  <select
                    value={form.available || "yes"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, available: e.target.value }))
                    }
                  >
                    <option value="yes">Yes · available</option>
                    <option value="no">No · needs attention</option>
                  </select>
                </Field>
                {field(
                  "note",
                  "Who did you speak to? Add the call outcome.",
                  "text",
                  { required: true, minLength: 3 },
                )}
              </>
            ) : null}
            {modal.kind === "handover" ? (
              <>
                <div className="bm-policy">
                  This records a physical cash payment already made. It does not
                  transfer money online.
                </div>
                <div className="bm-grid">
                  {field("recipient", "Recipient name", "text", {
                    required: true,
                  })}
                  {field("phone", "Recipient phone", "tel", {
                    required: true,
                    minLength: 7,
                  })}
                  {field("amount", "Cash handed over · UGX", "number", {
                    required: true,
                    readOnly: true,
                  })}
                  {field("reference", "Handover receipt / reference", "text", {
                    required: true,
                    minLength: 2,
                  })}
                </div>
              </>
            ) : null}
            {modal.kind === "refund" ? (
              <>
                <p>
                  Return {money(modal.data.total)} to {modal.data.payPhone}{" "}
                  first, then record its payment reference.
                </p>
                {field("reference", "Refund payment reference", "text", {
                  required: true,
                  minLength: 2,
                })}
              </>
            ) : null}
            {modal.kind === "delay" ? (
              <>
                {field(
                  "delayMinutes",
                  "Delay from original departure (minutes)",
                  "number",
                  { required: true, min: 0, max: 720 },
                )}
                {field("note", "Reason / update for passengers", "text", {
                  required: true,
                })}
                <p>
                  Passengers receive a trip update. Existing locked bookings
                  remain non-refundable.
                </p>
              </>
            ) : null}
            {modal.kind === "cancel" ? (
              <>
                <p>
                  This cancels the departure for every passenger and marks paid
                  bookings for a refund.
                </p>
                {field("reason", "Reason for cancellation", "text", {
                  required: true,
                  minLength: 3,
                })}
              </>
            ) : null}
            {modal.kind === "status" ? (
              <p>
                Mark this bus as <strong>{form.status}</strong>? This updates
                the passenger journey and closes cancellation for a departed
                bus.
              </p>
            ) : null}
            {error ? (
              <p className="bm-error" role="alert">
                {error}
              </p>
            ) : null}
            <footer>
              <button
                type="button"
                className="bm-secondary"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button className="bm-btn" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </button>
            </footer>
          </form>
        ) : null}
      </ModalShell>
    </div>
  );
}
