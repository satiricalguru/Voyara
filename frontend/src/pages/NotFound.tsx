import { Link } from 'react-router';
import { Globe } from '../components/Globe';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFound() {
  useDocumentTitle('Not found');
  return (
    <div className="void">
      <div className="void-grid bleed">
        <div className="void-left">
          <span className="tag">404 · Off the map</span>
          <h1 className="heading">This page<br />took a detour.</h1>
        </div>
        <div className="void-object"><Globe size={420} /></div>
        <div className="void-right stack">
          <p className="voice">The link may be old, or the trip was made private. Let’s get you somewhere better.</p>
          <div className="row">
            <Link to="/" className="btn">Home</Link>
            <Link to="/architect" className="btn-ghost">Plan a trip →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
