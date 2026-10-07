import type { Pricing } from '../types';
import { money } from '../utils/format';

export function PriceBreakdown({ pricing, nights, roomName, roomsCount = 1, addons = [], couponCode }: {
  pricing: Pricing;
  nights: number;
  roomName?: string;
  roomsCount?: number;
  addons?: { name: string; total: number; quantity?: number }[];
  couponCode?: string;
}) {
  const c = pricing.currency;
  return (
    <div className="breakdown">
      <div className="breakdown-row">
        <span className="copy-sm">
          {roomName ?? 'Room'} {roomsCount > 1 && `× ${roomsCount}`} · {nights} night{nights === 1 ? '' : 's'} × {money(pricing.roomRate, c)}
        </span>
        <span className="label tabular">{money(pricing.roomTotal, c)}</span>
      </div>
      {addons.map((a) => (
        <div className="breakdown-row" key={a.name}>
          <span className="copy-sm dim">{a.name}{a.quantity && a.quantity > 1 ? ` × ${a.quantity}` : ''}</span>
          <span className="label tabular">{money(a.total, c)}</span>
        </div>
      ))}
      {pricing.discount > 0 && (
        <div className="breakdown-row">
          <span className="copy-sm accent-text">Discount {couponCode && `· ${couponCode}`}</span>
          <span className="label tabular accent-text">− {money(pricing.discount, c)}</span>
        </div>
      )}
      <div className="breakdown-row">
        <span className="copy-sm dim">Taxes & fees ({Math.round((pricing.taxRate ?? 0.12) * 100)}% GST)</span>
        <span className="label tabular">{money(pricing.taxes, c)}</span>
      </div>
      <hr className="rule" />
      <div className="breakdown-row total">
        <span className="label">Total</span>
        <span className="heading-sm tabular">{money(pricing.total, c)}</span>
      </div>
    </div>
  );
}
