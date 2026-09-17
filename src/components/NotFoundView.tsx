"use client";

import Link from 'next/link';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';

export default function NotFoundView() {
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
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid var(--signal, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--signal, #6366f1)',
          }}
        >
          <SearchOffIcon sx={{ fontSize: 38 }} />
        </div>

        <div>
          <span
            style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--signal, #6366f1)',
            }}
          >
            404 Not Found
          </span>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 800,
              color: 'var(--text, #f8fafc)',
              margin: '0.5rem 0 0.75rem',
            }}
          >
            Resource Not Found
          </h1>
          <p
            style={{
              fontSize: '0.9375rem',
              color: 'var(--text-2, #94a3b8)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            The page, record, or operational view you are looking for might have been relocated, archived, or is temporarily inaccessible.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
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
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            <DashboardIcon sx={{ fontSize: 16 }} /> Open Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
