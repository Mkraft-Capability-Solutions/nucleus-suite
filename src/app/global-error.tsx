"use client";

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Root layout global error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#0b0f19',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: '540px',
            width: '90%',
            background: '#151d2e',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
              fontSize: '28px',
              fontWeight: 'bold',
            }}
          >
            !
          </div>

          <div>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#ef4444',
              }}
            >
              System Error
            </span>
            <h1
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                margin: '0.5rem 0 0.75rem',
                color: '#ffffff',
              }}
            >
              Application Failure
            </h1>
            <p
              style={{
                fontSize: '0.925rem',
                color: '#94a3b8',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              A fatal error occurred in the core framework layout. Nucleus diagnostic telemetry has captured this state. Please restart or reload the session.
            </p>
            {error?.digest && (
              <p
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontFamily: 'monospace',
                  marginTop: '0.5rem',
                }}
              >
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Reload Session
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                background: '#334155',
                color: '#f8fafc',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
