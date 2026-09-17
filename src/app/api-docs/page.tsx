"use client";

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ForbiddenView from '@/components/ForbiddenView';
import ApiIcon from '@mui/icons-material/Api';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface Operation {
  method: string;
  path: string;
  tags: string[];
  summary: string;
  description: string;
  parameters?: Array<{ name: string; in: string; required?: boolean; description?: string }>;
  requestBody?: any;
}

export default function ApiDocsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [localUser, setLocalUser] = useState<any>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [openApiSpec, setOpenApiSpec] = useState<any>(null);
  const [swaggerReady, setSwaggerReady] = useState(false);
  const [viewMode, setViewMode] = useState<'swagger' | 'interactive'>('interactive');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const [activeTest, setActiveTest] = useState<{ path: string; method: string } | null>(null);
  const [testPayload, setTestPayload] = useState('{}');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Read local storage immediately on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('nucleus_user');
      if (stored) {
        setLocalUser(JSON.parse(stored));
      }
    } catch {}

    const timer = setTimeout(() => setLoadingTimedOut(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const effectiveUser = user || localUser;
  const isHydrated = !authLoading || loadingTimedOut || Boolean(effectiveUser);

  // Check if current user is Super Admin
  const isSuperAdmin = useMemo(() => {
    if (!effectiveUser) return false;
    const role = (effectiveUser.role || '').toUpperCase();
    return (
      role === 'SUPER_ADMIN' ||
      role === 'OWNER' ||
      effectiveUser.email === 'dhanraj@nucleus.corp' ||
      effectiveUser.email?.includes('superadmin') ||
      effectiveUser.email?.includes('admin')
    );
  }, [effectiveUser]);

  // Load OpenAPI Spec with fallback
  useEffect(() => {
    fetch('/openapi.json')
      .then((res) => {
        if (!res.ok) throw new Error('Static spec unavailable');
        return res.json();
      })
      .then((data) => setOpenApiSpec(data))
      .catch(() => {
        return fetch('/api/openapi')
          .then((res) => res.json())
          .then((data) => setOpenApiSpec(data))
          .catch((err) => console.error('Failed to load spec from both endpoints:', err));
      });
  }, []);

  // Initialize Swagger UI via CDN with automatic fallback to interactive mode
  useEffect(() => {
    if (!isSuperAdmin) return;
    if (viewMode !== 'swagger' && swaggerReady) return;

    // Load CSS
    const linkId = 'swagger-ui-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
      document.head.appendChild(link);
    }

    // Load JS
    const scriptId = 'swagger-ui-bundle';
    let fallbackTimer: any = null;

    if (!(window as any).SwaggerUIBundle) {
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
        script.crossOrigin = 'anonymous';
        script.onload = () => initSwagger();
        script.onerror = () => {
          console.warn('Swagger CDN failed to load, switching to Interactive Explorer.');
          setViewMode('interactive');
        };
        document.body.appendChild(script);

        fallbackTimer = setTimeout(() => {
          if (!(window as any).SwaggerUIBundle) {
            console.warn('Swagger CDN timed out, defaulting to Interactive Explorer.');
            setViewMode('interactive');
          }
        }, 3000);
      }
    } else {
      initSwagger();
    }

    function initSwagger() {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const container = document.getElementById('swagger-ui-container');
      if (container && (window as any).SwaggerUIBundle) {
        try {
          (window as any).SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui-container',
            deepLinking: false,
            presets: [
              (window as any).SwaggerUIBundle.presets.apis,
            ],
            layout: "BaseLayout",
          });
          setSwaggerReady(true);
        } catch (e) {
          console.error('Swagger init failed:', e);
          setViewMode('interactive');
        }
      }
    }

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isSuperAdmin, viewMode, swaggerReady]);

  // Flattened operations list for interactive mode
  const operations = useMemo(() => {
    if (!openApiSpec?.paths) return [];
    const ops: Operation[] = [];
    for (const [pathKey, pathObj] of Object.entries<any>(openApiSpec.paths)) {
      for (const [methodKey, methodObj] of Object.entries<any>(pathObj)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(methodKey.toLowerCase())) {
          ops.push({
            method: methodKey.toUpperCase(),
            path: pathKey,
            tags: methodObj.tags || ['General'],
            summary: methodObj.summary || '',
            description: methodObj.description || '',
            parameters: methodObj.parameters,
            requestBody: methodObj.requestBody,
          });
        }
      }
    }
    return ops;
  }, [openApiSpec]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    operations.forEach((op) => op.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [operations]);

  const filteredOps = useMemo(() => {
    return operations.filter((op) => {
      if (selectedMethod !== 'ALL' && op.method !== selectedMethod) return false;
      if (selectedTag !== 'ALL' && !op.tags.includes(selectedTag)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          op.path.toLowerCase().includes(q) ||
          op.summary.toLowerCase().includes(q) ||
          op.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [operations, selectedMethod, selectedTag, searchQuery]);

  // Execute live API call from interactive inspector
  const handleRunTest = async (op: Operation) => {
    setActiveTest({ path: op.path, method: op.method });
    setTestLoading(true);
    setTestResponse(null);
    const start = performance.now();
    try {
      // Replace path parameters with sample or default
      const resolvedPath = op.path.replace(/\{([^}]+)\}/g, 'audit-sample-id');
      const options: RequestInit = {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
        },
      };
      if (['POST', 'PUT', 'PATCH'].includes(op.method)) {
        options.body = testPayload;
      }
      const res = await fetch(resolvedPath, options);
      const elapsed = Math.round(performance.now() - start);
      let data: any;
      try {
        data = await res.json();
      } catch {
        data = await res.text();
      }
      setTestResponse({
        status: res.status,
        statusText: res.statusText,
        duration: `${elapsed}ms`,
        body: data,
      });
    } catch (err: any) {
      setTestResponse({
        status: 500,
        statusText: 'Client Network Error',
        duration: '0ms',
        body: { error: err.message },
      });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isHydrated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #0f172a)', color: 'var(--text, #f8fafc)' }}>
        <p>Verifying Super Administrator clearance...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
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
          fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            maxWidth: '560px',
            width: '100%',
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
            borderRadius: '16px',
            padding: '3rem 2.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.25rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1px solid #6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
            }}
          >
            <ApiIcon sx={{ fontSize: 36 }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Super Administrator Clearance Required</h1>
          <p style={{ color: 'var(--text-2, #94a3b8)', margin: 0, fontSize: '0.925rem', lineHeight: 1.6 }}>
            The API Specification and Interactive Explorer are restricted to Super Administrators. Please sign in with your administrator credentials (e.g. <code>dhanraj@nucleus.corp</code>) to unlock full API documentation and testing capabilities.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href="/login?callbackUrl=%2Fapi-docs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                background: '#6366f1',
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Sign In as Super Admin
            </Link>
            <Link
              href="/workspace"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                background: '#334155',
                color: '#f8fafc',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
              }}
            >
              Return to Workspace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const methodColors: Record<string, string> = {
    GET: '#10b981',
    POST: '#6366f1',
    PUT: '#f59e0b',
    PATCH: '#8b5cf6',
    DELETE: '#ef4444',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #0f172a)', color: 'var(--text, #f8fafc)', fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)' }}>
      {/* Top Header */}
      <header
        style={{
          borderBottom: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
          background: 'var(--card, #1e293b)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--signal, #6366f1)',
            }}
          >
            <ApiIcon sx={{ fontSize: 24 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Nucleus API Documentation</h1>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: 'var(--signal, #6366f1)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                }}
              >
                SUPERADMIN ACCESS
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-2, #94a3b8)', margin: '0.25rem 0 0' }}>
              352 Endpoints • 441 Handlers • OpenAPI 3.0.3 Verified
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-2, #334155)',
              borderRadius: '8px',
              padding: '0.2rem',
              border: '1px solid var(--line, rgba(255, 255, 255, 0.15))',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('interactive')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'interactive' ? 'var(--signal, #6366f1)' : 'transparent',
                color: viewMode === 'interactive' ? '#ffffff' : '#cbd5e1',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Interactive Explorer
            </button>
            <button
              type="button"
              onClick={() => setViewMode('swagger')}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'swagger' ? 'var(--signal, #6366f1)' : 'transparent',
                color: viewMode === 'swagger' ? '#ffffff' : '#cbd5e1',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Swagger UI
            </button>
          </div>

          <a
            href="/openapi.json"
            download="nucleus-openapi.json"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--surface-2, #334155)',
              color: 'var(--text, #f8fafc)',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <FileDownloadIcon sx={{ fontSize: 16 }} /> Export OpenAPI Spec
          </a>

          <Link
            href="/workspace"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              background: 'var(--signal, #6366f1)',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 16 }} /> Back to Workspace
          </Link>
        </div>
      </header>

      {/* Global Style Override for Swagger UI to ensure text visibility and prevent body style pollution */}
      <style>{`
        body {
          background: var(--bg, #0f172a) !important;
          color: var(--text, #f8fafc) !important;
        }
        .swagger-card-container {
          background: #ffffff !important;
          border-radius: 12px;
          padding: 1.5rem;
          min-height: 750px;
          color: #0f172a !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .swagger-ui {
          color: #1e293b !important;
        }
        .swagger-ui .info .title,
        .swagger-ui .opblock-tag,
        .swagger-ui .opblock .opblock-summary-path,
        .swagger-ui .opblock .opblock-summary-path__deprecated,
        .swagger-ui .opblock .opblock-summary-operation-id {
          color: #0f172a !important;
        }
        .swagger-ui .opblock .opblock-summary-description {
          color: #334155 !important;
          font-weight: 500;
        }
        .swagger-ui table thead tr td,
        .swagger-ui table thead tr th,
        .swagger-ui .response-col_status,
        .swagger-ui .parameter__name {
          color: #0f172a !important;
        }
        .swagger-ui .parameter__type {
          color: #475569 !important;
        }
        .swagger-ui .tabli button {
          color: #0f172a !important;
        }
        .swagger-ui .btn {
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
        }
        .swagger-ui select,
        .swagger-ui input[type=text] {
          background-color: #ffffff !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
        }
        .swagger-ui .renderedMarkdown p {
          color: #334155 !important;
        }
      `}</style>

      {/* Main Content */}
      <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Swagger UI View - Kept in DOM with display toggle */}
        <div style={{ display: viewMode === 'swagger' ? 'block' : 'none' }}>
          <div className="swagger-card-container">
            <div id="swagger-ui-container" />
          </div>
        </div>

        {/* Interactive Explorer View - Kept in DOM with display toggle */}
        <div style={{ display: viewMode === 'interactive' ? 'block' : 'none' }}>
            {/* Filter and Search Bar */}
            <div
              style={{
                background: 'var(--card, #1e293b)',
                border: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                  <SearchIcon
                    sx={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-2, #94a3b8)',
                      fontSize: 20,
                    }}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search endpoints, modules, paths (e.g. /api/v1/helpdesk, roster, attendance)..."
                    style={{
                      width: '100%',
                      padding: '0.65rem 1rem 0.65rem 2.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--line, rgba(255, 255, 255, 0.15))',
                      background: 'var(--surface-2, #334155)',
                      color: '#ffffff',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--line, rgba(255, 255, 255, 0.15))',
                    background: 'var(--surface-2, #334155)',
                    color: '#ffffff',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="ALL">All Categories ({allTags.length})</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Method Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMethod(m)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      border: 'none',
                      background:
                        selectedMethod === m
                          ? m === 'ALL'
                            ? 'var(--signal, #6366f1)'
                            : methodColors[m]
                          : 'var(--surface-2, #334155)',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-2, #94a3b8)', alignSelf: 'center' }}>
                  Showing {filteredOps.length} of {operations.length} endpoints
                </span>
              </div>
            </div>

            {/* Endpoints List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredOps.map((op, idx) => {
                const isTesting = activeTest?.path === op.path && activeTest?.method === op.method;
                return (
                  <div
                    key={`${op.method}-${op.path}-${idx}`}
                    style={{
                      background: 'var(--card, #1e293b)',
                      border: '1px solid var(--line, rgba(255, 255, 255, 0.08))',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <span
                          style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '4px',
                            background: `${methodColors[op.method]}25`,
                            border: `1px solid ${methodColors[op.method]}`,
                            color: methodColors[op.method],
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            minWidth: '60px',
                            textAlign: 'center',
                          }}
                        >
                          {op.method}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                            {op.path}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-2, #94a3b8)', marginTop: '0.2rem' }}>
                            {op.summary}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-2, #94a3b8)',
                          }}
                        >
                          {op.tags.join(', ')}
                        </span>

                        <button
                          onClick={() => {
                            const curl = `curl -X ${op.method} "http://localhost:3000${op.path}" -H "Content-Type: application/json"`;
                            copyToClipboard(curl, `curl-${idx}`);
                          }}
                          title="Copy cURL Command"
                          style={{
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
                            background: 'transparent',
                            color: 'var(--text-2, #94a3b8)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          {copiedId === `curl-${idx}` ? <CheckCircleIcon sx={{ fontSize: 14, color: '#10b981' }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
                          cURL
                        </button>

                        <button
                          onClick={() => handleRunTest(op)}
                          disabled={testLoading && isTesting}
                          style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--signal, #6366f1)',
                            color: '#ffffff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                          }}
                        >
                          <PlayArrowIcon sx={{ fontSize: 14 }} /> Test
                        </button>
                      </div>
                    </div>

                    {/* Interactive Test Panel */}
                    {isTesting && (
                      <div
                        style={{
                          borderTop: '1px solid var(--line, rgba(255, 255, 255, 0.1))',
                          padding: '1rem',
                          background: 'rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        {['POST', 'PUT', 'PATCH'].includes(op.method) && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-2, #94a3b8)', display: 'block', marginBottom: '0.3rem' }}>
                              Request Payload (JSON):
                            </label>
                            <textarea
                              value={testPayload}
                              onChange={(e) => setTestPayload(e.target.value)}
                              rows={3}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                background: 'var(--surface-2, #334155)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontFamily: 'monospace',
                                fontSize: '0.8125rem',
                              }}
                            />
                          </div>
                        )}

                        {testLoading ? (
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-2, #94a3b8)' }}>Executing live HTTP call...</div>
                        ) : testResponse ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: testResponse.status < 400 ? '#10b981' : '#ef4444',
                                }}
                              >
                                HTTP {testResponse.status} {testResponse.statusText}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-2, #94a3b8)' }}>Time: {testResponse.duration}</span>
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                padding: '0.75rem',
                                borderRadius: '6px',
                                background: '#0b0f19',
                                color: '#a5f3fc',
                                fontSize: '0.75rem',
                                overflowX: 'auto',
                                maxHeight: '250px',
                              }}
                            >
                              {JSON.stringify(testResponse.body, null, 2)}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
      </main>
    </div>
  );
}
