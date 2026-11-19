import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { request } from '../../lib/api';
import { getSession } from '../../lib/session';
import { loginPath } from '../../lib/authRedirect';
import './event-tickets.css';

const money = (value) => `UGX ${Number(value).toLocaleString('en-UG')}`;
const date = (value) => new Intl.DateTimeFormat('en-UG', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Kampala'
}).format(new Date(value));
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });

export function EventTicketCheckout({ event }) {
  const [quantity, setQuantity] = useState(1);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const session = getSession();
  const price = event.onlineTickets.price;
  return <section className="event-ticket-panel">
    <div className="event-ticket-kicker">ONLINE TICKETS · MOBILE MONEY</div>
    <h2>General admission</h2>
    <p>{money(price)} per person</p>
    {!open ? <button className="event-ticket-action" onClick={() => session ? setOpen(true) : navigate(loginPath(location))}>Get tickets</button> :
      <form className="event-ticket-form" onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const values = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        try {
          const order = await post(`/events/${event.id}/tickets/orders`, { quantity, expectedPrice: price, email: values.get('email'), payPhone: values.get('payPhone') });
          navigate(`/events/tickets/${order.id}`);
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}>
        <label>Tickets<select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => <option key={i}>{i + 1}</option>)}</select></label>
        <label>Email for your tickets<input name="email" type="email" defaultValue={session?.user?.email || ''} required/></label>
        <label>Mobile Money number<input name="payPhone" type="tel" placeholder="07…" defaultValue={session?.user?.phone || ''} required/></label>
        <button className="event-ticket-action" disabled={busy}>{busy ? 'Sending payment request…' : `Pay ${money(quantity * price)}`}</button>
      </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}

function TicketShell({ label, title, children }) {
  const location = useLocation();
  return <main className="event-ticket-shell">
    <nav><Link to="/events">← Events</Link><Link to="/events/tickets">My tickets</Link></nav>
    <header><p className="event-ticket-kicker">{label}</p><h1>{title}</h1></header>
    {getSession() ? children : <section className="event-ticket-panel"><p>Sign in to continue.</p><Link className="event-ticket-action" to={loginPath(location)}>Sign in</Link></section>}
  </main>;
}

export function EventTicketList() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!getSession()) return;
    let active = true;
    request(`/events/tickets/mine?page=${page}`).then((result) => {
      if (active) { setData(result); setError(''); }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [page]);
  return <TicketShell label="GABLA EVENTS" title="My tickets">
    {error ? <p role="alert">{error}</p> : !data ? <p>Loading tickets…</p> :
      data.items.length ? data.items.map((order) => <Link className="event-ticket-panel event-ticket-list-row" key={order.id} to={`/events/tickets/${order.id}`}>
        <div><strong>{order.event.title}</strong><div>{date(order.event.startsAt)} EAT</div></div>
        <span>{order.quantity} {order.quantity === 1 ? 'pass' : 'passes'} ↗</span>
      </Link>) : <p>No ticket orders on this page.</p>}
    {data && <div className="event-ticket-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={data.items.length < 30} onClick={() => setPage(page + 1)}>Next</button></div>}
  </TicketShell>;
}

export function EventTicketOrder() {
  const { id } = useParams();
  const [loadedOrder, setOrder] = useState(null);
  const order = loadedOrder?.id === id ? loadedOrder : null;
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!getSession()) return;
    let active = true;
    let timer;
    async function load() {
      try {
        const result = await request(`/events/tickets/orders/${id}`);
        if (!active) return;
        setOrder(result);
        setError('');
        if (result.status === 'pending_payment') timer = setTimeout(load, 3500);
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    return () => { active = false; clearTimeout(timer); };
  }, [id, refresh]);
  const status = {
    pending_payment: 'Approve the Mobile Money prompt on your phone. Your passes will appear here after payment clears.',
    refunded: 'This payment was refunded.',
    failed: 'The payment did not complete.',
    expired: 'The reservation expired. If you already paid, check this order again before starting another payment.',
    refund_due: 'Payment was received, but passes could not be issued. Contact Gabla support with this order reference.'
  };
  return <TicketShell label={order?.status === 'paid' ? 'PAYMENT CONFIRMED' : 'TICKET ORDER'} title={order?.event.title || 'Your order'}>
    {error && <p role="alert">{error}</p>}
    {!order && !error && <p>Loading order…</p>}
    {order && <p>{date(order.event.startsAt)} EAT · {order.event.address} · {money(order.total)}</p>}
    {order?.status === 'paid' ? <div className="event-pass-grid">{order.tickets.map((pass, index) =>
      <article className="event-pass" key={pass.number}>
        <div className="event-pass-header"><span>GABLA EVENTS</span><strong>{order.event.title}</strong><span>GENERAL ADMISSION · {index + 1} / {order.tickets.length}</span></div>
        <div className="event-pass-code">
          {pass.usedAt ? <strong>Checked in · {date(pass.usedAt)} EAT</strong> : <img src={pass.qr} width="196" height="196" alt="Admission QR code"/>}
          <code>{pass.number}</code>
        </div>
      </article>)}</div> : order && <div className="event-ticket-panel"><p role="status">{status[order.status]}</p><p>Order {order.id}</p></div>}
    {(error || order?.status !== 'paid' && order) && <button onClick={() => setRefresh((v) => v + 1)}>Check payment status</button>}
  </TicketShell>;
}

export function EventDoor() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const video = useRef(null);
  useEffect(() => {
    if (!getSession()) return;
    let active = true;
    request(`/events/${id}`).then((data) => { if (active) setEvent(data); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);

  async function redeem(number) {
    if (submitting.current) return;
    submitting.current = true;
    setCamera(false);
    setBusy(true);
    setResult(null);
    setError('');
    try {
      setResult(await post(`/events/${id}/tickets/redeem`, { number }));
    } catch (e) {
      setError(e.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!camera) return;
    let active = true;
    let stream;
    let frame;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    async function start() {
      try {
        const { default: decode } = await import('jsqr');
        const opened = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
        if (!active) { opened.getTracks().forEach((track) => track.stop()); return; }
        stream = opened;
        const node = video.current;
        node.srcObject = stream;
        await node.play();
        function scan() {
          if (!active) return;
          if (node.readyState >= 2) {
            canvas.width = Math.min(node.videoWidth, 640);
            canvas.height = Math.round(canvas.width * node.videoHeight / node.videoWidth);
            ctx.drawImage(node, 0, 0, canvas.width, canvas.height);
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = decode(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) { redeem(code.data); return; }
          }
          frame = setTimeout(scan, 120);
        }
        scan();
      } catch {
        if (active) {
          setCameraError('Camera unavailable. Enter the ticket number below.');
          setCamera(false);
        }
      }
    }
    start();
    return () => { active = false; clearTimeout(frame); stream?.getTracks().forEach((track) => track.stop()); };
  }, [camera, id]);

  const verdict = { valid: ['Valid', 'Checked in. Admit this guest.'], used: ['Already used', 'This pass has already been checked in.'], not_found: ['Not found', 'Check the number and make sure it belongs to this event.'] };
  return <TicketShell label="ORGANIZER · DOOR CHECK-IN" title={event?.title || 'Check tickets'}>
    {error && <p role="alert">{error}</p>}
    {event && (!event.canManage ? <p>Only the event organizer can check in guests.</p> : <section className="event-ticket-panel">
      <h2>Admit a guest</h2><p>Scan one QR code per guest or enter the number printed below it. A valid pass is marked used immediately.</p>
      {camera ? <div className="event-camera"><video ref={video} muted playsInline/><button onClick={() => setCamera(false)}>Close camera</button></div> :
        <button className="event-ticket-action" disabled={busy} onClick={() => { setCameraError(''); setResult(null); setCamera(true); }}>Scan QR code</button>}
      {cameraError && <p role="alert">{cameraError}</p>}
      <form className="event-ticket-form" onSubmit={(e) => { e.preventDefault(); redeem(new FormData(e.currentTarget).get('number')); }}>
        <label>Ticket number<input name="number" required maxLength={128} autoCapitalize="characters" autoComplete="off" placeholder="GE-…"/></label>
        <button disabled={busy}>{busy ? 'Checking…' : 'Verify and check in'}</button>
      </form>
      {result && <div className={`event-verdict event-verdict-${result.status}`} role="status"><strong>{verdict[result.status][0]}</strong><p>{verdict[result.status][1]}</p>{result.usedAt && <small>{date(result.usedAt)} EAT</small>}</div>}
    </section>)}
  </TicketShell>;
}
