import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { TOKEN_KEY } from '../../lib/api.js';
import { getInviteInfo, acceptInvite } from './api.js';

const Shell = ({ children }) => (
  <div
    className="min-h-screen flex items-center justify-center px-4 py-10"
    style={{
      background: 'radial-gradient(circle at top, rgba(36, 78, 168, 0.22), transparent 28%), linear-gradient(180deg, #020915 0%, #07111F 46%, #09111D 100%)',
      fontFamily: 'var(--font-ui)'
    }}
  >
    <div className="w-full max-w-md">
      <div className="text-center mb-6">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem]"
          style={{ backgroundColor: '#FACC15', color: '#0B2046', boxShadow: '0 0 24px rgba(250,204,21,0.34)' }}
        >
          <i className="ph-fill ph-intersect text-3xl" />
        </div>
        <h1 className="font-brand mt-3 text-2xl font-semibold" style={{ color: '#FFC107' }}>GABLA ADMIN</h1>
      </div>
      <div
        className="rounded-[28px] border px-6 py-7"
        style={{
          borderColor: 'rgba(103,180,255,0.22)',
          background: 'linear-gradient(180deg, rgba(22,34,58,0.68), rgba(9,16,30,0.84))',
          backdropFilter: 'blur(18px)',
          boxShadow: '0 22px 60px -32px rgba(53,161,255,0.28), inset 0 1px 0 rgba(150,220,255,0.12)'
        }}
      >
        {children}
      </div>
    </div>
  </div>
);

const inputStyle = {
  borderColor: 'rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.06)'
};

export const AcceptInvitePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState('loading'); // loading | ready | error | success
  const [info, setInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('This invite link is missing its token.');
      return;
    }
    getInviteInfo(token)
      .then((data) => {
        setInfo(data);
        setStatus('ready');
      })
      .catch((e) => {
        setErrorMessage(e.message || 'This invite link is invalid or has expired.');
        setStatus('error');
      });
  }, [token]);

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await acceptInvite(token, password);
      localStorage.setItem(TOKEN_KEY, result.accessToken);
      setStatus('success');
      setTimeout(() => {
        window.location.href = '/';
      }, 900);
    } catch (e) {
      setFormError(e.message || 'Could not activate this account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Shell>
        <p className="text-center text-sm" style={{ color: 'rgba(230,230,230,0.82)' }}>Checking your invite...</p>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <div className="text-center">
          <i className="ph ph-warning-circle text-4xl" style={{ color: '#FCA5A5' }} />
          <h2 className="mt-3 text-lg font-semibold" style={{ color: '#F4F7FB' }}>Invite link unavailable</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(230,230,230,0.82)' }}>{errorMessage}</p>
        </div>
      </Shell>
    );
  }

  if (status === 'success') {
    return (
      <Shell>
        <div className="text-center">
          <i className="ph ph-check-circle text-4xl" style={{ color: '#6EE7B7' }} />
          <h2 className="mt-3 text-lg font-semibold" style={{ color: '#F4F7FB' }}>You're all set</h2>
          <p className="mt-2 text-sm" style={{ color: 'rgba(230,230,230,0.82)' }}>Taking you to the dashboard...</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: '#F4F7FB' }}>Welcome, {info.name}</h2>
        <p className="mt-1 text-sm" style={{ color: 'rgba(230,230,230,0.82)' }}>
          You've been invited as <span className="font-semibold" style={{ color: '#FFC107' }}>{info.roleName}</span>. Set a password to activate your account.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-3.5">
        {formError ? (
          <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: 'rgba(251,113,133,0.35)', background: 'rgba(127,29,29,0.22)', color: '#FFD4DB' }}>
            {formError}
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={inputStyle}>
          <i className="ph ph-envelope-simple text-lg" style={{ color: 'rgba(230,230,230,0.72)' }} />
          <span className="flex-1 text-sm" style={{ color: 'rgba(244,247,251,0.9)' }}>{info.email}</span>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={inputStyle}>
          <i className="ph ph-lock text-lg" style={{ color: 'rgba(230,230,230,0.72)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: '#F8FBFF' }}
          />
          <button type="button" onClick={() => setShowPassword((p) => !p)} style={{ color: 'rgba(230,230,230,0.72)' }}>
            <i className={`ph ph-${showPassword ? 'eye-slash' : 'eye'} text-lg`} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={inputStyle}>
          <i className="ph ph-lock-simple text-lg" style={{ color: 'rgba(230,230,230,0.72)' }} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: '#F8FBFF' }}
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !password || !confirmPassword}
          className="mt-2 w-full rounded-2xl py-3 text-base font-semibold transition disabled:opacity-60"
          style={{ background: 'linear-gradient(180deg, #D8A63A 0%, #C88B17 100%)', color: '#14110D', boxShadow: '0 12px 24px -12px rgba(255,193,7,0.8)' }}
        >
          {submitting ? 'Activating...' : 'Activate account'}
        </button>
      </form>
    </Shell>
  );
};
