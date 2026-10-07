import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QR({ value, size = 180 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size * 2, color: { dark: '#0a1424', light: '#ffffff' } }).then(setSrc).catch(() => setSrc(null));
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt={`QR code for ${value}`} className="qr" /> : <div className="skeleton" style={{ width: size, height: size }} />;
}
