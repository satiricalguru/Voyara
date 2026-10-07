import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/Icon';
import { ErrorBox, Img, Lines, Modal, PageLoader, SectionHead } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { AMENITY_LABEL } from '../data/voyara';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { adminService } from '../services/admin';
import { errorMessage } from '../services/api';
import { hotelService } from '../services/hotel';
import type { Room } from '../types';
import { sized } from '../utils/destinations';
import { money } from '../utils/format';

const CATS = ['HOTEL', 'RESORT', 'BOUTIQUE', 'VILLA', 'HOSTEL', 'HERITAGE'];
const blank = {
  name: '', tagline: '', description: '', city: '', country: 'India', address: '', lat: '', lng: '', stars: 4, category: 'HOTEL',
  images: [] as string[], amenities: [] as string[], tags: '', checkInTime: '14:00', checkOutTime: '11:00', featured: false, isActive: true,
  cancellation: 'Free cancellation up to 48 hours before check-in.', phone: '', email: '',
};
type Form = typeof blank;
const blankRoom: Partial<Room> = { name: '', type: 'STANDARD', pricePerNight: 5000, capacity: 2, beds: '1 King bed', size: 28, quantity: 5, description: '', images: [], amenities: [] };

export default function AdminHotelForm() {
  const { id } = useParams();
  const isNew = !id;
  useDocumentTitle(isNew ? 'New hotel' : 'Edit hotel');
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState<Form>(blank);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [room, setRoom] = useState<Partial<Room> | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    hotelService
      .get(id!)
      .then(({ hotel: h }) => {
        setF({
          name: h.name, tagline: h.tagline ?? '', description: h.description, city: h.city, country: h.country, address: h.address ?? '',
          lat: String(h.location?.coordinates[1] ?? ''), lng: String(h.location?.coordinates[0] ?? ''), stars: h.stars, category: h.category,
          images: h.images, amenities: h.amenities, tags: h.tags.join(', '), checkInTime: h.checkInTime ?? '14:00', checkOutTime: h.checkOutTime ?? '11:00',
          featured: !!h.featured, isActive: h.isActive !== false, cancellation: h.policies?.cancellation ?? '', phone: h.contact?.phone ?? '', email: h.contact?.email ?? '',
        });
        return adminService.rooms(h.id);
      })
      .then(setRooms)
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const up = await adminService.upload(Array.from(files));
      set('images', [...f.images, ...up.map((u) => u.url)]);
      toast(`${up.length} image${up.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body: Record<string, unknown> = {
      name: f.name, tagline: f.tagline || undefined, description: f.description, city: f.city, country: f.country, address: f.address || undefined,
      stars: Number(f.stars), category: f.category, images: f.images, amenities: f.amenities,
      tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean), checkInTime: f.checkInTime, checkOutTime: f.checkOutTime,
      featured: f.featured, isActive: f.isActive, policies: { cancellation: f.cancellation }, contact: { phone: f.phone || undefined, email: f.email || undefined },
      ...(f.lat && f.lng ? { lat: Number(f.lat), lng: Number(f.lng) } : {}),
    };
    try {
      if (isNew) {
        const h = await adminService.createHotel(body);
        toast('Hotel created — now add rooms');
        nav(`/admin/hotels/${h.id}`, { replace: true });
      } else {
        await adminService.updateHotel(id!, body);
        toast('Hotel saved');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveRoom = async (e: FormEvent) => {
    e.preventDefault();
    if (!room || !id) return;
    const { id: rid, available: _a, hotel: _h, ...rest } = room as Room;
    void _a; void _h;
    const body = { ...rest, hotel: id, pricePerNight: Number(rest.pricePerNight), capacity: Number(rest.capacity), quantity: Number(rest.quantity), size: Number(rest.size) };
    try {
      if (rid) await adminService.updateRoom(rid, body);
      else await adminService.createRoom(body);
      setRooms(await adminService.rooms(id));
      setRoom(null);
      toast('Room saved');
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  const archiveRoom = async (r: Room) => {
    if (!window.confirm(`Archive ${r.name}?`)) return;
    try {
      await adminService.archiveRoom(r.id);
      setRooms(await adminService.rooms(id!));
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <div className="page wrap"><ErrorBox message={error} /></div>;

  return (
    <div className="page bleed">
      <header className="page-head">
        <div className="crumbs micro"><Link to="/admin?tab=hotels">Admin</Link><span>/</span><span>{isNew ? 'New hotel' : f.name}</span></div>
        <Lines lines={isNew ? ['A new', 'place to stay.'] : [f.name || 'Edit hotel']} />
      </header>
      <form className="split" onSubmit={save}>
        <div className="stack-lg">
          <SectionHead index="01" title="Basics" />
          <div className="form-grid">
            <label className="field"><span className="label">Name</span><input className="input" required value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
            <label className="field"><span className="label">Category</span><select className="select" value={f.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="field"><span className="label">Stars</span><select className="select" value={f.stars} onChange={(e) => set('stars', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((s) => <option key={s}>{s}</option>)}</select></label>
          </div>
          <label className="field"><span className="label">Tagline</span><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></label>
          <label className="field"><span className="label">Description</span><textarea className="textarea" required minLength={10} rows={5} value={f.description} onChange={(e) => set('description', e.target.value)} /></label>

          <SectionHead index="02" title="Location" />
          <div className="form-grid">
            <label className="field"><span className="label">City</span><input className="input" required value={f.city} onChange={(e) => set('city', e.target.value)} /></label>
            <label className="field"><span className="label">Country</span><input className="input" required value={f.country} onChange={(e) => set('country', e.target.value)} /></label>
            <label className="field"><span className="label">Latitude</span><input className="input" type="number" step="any" value={f.lat} onChange={(e) => set('lat', e.target.value)} /></label>
            <label className="field"><span className="label">Longitude</span><input className="input" type="number" step="any" value={f.lng} onChange={(e) => set('lng', e.target.value)} /></label>
          </div>
          <label className="field"><span className="label">Address</span><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></label>

          <SectionHead index="03" title="Photos" right={
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading}><Icon name="upload" size={12} /> {uploading ? 'Uploading…' : 'Upload'}</button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
          } />
          <div className="input-action">
            <input className="input" placeholder="…or paste an image URL" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} />
            <button type="button" className="label" onClick={() => { if (imgUrl.trim()) { set('images', [...f.images, imgUrl.trim()]); setImgUrl(''); } }}>Add</button>
          </div>
          <div className="photo-grid">
            {f.images.map((src, i) => (
              <div key={src + i} className="photo">
                <div className="media ratio-3-2 rounded"><Img src={sized(src, 400)} alt="" /></div>
                <div className="row-between">
                  <span className="micro dim">{i === 0 ? 'Cover' : `#${i + 1}`}</span>
                  <span className="row" style={{ gap: 6 }}>
                    {i > 0 && <button type="button" className="micro link" onClick={() => set('images', [src, ...f.images.filter((_, j) => j !== i)])}>Make cover</button>}
                    <button type="button" className="micro link" onClick={() => set('images', f.images.filter((_, j) => j !== i))}>Remove</button>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <SectionHead index="04" title="Amenities & tags" />
          <div className="chips">
            {Object.entries(AMENITY_LABEL).map(([k, l]) => (
              <button type="button" key={k} className={`chip ${f.amenities.includes(k) ? 'is-active' : ''}`} onClick={() => set('amenities', f.amenities.includes(k) ? f.amenities.filter((a) => a !== k) : [...f.amenities, k])}>{l}</button>
            ))}
          </div>
          <label className="field"><span className="label">Tags (comma separated)</span><input className="input" value={f.tags} onChange={(e) => set('tags', e.target.value)} placeholder="beaches, food, couples" /></label>
        </div>

        <aside className="stack sticky">
          <div className="card stack">
            <span className="label">Operations</span>
            <hr className="rule" />
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="field"><span className="label">Check-in</span><input className="input" value={f.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} /></label>
              <label className="field"><span className="label">Check-out</span><input className="input" value={f.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} /></label>
            </div>
            <label className="field"><span className="label">Cancellation policy</span><input className="input" value={f.cancellation} onChange={(e) => set('cancellation', e.target.value)} /></label>
            <label className="field"><span className="label">Front desk phone</span><input className="input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></label>
            <label className="field"><span className="label">Email</span><input className="input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured on home</label>
            <label className="check"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Live & bookable</label>
            <button className="btn btn-lg" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create hotel' : 'Save changes'}</button>
          </div>
          {!isNew && (
            <div className="card stack">
              <div className="row-between"><span className="label">Rooms</span><button type="button" className="btn-ghost subtle" onClick={() => setRoom({ ...blankRoom })}><Icon name="plus" size={12} /> Add</button></div>
              <hr className="rule" />
              {rooms.length === 0 && <p className="copy-sm dim">No rooms yet — guests can’t book until you add one.</p>}
              {rooms.map((r) => (
                <div key={r.id} className={`row-between ${r.isActive === false ? 'dimmer' : ''}`}>
                  <span className="stack-sm" style={{ gap: 2 }}>
                    <span className="label">{r.name}</span>
                    <span className="micro dim">{r.type} · sleeps {r.capacity} · {r.quantity} units{r.isActive === false ? ' · archived' : ''}</span>
                  </span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="label tabular">{money(r.pricePerNight)}</span>
                    <button type="button" className="btn-icon" onClick={() => setRoom(r)} aria-label={`Edit ${r.name}`}><Icon name="edit" size={12} /></button>
                    {r.isActive !== false && <button type="button" className="btn-icon" onClick={() => archiveRoom(r)} aria-label={`Archive ${r.name}`}><Icon name="trash" size={12} /></button>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </form>

      <Modal open={!!room} onClose={() => setRoom(null)} title={room?.id ? `Edit ${room.name}` : 'New room'}>
        {room && (
          <form className="stack-lg" onSubmit={saveRoom}>
            <div className="form-grid">
              <label className="field"><span className="label">Name</span><input className="input" required value={room.name} onChange={(e) => setRoom({ ...room, name: e.target.value })} /></label>
              <label className="field"><span className="label">Type</span><select className="select" value={room.type} onChange={(e) => setRoom({ ...room, type: e.target.value })}>{['STANDARD', 'DELUXE', 'SUITE', 'FAMILY', 'VILLA', 'DORM'].map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="field"><span className="label">Price / night</span><input className="input" type="number" min={0} required value={room.pricePerNight} onChange={(e) => setRoom({ ...room, pricePerNight: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Sleeps</span><input className="input" type="number" min={1} required value={room.capacity} onChange={(e) => setRoom({ ...room, capacity: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Units</span><input className="input" type="number" min={0} required value={room.quantity} onChange={(e) => setRoom({ ...room, quantity: Number(e.target.value) })} /></label>
              <label className="field"><span className="label">Size m²</span><input className="input" type="number" min={0} value={room.size} onChange={(e) => setRoom({ ...room, size: Number(e.target.value) })} /></label>
            </div>
            <label className="field"><span className="label">Beds</span><input className="input" value={room.beds} onChange={(e) => setRoom({ ...room, beds: e.target.value })} /></label>
            <label className="field"><span className="label">Description</span><input className="input" value={room.description ?? ''} onChange={(e) => setRoom({ ...room, description: e.target.value })} /></label>
            <label className="field"><span className="label">Image URL</span><input className="input" value={room.images?.[0] ?? ''} onChange={(e) => setRoom({ ...room, images: e.target.value ? [e.target.value] : [] })} placeholder={f.images[0] ? 'Leave blank to use the hotel cover' : ''} /></label>
            <label className="check"><input type="checkbox" checked={room.isActive !== false} onChange={(e) => setRoom({ ...room, isActive: e.target.checked })} /> Bookable</label>
            <button className="btn">Save room</button>
          </form>
        )}
      </Modal>
    </div>
  );
}
