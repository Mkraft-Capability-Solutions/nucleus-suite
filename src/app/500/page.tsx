"use client";
import Link from 'next/link';
import DnsIcon from '@mui/icons-material/Dns';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function InternalErrorPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-card, 16px)',
          padding: '3rem 2.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-overlay, 0 16px 40px rgba(0,0,0,0.2))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--alert-wash, rgba(245, 158, 11, 0.12))',
            border: '1px solid var(--alert, #f59e0b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--alert, #f59e0b)',
          }}
        >
          <DnsIcon sx={{ fontSize: 38 }} />
        </div>

        <div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--alert, #f59e0b)',
            }}
          >
            500 Internal Error
          </span>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text)',
              margin: '0.5rem 0 0.75rem',
            }}
          >
            Server Interrupted
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-2, #94a3b8)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            The system encountered an unexpected condition that prevented it from fulfilling your request. Our technical operations team has been automatically flagged. Please try reloading or checking back shortly.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--r-control, 8px)',
              background: 'var(--surface-2, #334155)',
              color: 'var(--text)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <RefreshIcon sx={{ fontSize: 16 }} /> Reload Page
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--r-control, 8px)',
              background: 'var(--signal, #6366f1)',
              color: 'var(--on-signal, #ffffff)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
