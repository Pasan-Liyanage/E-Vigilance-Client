/**
 * The E-Vigilance mark.
 *
 * Served as an SVG file rather than inlined so the browser caches it once and
 * the same asset backs the app icons. BASE_URL keeps it correct when the app
 * is hosted from a sub-path (GitHub Pages).
 */
const src = `${import.meta.env.BASE_URL}logo.svg`;

/** The logo on its own, sized by height. */
export default function Logo({ size = 34, className = '', style }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ height: size, width: 'auto', display: 'block', ...style }}
    />
  );
}

/**
 * The logo on a white plate, for use over the brand gradient where the mark's
 * own blues would otherwise sink into the background.
 */
export function LogoPlate({ size = 52, logoScale = 0.74, style }) {
  return (
    <span
      className="logo-plate"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), ...style }}
    >
      <Logo size={Math.round(size * logoScale * 0.64)} />
    </span>
  );
}
