'use client';

import React, { useState } from 'react';
import { useAuth, useClerk } from '@clerk/nextjs';

/** Logs the user out of Clerk and sends them home. Renders nothing for guests. */
export function LogoutButton({ className = 'btn btn-outline', label = 'Log out' }: { className?: string; label?: string }) {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  if (!isSignedIn) return null;

  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Notify open pages so bag/order views refresh as a guest.
        await signOut({ redirectUrl: '/' });
        window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
      }}
    >
      {busy ? 'Logging out…' : label}
    </button>
  );
}
