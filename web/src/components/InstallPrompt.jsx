import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { Download, X, Share, AddSquare, Bolt, Camera, WifiOff, Check } from './Icons';
import Logo from './Logo';

const DISMISS_KEY = 'evigilance.install.dismissedAt';
const SNOOZE_DAYS = 7;
const DELAY_MS = 2500;

/** True while the user's "Not now" is still in effect. */
export const installSheetDismissed = () => {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < SNOOZE_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const dismissedRecently = installSheetDismissed;

const PERKS = [
  { icon: Bolt, text: 'Sits with your other apps and opens instantly' },
  { icon: Camera, text: 'Full-screen camera, no browser bars' },
  { icon: WifiOff, text: 'Your reports stay readable offline' },
];

/**
 * Bottom-sheet invitation to install the PWA.
 *
 * Chromium browsers get a real install button wired to `beforeinstallprompt`.
 * iOS Safari cannot be triggered programmatically, so it gets the exact
 * Share -> Add to Home Screen steps instead.
 */
export default function InstallPrompt() {
  const { canInstall, needsManualSteps, install, installed } = useInstallPrompt();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Filing a report means capturing evidence in modals - never interrupt that.
  const busyRoute = pathname.startsWith('/report') && pathname !== '/reports';
  const eligible = (canInstall || needsManualSteps) && !installed && !busyRoute;

  // Wait a beat so the sheet never interrupts the first paint.
  useEffect(() => {
    if (!eligible || dismissedRecently()) return;
    const id = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(id);
  }, [eligible]);

  // Close immediately if the user starts a report while the sheet is up.
  useEffect(() => { if (busyRoute) setOpen(false); }, [busyRoute]);

  // Close automatically once the app is actually installed.
  useEffect(() => {
    if (!installed) return;
    setDone(true);
    const id = setTimeout(() => setOpen(false), 2200);
    return () => clearTimeout(id);
  }, [installed]);

  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
    setOpen(false);
  };

  const onInstall = async () => {
    setBusy(true);
    try {
      const accepted = await install();
      if (accepted) setDone(true);
      else close();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="install-sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <div className="modal-grab" />

        <button className="install-close" onClick={close} aria-label="Not now">
          <X size={18} />
        </button>

        {done ? (
          <div className="stack gap-14 text-center" style={{ alignItems: 'center', padding: '14px 0 6px' }}>
            <div className="success-badge" style={{ width: 70, height: 70 }}>
              <Check size={34} />
            </div>
            <div>
              <h3>{needsManualSteps ? 'Added to your home screen' : 'E-Vigilance is installed'}</h3>
              <p className="muted small mt-4">
                {needsManualSteps
                  ? 'Look for the E-Vigilance icon on your home screen.'
                  : 'Find it in your app list alongside your other apps — it opens in its own window.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="row gap-14">
              <span className="install-icon"><Logo size={30} /></span>
              <div className="grow">
                <h3 id="install-title">Install E-Vigilance</h3>
                <p className="muted small mt-4">
                  {needsManualSteps
                    ? 'Add E-Vigilance to your home screen so it opens like a normal app, with no browser bars.'
                    : 'Install E-Vigilance as a real app. It appears in your app list and opens in its own window.'}
                </p>
              </div>
            </div>

            <ul className="stack gap-10 install-perks">
              {PERKS.map(({ icon: Icon, text }) => (
                <li className="row gap-10" key={text}>
                  <Icon size={16} className="subtle" style={{ flex: 'none' }} />
                  <span className="small">{text}</span>
                </li>
              ))}
            </ul>

            {needsManualSteps ? (
              <>
                <div className="install-steps">
                  <div className="row gap-10">
                    <span className="step-num">1</span>
                    <span className="small grow">
                      Tap <Share size={15} className="inline-ico" /> <strong>Share</strong> in the Safari toolbar
                    </span>
                  </div>
                  <div className="row gap-10">
                    <span className="step-num">2</span>
                    <span className="small grow">
                      Choose <AddSquare size={15} className="inline-ico" /> <strong>Add to Home Screen</strong>
                    </span>
                  </div>
                  <div className="row gap-10">
                    <span className="step-num">3</span>
                    <span className="small grow">Tap <strong>Add</strong> — done</span>
                  </div>
                </div>
                <button className="btn btn-primary btn-lg btn-block" onClick={close}>Got it</button>
              </>
            ) : (
              <div className="stack gap-8">
                <button className="btn btn-primary btn-lg btn-block" onClick={onInstall} disabled={busy}>
                  {busy ? <><span className="spinner" /> Installing…</> : <><Download size={19} /> Install app</>}
                </button>
                <button className="btn btn-ghost btn-block" onClick={close}>Not now</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
