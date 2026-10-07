import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { PROMPT_IDEAS } from '../data/voyara';
import { Icon } from './Icon';

const BUILD = [
  ['Geocoding destination', 'Nominatim'],
  ['Reading 7-day forecast', 'Open-Meteo'],
  ['Mapping 140 places nearby', 'OpenStreetMap'],
  ['Clustering days by neighbourhood', 'Architect'],
  ['Pairing rain-proof backups', 'Architect'],
  ['Matching stays & rentals', 'Voyara'],
];

/** Small "video thumbnail" card for the hero: types a prompt, then ticks through the build. */
export function LiveDemo({ compact = false }: { compact?: boolean }) {
  const [promptIdx, setPromptIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [step, setStep] = useState(-1);

  useEffect(() => {
    const full = PROMPT_IDEAS[promptIdx];
    let i = 0;
    let s = -1;
    setTyped('');
    setStep(-1);
    const type = setInterval(() => {
      i++;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(type);
        const build = setInterval(() => {
          s++;
          setStep(s);
          if (s >= BUILD.length) {
            clearInterval(build);
            setTimeout(() => setPromptIdx((p) => (p + 1) % PROMPT_IDEAS.length), 1600);
          }
        }, 420);
        cleanup.push(() => clearInterval(build));
      }
    }, 34);
    const cleanup = [() => clearInterval(type)];
    return () => cleanup.forEach((c) => c());
  }, [promptIdx]);

  return (
    <Link to={`/architect?prompt=${encodeURIComponent(PROMPT_IDEAS[promptIdx])}`} className={`demo card-glass ${compact ? 'is-compact' : ''}`} aria-label="Try this prompt in the architect">
      <div className="row-between">
        <span className="micro">Live architect</span>
        <span className="demo-play">
          <Icon name="play" size={10} filled />
        </span>
      </div>
      <p className="demo-prompt copy-sm">
        “{typed}
        <span className="demo-caret" />”
      </p>
      <hr className="rule rule-cream" />
      <ol className="demo-steps">
        {BUILD.map(([t, src], i) => (
          <li key={t} className={`micro ${i <= step ? 'is-done' : ''}`}>
            <span>{i <= step ? '✓' : '·'} {t}</span>
            <span className="dimmer">{src}</span>
          </li>
        ))}
      </ol>
    </Link>
  );
}
