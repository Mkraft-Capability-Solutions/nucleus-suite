"use client";

import React, { useState } from 'react';
import Close from '@mui/icons-material/Close';
import CheckCircle from '@mui/icons-material/CheckCircleOutline';
import Cancel from '@mui/icons-material/CancelOutlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Shield from '@mui/icons-material/ShieldOutlined';
import AccountBalance from '@mui/icons-material/AccountBalanceOutlined';
import styles from './CtcExceptionModal.module.css';

export default function CtcExceptionModal({ isOpen, onClose, requestData, onApprove, onReject }) {
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const data = requestData || {
    id: 'CTC-EXC-2026-089',
    candidateName: 'Aarav Singhania',
    role: 'Lead Fullstack Architect',
    department: 'Engineering & Technology',
    hiringManager: 'Ramesh Nair',
    approvedBandMax: 2200000, // 22L
    requestedCtc: 2650000,    // 26.5L
    currentCtc: 2100000,
    variancePct: 20.45,
    justification: 'Candidate holds rare dual specialization in Next.js Turbopack core architecture and high-throughput PostgreSQL PgVector pipelines. Competing offer from Tier-1 fintech at 27L.'
  };

  const varianceAmount = data.requestedCtc - data.approvedBandMax;
  const variancePct = ((varianceAmount / data.approvedBandMax) * 100).toFixed(1);

  const handleAction = async (decision) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/v1/operations/ctc-exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          id: data.id,
          candidateName: data.candidateName,
          role: data.role,
          department: data.department,
          approvedBandMax: data.approvedBandMax,
          requestedCtc: data.requestedCtc,
          justification: data.justification,
          action: decision,
          remarks
        })
      }).catch(() => null);
    } catch {}
    try {
      fetch('/api/v1/workspace/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ id: data.id, action: decision.toLowerCase(), remarks, item: data })
      }).catch(() => null);
    } catch {}
    if (decision === 'APPROVE' && onApprove) {
      await onApprove({ ...data, decision: 'APPROVED', remarks });
    } else if (decision === 'REJECT' && onReject) {
      await onReject({ ...data, decision: 'REJECTED', remarks });
    }
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <TrendingUp sx={{ fontSize: 20 }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text, #0f172a)' }}>
                Talent CTC Exception Approval
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-2, #64748b)' }}>
                Request ID: {data.id} • Out-of-Band Budget Authorization
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2, #64748b)' }}
          >
            <Close sx={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Candidate & Role Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.82rem' }}>
            <div>
              <span style={{ color: 'var(--text-2, #64748b)' }}>Candidate: </span>
              <strong style={{ color: 'var(--text, #0f172a)' }}>{data.candidateName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-2, #64748b)' }}>Role: </span>
              <strong style={{ color: 'var(--text, #0f172a)' }}>{data.role}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-2, #64748b)' }}>Department: </span>
              <span>{data.department}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-2, #64748b)' }}>Hiring Manager: </span>
              <span>{data.hiringManager}</span>
            </div>
          </div>

          {/* CTC Comparison Card */}
          <div className={styles.compComparisonCard}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Approved Band (Max)</span>
              <span className={styles.statValue}>₹{(data.approvedBandMax / 100000).toFixed(1)} LPA</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Requested CTC</span>
              <span className={styles.statValue} style={{ color: '#2563eb' }}>
                ₹{(data.requestedCtc / 100000).toFixed(2)} LPA
              </span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Budget Variance</span>
              <span className={`${styles.statValue} ${styles.statVariance}`}>
                +{variancePct}% (+₹{(varianceAmount / 100000).toFixed(1)}L)
              </span>
            </div>
          </div>

          {/* Justification Box */}
          <div style={{ background: 'var(--card-2, #f8fafc)', border: '1px solid var(--line, #e2e8f0)', borderRadius: '12px', padding: '1rem' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-2, #64748b)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
              Business Justification & Market Compa-Ratio
            </div>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text, #334155)', lineHeight: 1.45 }}>
              {data.justification}
            </p>
          </div>

          {/* Multi-Level Approval Hierarchy */}
          <div className={styles.approvalSteps}>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-2, #64748b)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              Multi-Level Authorization Hierarchy
            </div>
            <div className={styles.stepRow}>
              <span>1. Hiring Manager Endorsement ({data.hiringManager})</span>
              <span className={styles.stepStatusDone}><CheckCircle sx={{ fontSize: 14 }} /> Approved</span>
            </div>
            <div className={styles.stepRow}>
              <span>2. Head of HR Review (Sunita Verma)</span>
              <span className={styles.stepStatusDone}><CheckCircle sx={{ fontSize: 14 }} /> Recommended</span>
            </div>
            <div className={styles.stepRow}>
              <span>3. Business Unit Head / CFO Sign-off (Current Step)</span>
              <span className={styles.stepStatusPending}><Shield sx={{ fontSize: 14 }} /> Pending Decision</span>
            </div>
          </div>

          {/* Decision Remarks */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text, #0f172a)', marginBottom: '0.35rem' }}>
              Executive Decision Remarks
            </label>
            <textarea
              style={{
                width: '100%', borderRadius: '8px', border: '1px solid var(--line, #e2e8f0)',
                padding: '0.65rem 0.85rem', fontSize: '0.84rem', fontFamily: 'inherit',
                background: 'var(--card, #ffffff)', color: 'var(--text, #0f172a)'
              }}
              rows={2}
              placeholder="Enter optional approval justification or rejection rationale..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.btnReject}
            onClick={() => handleAction('REJECT')}
            disabled={isSubmitting}
          >
            <Cancel sx={{ fontSize: 16 }} />
            Reject Exception
          </button>
          <button
            type="button"
            className={styles.btnApprove}
            onClick={() => handleAction('APPROVE')}
            disabled={isSubmitting}
          >
            <CheckCircle sx={{ fontSize: 16 }} />
            Approve Out-of-Band CTC
          </button>
        </div>
      </div>
    </div>
  );
}
