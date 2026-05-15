import { useState, useEffect } from 'react';
import { getSubscriptionState } from '../../lib/push';
import { NotificationSetup } from './NotificationSetup';

export function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    getSubscriptionState().then(({ subscribed }) => setSubscribed(subscribed));
  }, []);

  const handleClose = () => {
    setOpen(false);
    // Refresh subscribed state after closing
    getSubscriptionState().then(({ subscribed }) => setSubscribed(subscribed));
  };

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return null; // Hide on unsupported browsers
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`relative w-10 h-10 rounded-2xl border flex items-center justify-center transition-all ${
          subscribed
            ? 'bg-lake-600/30 border-lake-500/50 text-lake-300'
            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
        }`}
        title={subscribed ? 'Notificări active' : 'Activează notificările'}
      >
        <span className="text-lg">{subscribed ? '🔔' : '🔕'}</span>
        {subscribed && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-mud-900" />
        )}
      </button>

      {open && <NotificationSetup onClose={handleClose} />}
    </>
  );
}
