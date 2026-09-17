"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useNucleusSession } from '@/context/NucleusSessionProvider';
import { NucleusOrb } from './NucleusOrb';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import MicOff from '@mui/icons-material/MicOff';
import OpenInNew from '@mui/icons-material/OpenInNew';

/**
 * NucleusDock — Persistent floating voice assistant dock.
 * Ported from helper/src/components/hrms/nucleus-dock.tsx
 *
 * Stays in the bottom-right corner across all workspace pages during an active voice session,
 * allowing continuous conversation, navigation, and live action draft confirmations.
 */
export function NucleusDock({ onOpenVoiceModal }: { onOpenVoiceModal?: () => void }) {
  const { status, listening, turns, draft, draftResult, confirmDraft, cancelDraft, disconnect, getLevels } = useNucleusSession();
  const [collapsed, setCollapsed] = useState(false);
  const previousDraft = useRef<string | null>(null);

  // Automatically expand if an action draft arrives requiring user confirmation
  useEffect(() => {
    const key = draft ? draft.action.name : null;
    if (key && key !== previousDraft.current) setCollapsed(false);
    previousDraft.current = key;
  }, [draft]);

  if (status !== 'live' && status !== 'connecting') return null;

  const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant');
  const lastUser = [...turns].reverse().find((t) => t.role === 'user');

  return (
    <aside
      aria-label="Nucleus AI active voice session"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        width: 'min(380px, calc(100vw - 32px))',
        background: 'var(--card, #ffffff)',
        border: '1px solid var(--line, rgba(0, 0, 0, 0.1))',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-overlay, 0 10px 30px rgba(0, 0, 0, 0.15))',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          borderBottom: collapsed ? 'none' : '1px solid var(--line, rgba(0, 0, 0, 0.08))',
          background: 'var(--card-2, rgba(0, 0, 0, 0.02))',
        }}
      >
        <div style={{ width: '38px', height: '38px', flexShrink: 0 }}>
          <NucleusOrb
            getLevels={getLevels}
            active={listening}
            size={38}
            label={listening ? 'Nucleus AI is listening' : 'Nucleus AI is connecting'}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text, #10222F)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Nucleus Talk
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-2, #5A6B78)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {status === 'connecting' ? 'Opening session…' : draft ? 'Awaiting confirmation' : 'Listening…'}
          </p>
        </div>

        {/* Status pill */}
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '999px',
            background: draft ? 'rgba(147, 51, 234, 0.12)' : listening ? 'var(--status-ok-wash, rgba(16, 185, 129, 0.1))' : 'var(--pending-wash, rgba(234, 179, 8, 0.1))',
            color: draft ? '#7c3aed' : listening ? 'var(--status-ok, #10b981)' : 'var(--pending, #eab308)',
          }}
        >
          {draft ? 'Draft' : listening ? 'Live' : '…'}
        </span>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand voice dock' : 'Collapse voice dock'}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-2, #5A6B78)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {collapsed ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
        </button>
      </div>

      {/* Expanded body */}
      {!collapsed && (
        <>
          {/* Conversation snippet */}
          <div
            style={{
              maxHeight: '180px',
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {lastUser && (
              <div style={{ alignSelf: 'flex-end', textAlign: 'right', maxWidth: '85%' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3, #888)' }}>You</span>
                <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: 500, color: 'var(--text, #10222F)', background: 'var(--signal-wash, rgba(37, 99, 235, 0.08))', padding: '6px 10px', borderRadius: '8px' }}>
                  {lastUser.text}
                </p>
              </div>
            )}
            {lastAssistant && (
              <div style={{ alignSelf: 'flex-start', textAlign: 'left', maxWidth: '85%' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-3, #888)' }}>Nucleus</span>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text, #10222F)', background: 'var(--card-2, rgba(0, 0, 0, 0.04))', padding: '6px 10px', borderRadius: '8px' }}>
                  {lastAssistant.text}
                </p>
              </div>
            )}
            {!lastUser && !lastAssistant && (
              <p style={{ margin: 0, textAlign: 'center', fontSize: '11px', color: 'var(--text-2, #5A6B78)' }}>
                Listening… Say a command or ask a question.
              </p>
            )}
          </div>

          {/* Action Draft card */}
          {draft && (
            <div
              style={{
                borderTop: '1px solid var(--line, rgba(0, 0, 0, 0.08))',
                background: 'rgba(147, 51, 234, 0.05)',
                padding: '12px 14px',
              }}
            >
              <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: 'var(--text, #10222F)' }}>
                Confirm before this is written
              </p>
              <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--text-2, #5A6B78)' }}>
                {draft.action.summary}
              </p>
              <div style={{ display: 'grid', gap: '4px', maxHeight: '120px', overflowY: 'auto', marginBottom: '10px' }}>
                {draft.fields.map((field) => (
                  <div key={field.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid var(--line, rgba(0,0,0,0.05))', paddingBottom: '3px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-2, #5A6B78)' }}>
                      {field.label}:
                      {field.origin === 'default' && <span style={{ fontWeight: 400, marginLeft: '4px', opacity: 0.8 }}>(not supplied — form default)</span>}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text, #10222F)' }}>
                      {typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => void confirmDraft()}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: 'var(--status-ok, #10b981)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Check sx={{ fontSize: 14 }} /> Confirm
                </button>
                <button
                  type="button"
                  onClick={cancelDraft}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    background: 'var(--card-2, rgba(0, 0, 0, 0.05))',
                    color: 'var(--text, #10222F)',
                    border: '1px solid var(--line, rgba(0, 0, 0, 0.1))',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Close sx={{ fontSize: 14 }} /> Cancel
                </button>
              </div>
            </div>
          )}

          {draftResult && (
            <div style={{ padding: '8px 14px', fontSize: '11px', background: 'var(--card-2, rgba(0,0,0,0.03))', borderTop: '1px solid var(--line, rgba(0,0,0,0.08))', color: 'var(--text, #10222F)' }}>
              {draftResult}
            </div>
          )}

          {/* Footer actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 14px',
              borderTop: '1px solid var(--line, rgba(0, 0, 0, 0.08))',
              background: 'var(--card-2, rgba(0, 0, 0, 0.02))',
            }}
          >
            {onOpenVoiceModal && (
              <button
                type="button"
                onClick={onOpenVoiceModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--signal, #2563eb)',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: 0,
                }}
              >
                <OpenInNew sx={{ fontSize: 13 }} /> Expand Assistant
              </button>
            )}
            <button
              type="button"
              onClick={() => void disconnect()}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--flag, #ef4444)',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                marginLeft: 'auto',
              }}
            >
              <MicOff sx={{ fontSize: 13 }} /> End Session
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
