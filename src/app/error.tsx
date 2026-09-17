"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import HomeIcon from '@mui/icons-material/HomeOutlined';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected client-side exceptions
    console.error('Unhandled route error:', error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #0f172a)',
        color: 'var(--text, #f8fafc)',
        padding: '2rem',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      <div
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'var(--card, #1e293b)',
          border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
          borderRadius: 'var(--r-card, 16px)',
          padding: '3rem 2.5rem',
          textAlign: 'center',
          boxShadow: 'var(--shadow-overlay, 0 16px 40px rgba(0,0,0,0.35))',
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
          <ErrorOutlineIcon sx={{ fontSize: 38 }} />
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
            Application Error
          </span>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text, #f8fafc)',
              margin: '0.5rem 0 0.75rem',
            }}
          >
            Something Went Wrong
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-2, #94a3b8)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            An unexpected error occurred while rendering this interface. Our systems have logged the event. You can attempt to retry the current action or return to the workspace home.
          </p>
          {error?.digest && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.25)',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--text-3, #64748b)',
              }}
            >
              Error Digest: {error.digest}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--r-control, 8px)',
              background: 'var(--signal, #6366f1)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            <RefreshIcon sx={{ fontSize: 16 }} /> Try Again
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: 'var(--r-control, 8px)',
              background: 'var(--surface-2, #334155)',
              color: 'var(--text, #f8fafc)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <HomeIcon sx={{ fontSize: 16 }} /> Return to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
