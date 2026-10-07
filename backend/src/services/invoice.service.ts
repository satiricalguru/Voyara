import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { env } from '../config/env.js';

interface InvoiceBooking {
  reference: string;
  createdAt?: Date;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  roomsCount: number;
  guestName: string;
  guestEmail: string;
  guests: { adults: number; children: number };
  status: string;
  paymentStatus: string;
  addons: { name?: string | null; total?: number | null; quantity?: number | null }[];
  couponCode?: string | null;
  pricing: { roomRate?: number | null; roomTotal?: number | null; addonsTotal?: number | null; discount?: number | null; taxes?: number | null; total?: number | null; currency?: string | null };
  hotel: { name: string; address?: string | null; city: string; country: string };
  room: { name: string };
}

// Light "atmospheric" palette — ink on white, Jetstream for the boarding-pass block.
const INK = '#0a1424';
const PAPER = '#ffffff';
const JET = '#001489';
const MUTE = '#6b7f95';
const LINE = '#d3e0ec';

const money = (n: number | null | undefined, c = 'INR') =>
  `${c} ${(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (d: Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

export async function renderInvoice(b: InvoiceBooking): Promise<Buffer> {
  const verifyUrl = `${env.PUBLIC_APP_URL}/bookings/${b.reference}`;
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 220, color: { dark: INK, light: PAPER } });
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width;
  const H = doc.page.height;
  const M = 48;
  const cur = b.pricing.currency ?? 'INR';

  doc.rect(0, 0, W, H).fill(PAPER);
  doc.rect(0, 0, W, 6).fill(JET);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(46).text('VOYARA', M, M, { lineGap: -8 });
  doc.font('Helvetica').fontSize(8).fillColor(MUTE).text('WHOLE-TRIP AI TRAVEL ARCHITECT', M, M + 50, { characterSpacing: 1 });

  doc.fontSize(8).fillColor(INK).text('TAX INVOICE', W - M - 200, M + 4, { width: 200, align: 'right', characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(16).text(b.reference, W - M - 200, M + 18, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(MUTE)
    .text(`ISSUED ${date(b.createdAt ?? new Date())}`, W - M - 200, M + 40, { width: 200, align: 'right' });

  const dash = (y: number) => doc.moveTo(M, y).lineTo(W - M, y).dash(2, { space: 3 }).strokeColor(LINE).lineWidth(1).stroke().undash();
  dash(130);

  const label = (t: string, x: number, y: number) => doc.font('Helvetica').fontSize(7).fillColor(MUTE).text(t, x, y, { characterSpacing: 1 });
  const value = (t: string, x: number, y: number, w = 220) => doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(t.toUpperCase(), x, y, { width: w });

  label('STAY', M, 150);
  value(b.hotel.name, M, 162, 300);
  doc.font('Helvetica').fontSize(9).fillColor(INK).text([b.hotel.address, b.hotel.city, b.hotel.country].filter(Boolean).join(', '), M, 180, { width: 300 });

  label('GUEST', 360, 150);
  value(b.guestName, 360, 162, 190);
  doc.font('Helvetica').fontSize(9).fillColor(INK).text(b.guestEmail, 360, 180, { width: 190 });

  dash(214);
  const cols = [
    ['CHECK-IN', date(b.checkIn)],
    ['CHECK-OUT', date(b.checkOut)],
    ['NIGHTS', String(b.nights)],
    ['GUESTS', `${b.guests.adults}A ${b.guests.children}C`],
    ['STATUS', b.status.replace('_', ' ')],
  ];
  cols.forEach(([l, v], i) => {
    const x = M + i * 100;
    label(l, x, 232);
    value(v, x, 244, 96);
  });
  dash(278);

  let y = 300;
  const line = (l: string, v: string, opts: { accent?: boolean; strong?: boolean } = {}) => {
    doc.font(opts.strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.strong ? 13 : 10)
      .fillColor(opts.accent ? JET : INK).text(l.toUpperCase(), M, y, { width: 330 });
    doc.text(v, W - M - 180, y, { width: 180, align: 'right' });
    y += opts.strong ? 26 : 20;
  };
  line(`${b.room.name} × ${b.roomsCount} · ${b.nights} night${b.nights > 1 ? 's' : ''} @ ${money(b.pricing.roomRate, cur)}`, money(b.pricing.roomTotal, cur));
  for (const a of b.addons) line(`${a.name} × ${a.quantity ?? 1}`, money(a.total, cur));
  if (b.pricing.discount) line(`Discount${b.couponCode ? ` (${b.couponCode})` : ''}`, `− ${money(b.pricing.discount, cur)}`, { accent: true });
  line(`Taxes (${Math.round(env.TAX_RATE * 100)}% GST)`, money(b.pricing.taxes, cur));
  y += 6;
  dash(y);
  y += 14;
  line('Total', money(b.pricing.total, cur), { strong: true });
  doc.font('Helvetica').fontSize(8).fillColor(MUTE).text(`PAYMENT · ${b.paymentStatus.replace(/_/g, ' ')}`, M, y);

  const boxY = H - 260;
  doc.rect(M, boxY, W - 2 * M, 190).fill(JET);
  doc.image(qr, M + 20, boxY + 20, { width: 150 });
  doc.fillColor(PAPER).font('Helvetica-Bold').fontSize(18).text('Show this at\nthe front desk.', M + 200, boxY + 30, { lineGap: -2 });
  doc.font('Helvetica').fontSize(10).fillColor(PAPER).text('Staff scan the code to pull up your reservation and check you in. Keep this invoice for your records.', M + 200, boxY + 82, { width: W - 2 * M - 230 });
  doc.fontSize(7).fillColor(PAPER).text(`* BUILT BY VOYARA · ${verifyUrl}`, M + 200, boxY + 150, { width: W - 2 * M - 230 });

  doc.end();
  return done;
}
