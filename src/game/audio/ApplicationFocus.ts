/** One focus gate for browser tabs, desktop windows and the native Android lifecycle. */
export function watchApplicationFocus(onChange: (active: boolean) => void): () => void {
  let active: boolean | undefined;
  const update = (next: boolean) => {
    if (active === next) return;
    active = next; onChange(next);
  };
  const blur = () => update(false);
  const focus = () => update(!document.hidden);
  const visibility = () => update(!document.hidden && document.hasFocus());
  window.addEventListener('blur', blur);
  window.addEventListener('focus', focus);
  window.addEventListener('pagehide', blur);
  window.addEventListener('pageshow', visibility);
  document.addEventListener('visibilitychange', visibility);
  visibility();
  return () => {
    window.removeEventListener('blur', blur);
    window.removeEventListener('focus', focus);
    window.removeEventListener('pagehide', blur);
    window.removeEventListener('pageshow', visibility);
    document.removeEventListener('visibilitychange', visibility);
  };
}
