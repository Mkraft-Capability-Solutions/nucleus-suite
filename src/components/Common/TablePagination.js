'use client';
import React from 'react';

/**
 * Reusable enterprise table pagination bar conforming to design system tokens.
 */
export default function TablePagination({
    currentPage = 1,
    totalItems = 0,
    pageSize = 15,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 15, 25, 50]
}) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startRecord = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endRecord = Math.min(currentPage * pageSize, totalItems);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderTop: '1px solid var(--line-soft)',
            background: 'var(--card)',
            borderBottomLeftRadius: 'var(--r-card)',
            borderBottomRightRadius: 'var(--r-card)',
            fontSize: '0.82rem',
            color: 'var(--text-2)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>
                    Showing <strong style={{ color: 'var(--text)' }}>{startRecord}</strong> to <strong style={{ color: 'var(--text)' }}>{endRecord}</strong> of <strong style={{ color: 'var(--text)' }}>{totalItems}</strong> entries
                </span>
                <span style={{ margin: '0 0.35rem', color: 'var(--line)' }}>|</span>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Rows:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => {
                            if (onPageSizeChange) onPageSizeChange(Number(e.target.value));
                            if (onPageChange) onPageChange(1);
                        }}
                        style={{
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            border: '1px solid var(--line)',
                            borderRadius: 'var(--r-control)',
                            padding: '0.2rem 0.45rem',
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                        }}
                    >
                        {pageSizeOptions.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange && onPageChange(currentPage - 1)}
                    style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--r-control)',
                        border: '1px solid var(--line)',
                        background: currentPage <= 1 ? 'var(--card-2)' : 'var(--paper)',
                        color: currentPage <= 1 ? 'var(--text-3)' : 'var(--text)',
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        transition: 'all 0.15s ease'
                    }}
                >
                    &larr; Prev
                </button>

                <span style={{ padding: '0 0.4rem', color: 'var(--text)' }}>
                    Page <strong style={{ color: 'var(--signal-ink)' }}>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>

                <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => onPageChange && onPageChange(currentPage + 1)}
                    style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--r-control)',
                        border: '1px solid var(--line)',
                        background: currentPage >= totalPages ? 'var(--card-2)' : 'var(--paper)',
                        color: currentPage >= totalPages ? 'var(--text-3)' : 'var(--text)',
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        transition: 'all 0.15s ease'
                    }}
                >
                    Next &rarr;
                </button>
            </div>
        </div>
    );
}
