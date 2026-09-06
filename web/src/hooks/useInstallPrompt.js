import { useCallback, useEffect, useState } from 'react';

const isStandaloneNow = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const ua = () => navigator.userAgent || '';

/** iPhone/iPad, including iPadOS which reports itself as a Mac. */
const detectIOS = () =>
  /iPad|iPhone|iPod/.test(ua()) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Safari on iOS is the only browser there that can add to the home screen. */
const detectIOSSafari = () =>
  detectIOS() && /Safari/.test(ua()) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua());

/**
 * Captures the browser's install prompt.
 *
 * Chromium fires `beforeinstallprompt`, which we hold onto so the app can ask
 * at a sensible moment. iOS Safari has no such event - installing there is a
 * manual Share -> Add to Home Screen, so we surface instructions instead.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandaloneNow);

  const isIOS = detectIOS();
  const isIOSSafari = detectIOSSafari();

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Catch the case where the app is reopened already installed.
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onModeChange = (e) => e.matches && setInstalled(true);
    mq?.addEventListener?.('change', onModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq?.removeEventListener?.('change', onModeChange);
    };
  }, []);

  /** Opens the native install dialog. Resolves true when the user accepts. */
  const install = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setInstalled(true);
    return outcome === 'accepted';
  }, [deferred]);

  return {
    /** True when the browser will show a real install dialog. */
    canInstall: Boolean(deferred) && !installed,
    /** True when we can only show manual instructions (iOS Safari). */
    needsManualSteps: isIOSSafari && !installed,
    install,
    installed,
    isIOS,
  };
}
