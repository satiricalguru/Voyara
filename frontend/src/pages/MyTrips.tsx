import { Link } from 'react-router';
import { Empty, ErrorBox, Img, Lines, StatusPill } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { errorMessage } from '../services/api';
import { tripService } from '../services/trips';
import { findDestination, sized } from '../utils/destinations';
import { money, plural, range } from '../utils/format';
import { Icon } from '../components/Icon';

export default function MyTrips() {
  useDocumentTitle('My trips');
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => tripService.mine(), []);

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? Bookings stay intact.`)) return;
    try {
      await tripService.remove(id);
      setData((d) => d?.filter((t) => t.id !== id) ?? null);
      toast('Trip deleted');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  return (
    <div className="page bleed">
      <header className="page-head">
        <span className="micro dim">(Account) · Trips</span>
        <div className="row-end">
          <Lines lines={['Your trips,', 'architected.']} />
          <Link to="/architect" className="btn">New trip <span className="arrow">→</span></Link>
        </div>
      </header>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data && <div className="grid-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton ratio-4-5" />)}</div>}
      {data?.length === 0 && <Empty title="No trips yet." body="Describe a trip in one sentence and we’ll architect every day." action={{ to: '/architect', label: 'Start a trip' }} />}
      <div className="grid-3">
        {data?.map((t) => (
          <article key={t.id} className="trip-card">
            <Link to={`/trip/${t.id}`} className="stack">
              <div className="media ratio-4-5 rounded">
                <Img src={sized(t.coverImage ?? findDestination(t.destination.name)?.image, 900)} alt={t.destination.name} />
                <div className="trip-card-over">
                  <span className="mega trip-card-name">{t.destination.name}</span>
                </div>
              </div>
            </Link>
            <div className="row-between">
              <span className="label">{t.title}</span>
              <StatusPill status={t.status} />
            </div>
            <div className="row-between">
              <span className="micro dim">{range(t.startDate, t.endDate)} · {plural(t.days?.length ?? 0, 'day')}</span>
              <span className="micro dim">{money(t.estimate?.total)}</span>
            </div>
            <div className="row">
              {t.isPublic && <span className="micro">● Public</span>}
              <button className="link micro" onClick={() => remove(t.id, t.title)} style={{ marginLeft: 'auto' }}>
                <Icon name="trash" size={12} style={{ display: 'inline', verticalAlign: -2 }} /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
