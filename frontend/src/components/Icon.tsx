import type { SVGProps } from 'react';

const PATHS: Record<string, string> = {
  arrow: 'M4 12h15M13 6l6 6-6 6',
  'arrow-left': 'M20 12H5M11 6l-6 6 6 6',
  'arrow-up-right': 'M7 17 17 7M8 7h9v9',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.3-4.3',
  close: 'M6 6l12 12M18 6 6 18',
  menu: 'M4 8h16M4 16h16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5 10 17 19 7',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-13v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 18Z',
  rain: 'M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15Zm1 3-1 2m5-2-1 2m5-2-1 2',
  snow: 'M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15Zm1 4h.01M12 19h.01M16 19h.01',
  storm: 'M7 15h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.4 1.5A3.3 3.3 0 0 0 7 15Zm6 0-2 4h3l-2 3',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  calendar: 'M5 6h14v14H5zM5 10h14M9 3v4m6-4v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9.5a3 3 0 1 0 0-6m2 15.5a5.5 5.5 0 0 0-3-5',
  bed: 'M3 18V7m0 7h18v4m0-4v-2a3 3 0 0 0-3-3h-7v5M7 12.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  bike: 'M6 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15l4-7h5l3 7m-8-7-1-2H7m6 9 2-7',
  car: 'M5 16h14v-4l-2-5H7l-2 5v4Zm0 0v2m14-2v2M5 12h14M8 14h.01M16 14h.01',
  fork: 'M7 3v8a2 2 0 0 0 2 2v8M11 3v8M7 7h4m6-4c-1.5 0-3 2-3 6s1.5 4 3 4v8',
  play: 'M8 5v14l11-7Z',
  swap: 'M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3',
  share: 'M16 6l-4-3-4 3m4-3v12M6 10H5v10h14V10h-1',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 16V5m0 0-4 4m4-4 4 4M5 20h14',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c-2.5 2.5-3.5 5.5-3.5 9s1 6.5 3.5 9m0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9M3.5 9h17m-17 6h17',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5m-5 4h5',
  trash: 'M5 7h14M10 7V4h4v3m-7 0 1 13h8l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off': 'M4 4l16 16M10 6.2A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.5 7.6A16 16 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 4.4-1',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v3h3m-3 6a8 8 0 0 0 14.6 4.5M20 20v-3h-3',
  key: 'M14 10a4 4 0 1 0-1.2 2.8L20 20m-3-3 2-2',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  dot: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5Z',
  wave: 'M3 10c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
  leaf: 'M5 19c8 0 14-6 14-14-8 0-14 6-14 14Zm0 0 7-7',
  cup: 'M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zm12 1h1a2 2 0 0 1 0 4h-1M8 3v2m4-2v2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2',
  flame: 'M12 21a6 6 0 0 0 6-6c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-3 5-3 8a6 6 0 0 0 6 6Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  qr: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z',
  shield: 'M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6Z',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, size = 16, strokeWidth = 1.4, filled = false, ...rest }: { name: IconName; size?: number; strokeWidth?: number; filled?: boolean } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name] ?? PATHS.dot} />
    </svg>
  );
}

export function weatherIcon(code?: number, wet?: boolean): IconName {
  if (code == null) return 'cloud';
  if (code >= 95) return 'storm';
  if (code >= 71 && code <= 86 && code !== 80 && code !== 81 && code !== 82) return 'snow';
  if (wet || code >= 51) return 'rain';
  if (code >= 2) return 'cloud';
  return 'sun';
}
