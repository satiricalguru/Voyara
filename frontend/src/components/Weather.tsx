import type { DayWeather } from '../types';
import { Icon, weatherIcon } from './Icon';

export function WeatherChip({ w, showSource = false }: { w?: DayWeather | null; showSource?: boolean }) {
  if (!w) return <span className="micro dimmer">No forecast</span>;
  return (
    <span className={`weather-chip ${w.wet ? 'is-wet' : ''}`} title={`${w.summary} · ${w.precipProb}% rain · ${w.source}`}>
      <Icon name={weatherIcon(w.code, w.wet)} size={15} />
      <span className="label tabular">{w.tMax}° / {w.tMin}°</span>
      <span className="micro dim">{w.precipProb}% rain</span>
      {showSource && <span className="micro dimmer">· {w.source === 'open-meteo-archive' ? 'typical' : w.source}</span>}
    </span>
  );
}
