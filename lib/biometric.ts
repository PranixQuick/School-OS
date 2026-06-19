// lib/biometric.ts
// ISS-OTP PR7 — biometric (fingerprint) unlock helper. Uniform across all roles.
//
// Model: a DEVICE-LOCAL app-lock over the already-established session. Our session
// cookies are httpOnly (unreadable from JS), so we do NOT stash a token; instead
// biometric gates whether the app UI is shown on open. The session cookie still
// provides auth, and PIN/OTP login remains the real fallback (no lockout).
//
// Everything is FEATURE-DETECTED and dynamic-imported: on web, or any build
// without the native plugin, every call no-ops (returns false). Only an actual
// Android/iOS build with the plugin (after `cap sync` + a store release) is live.

const ENABLED_KEY = 'edprosys_biometric_enabled';

async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch { return false; }
}

/** True only on a native build where biometry hardware is enrolled & available. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!(await isNativePlatform())) return false;
  try {
    const mod = await import('@aparajita/capacitor-biometric-auth');
    const info = await mod.BiometricAuth.checkBiometry();
    return !!info?.isAvailable;
  } catch {
    return false;
  }
}

export function isBiometricEnabled(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(ENABLED_KEY) === '1';
  } catch { return false; }
}

export function setBiometricEnabled(on: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (on) window.localStorage.setItem(ENABLED_KEY, '1');
    else window.localStorage.removeItem(ENABLED_KEY);
  } catch { /* ignore */ }
}

/**
 * Trigger the OS BiometricPrompt. Allows the device credential (PIN/pattern) as
 * the built-in fallback. Returns true on success, false on cancel/failure/web.
 */
export async function authenticateBiometric(reason = 'Unlock EdProSys'): Promise<boolean> {
  try {
    const mod = await import('@aparajita/capacitor-biometric-auth');
    await mod.BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'EdProSys',
      androidSubtitle: 'Unlock with your fingerprint',
    });
    return true;
  } catch {
    return false;
  }
}
