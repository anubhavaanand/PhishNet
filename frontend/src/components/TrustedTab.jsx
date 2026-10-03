import React, { useState } from 'react';
import { Button, Card, EmptyState, Icon } from '@/components';
import { addWhitelistEntry, removeWhitelistEntry } from '@/lib/messaging';

/**
 * TrustedTab — add/remove trusted senders (whitelist).
 */
export function TrustedTab({ whitelist, onUpdate }) {
  const [input, setInput] = useState('');

  const handleAdd = async () => {
    const val = input.trim().toLowerCase();
    if (!val) return;
    const res = await addWhitelistEntry(val);
    if (res?.success) {
      onUpdate(res.whitelist);
      setInput('');
    }
  };

  const handleRemove = async (entry) => {
    const res = await removeWhitelistEntry(entry);
    if (res?.success) {
      onUpdate(res.whitelist);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pn-space-3)', animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
      <div style={{ textAlign: 'center', paddingTop: 'var(--pn-space-2)' }}>
        <div style={{ fontFamily: 'var(--pn-font-heading)', fontSize: 'var(--pn-text-md)', fontWeight: 800, color: 'var(--pn-text-primary)' }}>
          Trusted Senders
        </div>
        <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 4 }}>
          Emails from these senders are always marked safe.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--pn-space-2)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="company.com or user@email.com"
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 'var(--pn-radius-md)',
            border: '1.5px solid var(--pn-border)',
            background: 'var(--pn-bg-card)',
            color: 'var(--pn-text-primary)',
            fontSize: 'var(--pn-text-sm)',
            fontFamily: 'var(--pn-font-body)',
            outline: 'none',
            transition: 'border-color var(--pn-dur-fast)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--pn-coral)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--pn-border)'; }}
        />
        <Button variant="primary" size="md" onClick={handleAdd} icon={<Icon name="plus" size={18} />}>
          Add
        </Button>
      </div>

      {whitelist.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon={<Icon name="star" size={28} />}
            title="No trusted senders yet"
            subtitle="Add a domain or email address above to skip scanning for senders you know are safe."
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {whitelist.map((entry, i) => (
            <div
              key={entry}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--pn-radius-md)',
                background: 'var(--pn-bg-card)',
                border: '1px solid var(--pn-border)',
                animation: `pn-slide-in-right 0.25s var(--pn-ease-out) both`,
                animationDelay: `${i * 0.03}s`,
              }}
            >
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--pn-space-2)',
                fontSize: 'var(--pn-text-sm)',
                fontWeight: 600,
                color: 'var(--pn-text-primary)',
              }}>
                <span style={{ color: 'var(--pn-gold)' }}>
                  <Icon name="star" size={16} />
                </span>
                {entry}
              </span>
              <button
                onClick={() => handleRemove(entry)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pn-text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 'var(--pn-radius-sm)',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'color var(--pn-dur-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--pn-rose)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--pn-text-tertiary)'; }}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
