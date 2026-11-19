import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api.js";
import { ModalShell } from "./shared.jsx";
import { ManagedBusDesk, StageMap } from "./ManagedBusDesk.jsx";
import "./managed-bus.css";
const eatDate = (d = new Date()) =>
  new Date(+new Date(d) + 10800000).toISOString().slice(0, 10);
const money = (v) => `UGX ${Number(v || 0).toLocaleString()}`;
const when = (v) =>
  new Date(v).toLocaleString("en-GB", {
    timeZone: "Africa/Kampala",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " EAT";
const tomorrow = () => eatDate(new Date(Date.now() + 86400000));
const Field = ({ label, children, ...props }) => (
  <label className="bm-field">
    <span>{label}</span>
    {children ? React.cloneElement(children,{"aria-label":label}) : <input aria-label={label} {...props} />}
  </label>
);
export function RouteFirstDesk({ token, loadMaps }) {
  const [page, setPage] = useState("routes"),
    [routes, setRoutes] = useState([]),
    [selected, setSelected] = useState(null),
    [detail, setDetail] = useState(null),
    [companies, setCompanies] = useState([]),
    [fleet, setFleet] = useState([]),
    [trips, setTrips] = useState([]),
    [date, setDate] = useState(eatDate()),
    [q, setQ] = useState(""),
    [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const generation = useRef(0);
  const request = useCallback(
    (path, method = "GET", body) =>
      apiRequest(`/bus/admin${path}`, {
        token,
        method,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    [token],
  );
  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const data = await request(
        selected ? `/routes/${selected}` : `/routes?q=${encodeURIComponent(q)}`,
      );
      const departures = selected
        ? await request(`/routes/${selected}/trips?from=${date}&to=${date}`)
        : null;
      if (version !== generation.current) return;
      if (selected) {
        setDetail(data);
        setTrips(departures.items);
      } else setRoutes(data.items);
    } catch (e) {
      if (version === generation.current) setError(e.message);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [request, selected, q, date]);
  useEffect(() => {
    if (page !== "routes") return;
    const t = setTimeout(refresh, 200);
    return () => {
      clearTimeout(t);
      generation.current++;
    };
  }, [page, refresh]);
  useEffect(() => {
    if (!selected || page !== "routes") return;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [selected, page, refresh]);
  useEffect(() => {
    if (modal?.kind !== "bus" || !form.operatorId) return;
    let alive = true;
    setFleet([]);
    request(`/companies/${form.operatorId}`)
      .then((c) => {
        if (!alive) return;
        const vehicles = c.vehicles.filter((v) => v.isActive);
        setFleet(vehicles);
        setForm((f) => ({
          ...f,
          vehicleId: vehicles[0]?.id || "",
          pickupName: c.parkName || "",
          pickupLat: c.parkLat ?? "",
          pickupLng: c.parkLng ?? "",
          contactName: c.contactName || "",
          contactPhone: c.contactPhone || "",
        }));
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [form.operatorId, modal?.kind, request]);
  function show(kind, item = {}) {
    setError("");
    setModal({ kind, item });
    setForm(
      kind === "bus"
        ? {
            operatorId: "",
            vehicleId: "",
            pickupName: "",
            pickupLat: "",
            pickupLng: "",
            date: tomorrow(),
            departureTime: "08:00",
            repeatDaily: true,
            price: "",
            fareName: "Standard",
            durationMinutes: detail?.durationMinutes || 180,
            seats: 60,
            cancellationMinutes: 120,
            amenities: "",
          }
        : kind === "schedule"
          ? {
              departureTime: item.departureTime,
              startDate: eatDate(item.startDate),
              endDate: item.endDate ? eatDate(item.endDate) : "",
              seats: item.seats,
              isActive: item.isActive,
            }
          : kind === "fare"
            ? {
                name: item.name,
                price: item.price,
                description: item.description,
                isActive: item.isActive,
              }
            : kind === "trip"
              ? {
                  action:
                    item.status === "departed" ? "completed" : "availability",
                  available: "yes",
                  note: "",
                  delayMinutes: item.delayMinutes || 0,
                }
              : { durationMinutes: 180 },
    );
    if (kind === "bus")
      request("/operators?limit=100")
        .then((d) =>
          setCompanies(
            d.items.filter(
              (c) =>
                c.status === "active" && c.onboardingStatus === "registered",
            ),
          ),
        )
        .catch((e) => setError(e.message));
  }
  const field = (key, label, type = "text", props = {}) => (
    <Field
      label={label}
      type={type}
      value={form[key] ?? ""}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      {...props}
    />
  );
  async function save(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { kind, item } = modal;
      let result;
      if (kind === "route") {
        result = await request("/routes", "POST", {
          originName: form.originName,
          destinationName: form.destinationName,
          durationMinutes: +form.durationMinutes,
        });
        setSelected(result.id);
      }
      if (kind === "bus") {
        if (form.pickupLat === "" || form.pickupLng === "")
          throw Error("Pick the boarding stage on the map.");
        const body = {
          operatorId: form.operatorId,
          pickupName: form.pickupName,
          pickupLat: +form.pickupLat,
          pickupLng: +form.pickupLng,
          date: form.date,
          departureTime: form.departureTime,
          repeatDaily: form.repeatDaily,
          price: +form.price,
          fareName: form.fareName,
          durationMinutes: +form.durationMinutes,
          dropoffPoint: form.dropoffPoint || "",
          extras: form.extras || "",
        };
        if (form.vehicleId) body.vehicleId = form.vehicleId;
        else
          body.bus = {
            name: form.name,
            registration: form.registration,
            contactName: form.contactName,
            contactPhone: form.contactPhone,
            seats: +form.seats,
            cancellationMinutes: +form.cancellationMinutes,
            amenities: form.amenities
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          };
        await request(`/routes/${selected}/buses`, "POST", body);
        setDate(form.date);
      }
      if (kind === "schedule")
        await request(
          `/companies/${item.operatorId}/schedules/${item.id}`,
          "PATCH",
          {
            departureTime: form.departureTime,
            startDate: form.startDate,
            endDate: form.endDate || null,
            seats: +form.seats,
            isActive: form.isActive,
          },
        );
      if (kind === "fare")
        await request(
          `/companies/${item.operatorId}/prices/${item.id}`,
          "PATCH",
          {
            name: form.name,
            price: +form.price,
            description: form.description || "",
            isActive: form.isActive,
          },
        );
      if (kind === "trip") {
        const action = form.action;
        const body =
          action === "availability"
            ? { available: form.available === "yes", note: form.note }
            : action === "delay"
              ? { delayMinutes: +form.delayMinutes, note: form.note }
              : action === "cancel"
                ? { reason: form.note }
                : { status: action };
        await request(
          `/companies/${item.operatorId}/trips/${item.id}/${["departed", "completed"].includes(action) ? "status" : action}`,
          "POST",
          body,
        );
      }
      setModal(null);
      setNotice(
        kind === "route"
          ? "Route created. Add its first bus."
          : kind === "bus"
            ? "Bus added. Its departures are ready."
            : "Changes saved.",
      );
      if (kind !== "route") await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bm-desk">
      <header className="bm-head">
        <div>
          <span className="bm-eyebrow">GABLA TRANSPORT</span>
          <h1>Routes & bus bookings</h1>
          <p>
            Create a route, add its buses, then follow up passenger bookings.
          </p>
        </div>
        {page === "routes" ? (
          <button
            className="bm-btn bm-white"
            onClick={() => show(selected ? "bus" : "route")}
          >
            {selected ? "+ Add bus to this route" : "+ Create route"}
          </button>
        ) : null}
      </header>
      <nav className="bm-nav" aria-label="Bus workspace">
        {[
          ["routes", "Routes & departures"],
          ["companies", "Companies & fleet"],
          ["bookings", "Bookings & follow-ups"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => {
              setPage(id);
              setError("");
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {notice ? (
        <div className="bm-notice" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {page !== "routes" ? (
        <ManagedBusDesk
          key={page}
          token={token}
          loadMaps={loadMaps}
          initialTab={page}
          embedded
        />
      ) : (
        <>
          {error && !modal ? (
            <div className="bm-error" role="alert">
              {error}
              <button onClick={refresh}>Retry</button>
            </div>
          ) : null}
          {selected ? (
            <div className="bm-context">
              <button
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
              >
                All routes
              </button>
              <span>→</span>
              <b>
                {detail
                  ? `${detail.originName} → ${detail.destinationName}`
                  : "Loading route…"}
              </b>
            </div>
          ) : (
            <div className="br-guide">
              <span>
                <b>1</b>Create a route
              </span>
              <i>→</i>
              <span>
                <b>2</b>Add buses & pickup points
              </span>
              <i>→</i>
              <span>
                <b>3</b>Manage bookings
              </span>
            </div>
          )}
          {!selected ? (
            <>
              <div className="bm-section-head">
                <div>
                  <h2>Travel routes</h2>
                  <p>One route can include buses from several companies.</p>
                </div>
              </div>
              <Field
                label="Find a route"
                placeholder="Search town or destination"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {loading ? (
                <div className="bm-loading" role="status">
                  Loading routes…
                </div>
              ) : (
                <div className="br-routes">
                  {routes.map((r) => (
                    <button
                      className="br-route-card"
                      key={r.id}
                      onClick={() => {
                        setSelected(r.id);
                        setDetail(null);
                      }}
                    >
                      <span className="bm-eyebrow">BUS ROUTE</span>
                      <h3>
                        {r.originName}
                        <span>→</span>
                        {r.destinationName}
                      </h3>
                      <div className="br-route-counts">
                        <span>{r.buses} bus options</span>
                        <span>{r.companies} companies</span>
                      </div>
                      <footer>
                        <span>
                          {r.priceFrom === null
                            ? "Add the first bus"
                            : `From ${money(r.priceFrom)}`}
                        </span>
                        <b>Open route →</b>
                      </footer>
                    </button>
                  ))}
                </div>
              )}
              {!loading && !routes.length ? (
                <div className="bm-empty">
                  <h3>
                    {q ? "No matching routes" : "Start with your first route"}
                  </h3>
                  <p>
                    Create Kampala → Hoima, then add the buses that travel that
                    route.
                  </p>
                  <button className="bm-btn" onClick={() => show("route")}>
                    Create route
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
          {selected && detail ? (
            <>
              <section className="br-route-hero">
                <div>
                  <span className="bm-eyebrow">SELECTED ROUTE</span>
                  <h2>
                    {detail.originName} <span>→</span> {detail.destinationName}
                  </h2>
                  <p>
                    {detail.departures.length} bus options · Each bus has its
                    own company, boarding stage, fare and departure time.
                  </p>
                </div>
                <button className="bm-btn" onClick={() => show("bus")}>
                  + Add bus
                </button>
              </section>
              <div className="bm-section-head">
                <div>
                  <h2>Buses on this route</h2>
                  <p>Choose a company and bus when adding each option below.</p>
                </div>
              </div>
              {!detail.departures.length ? (
                <div className="bm-empty">
                  <h3>This route is ready for its first bus</h3>
                  <p>Pick a company, bus, pickup stage and departure time.</p>
                  <button className="bm-btn" onClick={() => show("bus")}>
                    Add first bus
                  </button>
                </div>
              ) : (
                <div className="br-offers">
                  {detail.departures.map((d) => (
                    <article className="br-offer" key={d.id}>
                      <header>
                        <div>
                          <span className="bm-eyebrow">
                            {d.operator.companyName}
                          </span>
                          <h3>
                            {d.vehicle?.name || "Bus"}{" "}
                            <small>{d.vehicle?.registration}</small>
                          </h3>
                        </div>
                        {d.operator.isDemo ? (
                          <span className="bm-tag amber">
                            Demo · payments disabled
                          </span>
                        ) : null}
                      </header>
                      <div className="br-offer-info">
                        <section>
                          <span>BOARDING STAGE</span>
                          <b>{d.boardingPoint || "Not set"}</b>
                          {d.boardingLat !== null && d.boardingLng !== null ? (
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={`https://www.google.com/maps/search/?api=1&query=${d.boardingLat},${d.boardingLng}`}
                            >
                              View pickup on map ↗
                            </a>
                          ) : null}
                          <span>BUS CONTACT</span>
                          <a href={`tel:${d.vehicle?.contactPhone || ""}`}>
                            {d.vehicle?.contactName || "Contact not set"} ·{" "}
                            {d.vehicle?.contactPhone}
                          </a>
                        </section>
                        <section>
                          <span>DEPARTURES · EAT</span>
                          {d.schedules.map((s) => (
                            <button
                              className="br-schedule"
                              key={s.id}
                              onClick={() => show("schedule", s)}
                            >
                              <b>{s.departureTime}</b>
                              <small>
                                {s.endDate &&
                                eatDate(s.endDate) === eatDate(s.startDate)
                                  ? eatDate(s.startDate)
                                  : "Recurring"}
                                {!s.isActive ? " · Paused" : ""}
                              </small>
                              <span>Adjust</span>
                            </button>
                          ))}
                          <span>FARES</span>
                          {d.ticketTypes.map((t) => (
                            <button
                              className="br-schedule"
                              key={t.id}
                              onClick={() =>
                                show("fare", { ...t, operatorId: d.operatorId })
                              }
                            >
                              <b>{money(t.price)}</b>
                              <small>
                                {t.name}
                                {!t.isActive ? " · Hidden" : ""}
                              </small>
                              <span>Edit</span>
                            </button>
                          ))}
                        </section>
                      </div>
                      <footer>
                        {d.vehicle?.seats || "—"} seats · Cancellation closes{" "}
                        {d.vehicle?.cancellationMinutes ?? 120} minutes before
                        departure
                      </footer>
                    </article>
                  ))}
                </div>
              )}
              <div className="bm-section-head">
                <div>
                  <h2>Departure board</h2>
                  <p>
                    Check with the bus contact, adjust delays or update
                    departure status.
                  </p>
                </div>
                <Field
                  label="Departure date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              {loading ? <div role="status">Refreshing departures…</div> : null}
              <div className="bm-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time · EAT</th>
                      <th>Company / bus</th>
                      <th>Pickup stage</th>
                      <th>Bookings</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {trips.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <b>
                            {when(
                              new Date(
                                +new Date(t.departureAt) +
                                  (t.delayMinutes || 0) * 60000,
                              ),
                            )}
                          </b>
                        </td>
                        <td>
                          <b>{t.operator.companyName}</b>
                          <small>
                            {t.vehicle?.registration} · {t.vehicle?.name}
                          </small>
                          <a href={`tel:${t.vehicle?.contactPhone || ""}`}>
                            {t.vehicle?.contactPhone}
                          </a>
                        </td>
                        <td>{t.route.boardingPoint}</td>
                        <td>{t._count.tickets} tickets</td>
                        <td>
                          <span className="bm-tag">{t.status}</span>
                          <small>{t.availability}</small>
                        </td>
                        <td>
                          {!["cancelled", "completed"].includes(t.status) ? (
                            <button
                              className="bm-link"
                              onClick={() => show("trip", t)}
                            >
                              Update departure
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!trips.length && !loading ? (
                  <div className="bm-empty">
                    No departures on this date. Choose another date or add a
                    bus.
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      )}
      <ModalShell
        open={!!modal}
        onClose={() => !busy && setModal(null)}
        maxWidth="max-w-3xl"
      >
        {modal ? (
          <form className="bm-form" onSubmit={save}>
            <header>
              <div>
                <span className="bm-eyebrow">
                  {detail
                    ? `${detail.originName} → ${detail.destinationName}`
                    : "ROUTE SETUP"}
                </span>
                <h2>
                  {
                    {
                      route: "Create a route",
                      bus: "Add a bus to this route",
                      schedule: "Adjust departure schedule",
                      fare: "Edit ticket price",
                      trip: "Update departure",
                    }[modal.kind]
                  }
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close form"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                ×
              </button>
            </header>
            {modal.kind === "route" ? (
              <>
                <p>
                  Start with the two towns. You will add companies, buses and
                  pickup points inside this route.
                </p>
                <div className="bm-grid">
                  {field("originName", "From town", "text", {
                    required: true,
                    placeholder: "Kampala",
                    maxLength: 80,
                  })}
                  {field("destinationName", "To town", "text", {
                    required: true,
                    placeholder: "Hoima",
                    maxLength: 80,
                  })}
                </div>
                {field(
                  "durationMinutes",
                  "Typical journey time · minutes",
                  "number",
                  { required: true, min: 10, max: 4000 },
                )}
              </>
            ) : null}
            {modal.kind === "bus" ? (
              <>
                <h3 className="br-form-section">Company & bus</h3>
                <Field label="Bus company">
                  <select
                    required
                    value={form.operatorId}
                    onChange={(e) => {
                      setFleet([]);
                      setForm((f) => ({
                        ...f,
                        operatorId: e.target.value,
                        vehicleId: "",
                        pickupName: "",
                        pickupLat: "",
                        pickupLng: "",
                      }));
                    }}
                  >
                    <option value="">Select a company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </Field>
                {!companies.length ? (
                  <p>
                    Add the company in Companies & fleet first, then return to
                    this route.
                  </p>
                ) : null}
                {form.operatorId ? (
                  <>
                    <Field label="Which bus?">
                      <select
                        value={form.vehicleId}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, vehicleId: e.target.value }))
                        }
                      >
                        <option value="">+ Enter a new bus</option>
                        {fleet.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.registration} · {v.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {!form.vehicleId ? (
                      <>
                        <div className="bm-grid">
                          {field("name", "Bus name / model", "text", {
                            required: true,
                          })}
                          {field(
                            "registration",
                            "Registration or fleet number",
                            "text",
                            { required: true },
                          )}
                          {field("contactName", "Bus contact person", "text", {
                            required: true,
                          })}
                          {field("contactPhone", "Contact phone", "tel", {
                            required: true,
                            minLength: 7,
                          })}
                          {field("seats", "Passenger seats", "number", {
                            required: true,
                            min: 1,
                            max: 120,
                          })}
                          {field(
                            "cancellationMinutes",
                            "Cancellation cutoff · minutes before departure",
                            "number",
                            { required: true, min: 0, max: 10080 },
                          )}
                        </div>
                        {field(
                          "amenities",
                          "Included services · separate with commas",
                          "text",
                          {
                            placeholder:
                              "USB charging, Air conditioning, Luggage",
                          },
                        )}
                      </>
                    ) : null}
                    <h3 className="br-form-section">Boarding stage</h3>
                    {field("pickupName", "Pickup place / stage name", "text", {
                      required: true,
                      placeholder: "Kisenyi Bus Terminal",
                    })}
                    <StageMap
                      key={form.operatorId}
                      loadMaps={loadMaps}
                      value={{
                        parkLat: form.pickupLat,
                        parkLng: form.pickupLng,
                      }}
                      onChange={(p) =>
                        setForm((f) => ({
                          ...f,
                          pickupLat: p.lat,
                          pickupLng: p.lng,
                        }))
                      }
                    />
                    <div className="bm-grid">
                      {field("pickupLat", "Pickup latitude", "number", {
                        required: true,
                        step: "any",
                        min: -90,
                        max: 90,
                      })}
                      {field("pickupLng", "Pickup longitude", "number", {
                        required: true,
                        step: "any",
                        min: -180,
                        max: 180,
                      })}
                    </div>
                    {field("dropoffPoint", "Drop-off place (optional)")}
                    <h3 className="br-form-section">Departure & fare</h3>
                    <div className="bm-grid">
                      {field("date", "Departure / start date", "date", {
                        required: true,
                        min: eatDate(),
                      })}
                      {field("departureTime", "Departure time · EAT", "time", {
                        required: true,
                      })}
                      {field("price", "Fare per passenger · UGX", "number", {
                        required: true,
                        min: 0,
                        max: 100000000,
                      })}
                      {field(
                        "durationMinutes",
                        "Journey duration · minutes",
                        "number",
                        { required: true, min: 10, max: 4000 },
                      )}
                    </div>
                    <label className="br-checkbox">
                      <input
                        type="checkbox"
                        checked={form.repeatDaily}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            repeatDaily: e.target.checked,
                          }))
                        }
                      />{" "}
                      Repeat this departure every day from the selected date
                    </label>
                    {field(
                      "extras",
                      "What is included in this fare? (optional)",
                      "text",
                      { maxLength: 200 },
                    )}
                  </>
                ) : null}
              </>
            ) : null}
            {modal.kind === "schedule" ? (
              <>
                <p>
                  Changes apply to unbooked departures. Trips with existing
                  bookings retain their confirmed time; adjust those on the
                  departure board.
                </p>
                <div className="bm-grid">
                  {field("departureTime", "Departure time · EAT", "time", {
                    required: true,
                  })}
                  {field("startDate", "Start date", "date", { required: true })}
                  {field("endDate", "End date (optional)", "date")}
                  {field("seats", "Seats on this departure", "number", {
                    required: true,
                    min: 1,
                    max: 120,
                  })}
                </div>
                <label className="br-checkbox">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                  />{" "}
                  Departure schedule active
                </label>
              </>
            ) : null}
            {modal.kind === "fare" ? (
              <>
                {field("name", "Ticket type", "text", { required: true })}
                {field("price", "Price per passenger · UGX", "number", {
                  required: true,
                  min: 0,
                })}
                {field("description", "Included services", "text", {
                  maxLength: 200,
                })}
                <label className="br-checkbox">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                  />{" "}
                  Fare available
                </label>
              </>
            ) : null}
            {modal.kind === "trip" ? (
              <>
                <p>
                  {modal.item.operator.companyName} ·{" "}
                  {modal.item.vehicle?.registration} ·{" "}
                  {when(modal.item.departureAt)}
                </p>
                <Field label="What would you like to update?">
                  <select
                    value={form.action}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, action: e.target.value }))
                    }
                  >
                    {modal.item.status === "scheduled" ? (
                      <>
                        <option value="availability">
                          Record an availability call
                        </option>
                        <option value="departed">Mark bus as departed</option>
                        <option value="cancel">Cancel this departure</option>
                      </>
                    ) : (
                      <option value="completed">Mark journey completed</option>
                    )}
                    <option value="delay">Adjust delayed departure</option>
                  </select>
                </Field>
                {form.action === "availability" ? (
                  <Field label="Did the contact confirm the bus is available?">
                    <select
                      value={form.available}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, available: e.target.value }))
                      }
                    >
                      <option value="yes">Yes · Available</option>
                      <option value="no">No · Unavailable</option>
                    </select>
                  </Field>
                ) : null}
                {form.action === "delay"
                  ? field(
                      "delayMinutes",
                      "Delay from original departure · minutes",
                      "number",
                      { required: true, min: 0, max: 720 },
                    )
                  : null}
                {field("note", "Call result / reason for this update", "text", {
                  required: true,
                  minLength: 3,
                  maxLength: 300,
                })}
              </>
            ) : null}
            {error ? (
              <div className="bm-error" role="alert">
                {error}
              </div>
            ) : null}
            <footer>
              <button
                type="button"
                className="bm-secondary"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="bm-btn"
                disabled={busy || (modal.kind === "bus" && !form.operatorId)}
              >
                {busy
                  ? "Saving…"
                  : modal.kind === "route"
                    ? "Create route"
                    : modal.kind === "bus"
                      ? "Add bus & departure"
                      : "Save changes"}
              </button>
            </footer>
          </form>
        ) : null}
      </ModalShell>
    </div>
  );
}
