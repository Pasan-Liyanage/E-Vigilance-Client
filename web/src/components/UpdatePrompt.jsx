import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Refresh } from './Icons';

/** How often an open app looks for a newer version, besides when it comes back on screen. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Keeps the installed app current. It looks for a newer version when it
 * starts, whenever it comes back on screen, and every half hour. A newer
 * version is applied at once, except while a report is being written: a
 * reload there would lose the photos already attached, so a bar offers the
 * update instead.
 */
export default function UpdatePrompt() {
  const { pathname } = useLocation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) registration.update().catch(() => {});
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  const writing = pathname.startsWith('/report');

  useEffect(() => {
    if (needRefresh && !writing) updateServiceWorker(true);
  }, [needRefresh, writing, updateServiceWorker]);

  if (!needRefresh || !writing) return null;
  return (
    <div className="update-bar" role="status">
      <span className="small">
        A newer version of E-Vigilance is ready. It will load when you leave this report, or now
        (attached photos and videos would need adding again).
      </span>
      <button className="btn btn-sm btn-outline" onClick={() => updateServiceWorker(true)}>
        <Refresh size={15} /> Update now
      </button>
    </div>
  );
}
