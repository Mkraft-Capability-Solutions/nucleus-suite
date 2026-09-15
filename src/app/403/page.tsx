import Link from 'next/link';
import ShieldAlert from '@mui/icons-material/Shield';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export default function ForbiddenPage() {
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
            background: 'var(--flag-wash, rgba(239, 68, 68, 0.12))',
            border: '1px solid var(--flag, #ef4444)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--flag, #ef4444)',
          }}
        >
          <ShieldAlert sx={{ fontSize: 38 }} />
        </div>

        <div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--flag, #ef4444)',
            }}
          >
            403 Forbidden
          </span>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text)',
              margin: '0.5rem 0 0.75rem',
            }}
          >
            Access Denied
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-2, #94a3b8)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            You do not have the required permissions or role clearance to access this resource. If you believe this is in error, please contact your Organization Super Administrator or Human Resources Lead.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--r-control, 8px)',
              background: 'var(--surface-2, #334155)',
              color: 'var(--text)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Return to Home
          </Link>
          <Link
            href="/workspace"
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
            Open Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
