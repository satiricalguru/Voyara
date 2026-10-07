import { useParams } from 'react-router';
import { ErrorBox, PageLoader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { tripService } from '../services/trips';
import { TripView } from './LiveItinerary';

export default function SharedTrip() {
  const { token = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => tripService.shared(token), [token]);
  useDocumentTitle(data?.title);
  if (loading && !data) return <PageLoader label="Opening shared trip" />;
  if (error || !data) return <div className="page wrap"><ErrorBox message={error ?? 'This shared link is no longer active'} onRetry={reload} /></div>;
  const by = typeof data.user === 'object' ? data.user : null;
  return (
    <>
      {by && (
        <div className="shared-banner bleed">
          <span className="micro">Shared by {by.name}{by.homeCity ? ` · ${by.homeCity}` : ''}</span>
          <span className="micro dim">Read-only view</span>
        </div>
      )}
      <TripView trip={data} isOwner={false} documents={[]} readOnly />
    </>
  );
}
