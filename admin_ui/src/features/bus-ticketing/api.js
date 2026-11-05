import { apiRequest } from '../../lib/api.js';

// Every call below hits the admin half of the bus module (src/routes/bus.routes.js), which is
// gated by the "busticketing" admin permission.
const BASE = '/bus/admin';

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

const send = (token, method, path, body) =>
  apiRequest(`${BASE}${path}`, { token, method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

export const getOverview = (token) => send(token, 'GET', '/overview');

export const getSettings = (token) => send(token, 'GET', '/settings');
export const saveSettings = (token, body) => send(token, 'PUT', '/settings', body);

export const listOperators = (token, params) => send(token, 'GET', `/operators${qs(params)}`);
export const getOperator = (token, id) => send(token, 'GET', `/operators/${id}`);
export const inviteOperator = (token, body) => send(token, 'POST', '/operators', body);
export const updateOperator = (token, id, body) => send(token, 'PATCH', `/operators/${id}`, body);
export const resendInvitation = (token, id) => send(token, 'POST', `/operators/${id}/resend`);

export const listTypes = (token) => send(token, 'GET', '/types');
export const createType = (token, body) => send(token, 'POST', '/types', body);
export const updateType = (token, id, body) => send(token, 'PATCH', `/types/${id}`, body);
export const deleteType = (token, id) => send(token, 'DELETE', `/types/${id}`);

export const listBookings = (token, params) => send(token, 'GET', `/bookings${qs(params)}`);
export const markRefunded = (token, id) => send(token, 'POST', `/bookings/${id}/refunded`);

export const listPayouts = (token, params) => send(token, 'GET', `/payouts${qs(params)}`);
export const processPayout = (token, id, body) => send(token, 'POST', `/payouts/${id}`, body);
