import { apiRequest } from '../../lib/api.js';

// Roles
export const listRoles = (token) => apiRequest('/admin/roles', { token });
export const createRole = (token, body) => apiRequest('/admin/roles', { token, method: 'POST', body: JSON.stringify(body) });
export const updateRole = (token, roleId, body) => apiRequest(`/admin/roles/${roleId}`, { token, method: 'PATCH', body: JSON.stringify(body) });
export const deleteRole = (token, roleId) => apiRequest(`/admin/roles/${roleId}`, { token, method: 'DELETE' });

// Admins
export const updateAdmin = (token, adminId, body) => apiRequest(`/admin/admins/${adminId}`, { token, method: 'PATCH', body: JSON.stringify(body) });

// Invites
export const listInvites = (token) => apiRequest('/admin-invites', { token });
export const createInvite = (token, body) => apiRequest('/admin-invites', { token, method: 'POST', body: JSON.stringify(body) });
export const resendInvite = (token, inviteId) => apiRequest(`/admin-invites/${inviteId}/resend`, { token, method: 'POST' });
export const revokeInvite = (token, inviteId) => apiRequest(`/admin-invites/${inviteId}/revoke`, { token, method: 'POST' });
export const getInviteInfo = (token) => apiRequest(`/admin-invites/${token}`);
export const acceptInvite = (token, password) => apiRequest(`/admin-invites/${token}/accept`, { method: 'POST', body: JSON.stringify({ password }) });
