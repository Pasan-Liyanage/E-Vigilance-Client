/** Compact stroke-based icon set (no icon library dependency). */
const Svg = ({ size = 20, children, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const Shield = (p) => (
  <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const Home = (p) => (
  <Svg {...p}><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 21v-7h6v7" /></Svg>
);
export const FileText = (p) => (
  <Svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h6" /></Svg>
);
export const Plus = (p) => (<Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>);
export const User = (p) => (
  <Svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
);
export const Camera = (p) => (
  <Svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></Svg>
);
export const Video = (p) => (
  <Svg {...p}><path d="m23 7-7 5 7 5z" /><rect x="1" y="5" width="15" height="14" rx="2" /></Svg>
);
export const Mic = (p) => (
  <Svg {...p}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v4M8 23h8" /></Svg>
);
export const Image = (p) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Svg>
);
export const MapPin = (p) => (
  <Svg {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Svg>
);
export const Calendar = (p) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg>
);
export const Clock = (p) => (<Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Svg>);
export const Car = (p) => (
  <Svg {...p}><path d="M5 17H3v-5l2-5h14l2 5v5h-2" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M9.5 17h5" /></Svg>
);
export const Alert = (p) => (
  <Svg {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></Svg>
);
export const Check = (p) => (<Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>);
export const CheckCircle = (p) => (
  <Svg {...p}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m22 4-10 10.01-3-3" /></Svg>
);
export const X = (p) => (<Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>);
export const ChevronLeft = (p) => (<Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>);
export const ChevronRight = (p) => (<Svg {...p}><path d="m9 18 6-6-6-6" /></Svg>);
export const Search = (p) => (<Svg {...p}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></Svg>);
export const Mail = (p) => (
  <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></Svg>
);
export const Lock = (p) => (
  <Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>
);
export const Eye = (p) => (
  <Svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Svg>
);
export const EyeOff = (p) => (
  <Svg {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></Svg>
);
export const IdCard = (p) => (
  <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><circle cx="8.5" cy="11" r="2.5" /><path d="M14 9h5M14 13h5M4.5 17c.7-1.6 2-2.5 4-2.5s3.3.9 4 2.5" /></Svg>
);
export const Phone = (p) => (
  <Svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.26-1.26a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>
);
export const LogOut = (p) => (
  <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></Svg>
);
export const Sun = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></Svg>
);
export const Moon = (p) => (<Svg {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>);
export const Download = (p) => (
  <Svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5M12 15V3" /></Svg>
);
export const WifiOff = (p) => (
  <Svg {...p}><path d="M1 1l22 22" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.9 15.9 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></Svg>
);
export const Trash = (p) => (
  <Svg {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></Svg>
);
export const Play = (p) => (<Svg {...p}><path d="M6 3l14 9-14 9z" /></Svg>);
export const Refresh = (p) => (
  <Svg {...p}><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Svg>
);
export const Crosshair = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /><circle cx="12" cy="12" r="2.5" /></Svg>
);
export const Info = (p) => (<Svg {...p}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></Svg>);
export const Send = (p) => (<Svg {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></Svg>);
export const Flip = (p) => (
  <Svg {...p}><path d="M3 7v6h6" /><path d="M21 17v-6h-6" /><path d="M6.34 17.66A9 9 0 0 0 20.49 15M3.51 9A9 9 0 0 1 17.66 6.34" /></Svg>
);
export const Inbox = (p) => (
  <Svg {...p}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></Svg>
);
export const Sparkle = (p) => (
  <Svg {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m6.3 6.3 2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" /></Svg>
);
export const Share = (p) => (
  <Svg {...p}><path d="M12 16V3" /><path d="m8 7 4-4 4 4" /><path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" /></Svg>
);
export const AddSquare = (p) => (
  <Svg {...p}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></Svg>
);
export const Bolt = (p) => (<Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Svg>);
