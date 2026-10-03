import React from 'react';
import { Card, Icon, EmptyState } from '@/components';
import { addWhitelistEntry, removeWhitelistEntry } from '@/lib/messaging';

/**
 * TrustedSection — full trusted senders management for the options page.
 */
export function TrustedSection({ whitelist, onUpdate }) {
  const [input, setInput] = React.useState('');

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
    <Card accent="gold" padding="lg" style={{ animation: 'pn-fade-up 0.3s var(--pn-ease-out) both' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--pn-space-3)',
        marginBottom: 'var(--pn-space-4)',
      }}>
        <div style={{
          width: 40, height: 40,
          borderRadius: 'var(--pn-radius-md)',
          background: 'var(--pn-gold-pale)',
          color: 'var(--pn-gold)',
          display: 'grid', placeItems: 'center',
        }}>
          <Icon name="star" size={22} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--pn-font-heading)', fontSize: 'var(--pn-text-md)', fontWeight: 800 }}>
            Trusted Senders
          </div>
          <div style={{ fontSize: 'var(--pn-text-sm)', color: 'var(--pn-text-tertiary)', marginTop: 2 }}>
            Emails from these senders skip scanning and are marked safe instantly.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--pn-space-2)', marginBottom: 'var(--pn-space-4)' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="company.com or user@email.com"
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 'var(--pn-radius-md)',
            border: '1.5px solid var(--pn-border)',
            background: 'var(--pn-bg-card)',
            color: 'var(--pn-text-primary)',
            fontSize: 'var(--pn-text-base)',
            fontFamily: 'var(--pn-font-body)',
            outline: 'none',
            transition: 'border-color var(--pn-dur-fast)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--pn-coral)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--pn-border)'; }}
        />
        <button
          onClick={handleAdd}
          style={{
            padding: '0 24px',
            borderRadius: 'var(--pn-radius-md)',
            border: 'none',
            background: 'linear-gradient(135deg, var(--pn-coral-light), var(--pn-coral))',
            color: '#fff',
            fontSize: 'var(--pn-text-base)',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: 'var(--pn-shadow-coral)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Icon name="plus" size={18} /> Add
        </button>
      </div>

      {whitelist.length === 0 ? (
        <EmptyState
          icon={<Icon name="star" size={28} />}
          title="No trusted senders yet"
          subtitle="Add domains or email addresses to skip scanning for known-safe senders."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {whitelist.map((entry, i) => (
            <div
              key={entry}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--pn-radius-md)',
                background: 'var(--pn-bg-subtle)',
                animation: `pn-slide-in-right 0.25s var(--pn-ease-out) both`,
                animationDelay: `${i * 0.03}s`,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--pn-space-2)', fontWeight: 600, color: 'var(--pn-text-primary)' }}>
                <span style={{ color: 'var(--pn-gold)' }}><Icon name="star" size={16} /></span>
                {entry}
              </span>
              <button
                onClick={() => handleRemove(entry)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--pn-text-tertiary)', cursor: 'pointer',
                  padding: 6, borderRadius: 'var(--pn-radius-sm)',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
