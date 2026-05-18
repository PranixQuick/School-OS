'use client';

import { useState, useEffect } from 'react';

interface CheckIn {
  id: string; checked_in_at: string; lat: number | null; lng: number | null; note: string | null;
}

export default function CheckInPage() {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [msg, setMsg] = useState('');
  const [success, setSuccess] = useState('');
  const [todayPunched, setTodayPunched] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetch('/api/teacher/check-in')
      .then(r => r.ok ? r.json() : { checkins: [] })
      .then(d => {
        const list = d.checkins ?? [];
        setCheckins(list);
        setTodayPunched(list.some((c: CheckIn) => c.checked_in_at.startsWith(todayStr)));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [todayStr]);

  const handleCheckIn = () => {
    setPunching(true); setMsg(''); setSuccess('');
    if (!navigator.geolocation) {
      doPunch(null, null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => doPunch(pos.coords.latitude, pos.coords.longitude),
      () => doPunch(null, null),
      { timeout: 8000 }
    );
  };

  const doPunch = async (lat: number | null, lng: number | null) => {
    const res = await fetch('/api/teacher/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess('Checked in successfully! ✅');
      setTodayPunched(true);
      setCheckins(prev => [data.checkin, ...prev]);
    } else {
      setMsg(data.error ?? 'Check-in failed.');
    }
    setPunching(false);
  };

  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ padding: 16 }}>
      <style>{`
        .ci-title { font-size: 18px; font-weight: 800; color: #111827; margin-bottom: 4px; }
        .ci-sub { font-size: 13px; color: #6B7280; margin-bottom: 20px; }
        .ci-punch {
          background: #4F46E5; color: #fff; border: none; border-radius: 16px;
          padding: 18px; width: 100%; font-size: 16px; font-weight: 700; cursor: pointer;
          margin-bottom: 16px; box-shadow: 0 4px 14px rgba(79,70,229,0.3);
        }
        .ci-punch:disabled { background: #9CA3AF; box-shadow: none; }
        .ci-punch.done { background: #16A34A; box-shadow: 0 4px 14px rgba(22,163,74,0.25); }
        .ci-success { background: #F0FDF4; border-radius: 12px; padding: 14px; font-size: 14px; font-weight: 600; color: #16A34A; text-align: center; margin-bottom: 16px; }
        .ci-err { background: #FEF2F2; border-radius: 10px; padding: 12px; font-size: 13px; color: #B91C1C; margin-bottom: 12px; }
        .ci-history-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        .ci-item { background: #fff; border-radius: 12px; border: 1px solid #E5E7EB; padding: 12px 14px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .ci-item-time { font-size: 14px; font-weight: 600; color: #111827; }
        .ci-item-loc { font-size: 11px; color: #9CA3AF; margin-top: 2px; }
        .ci-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; background: #F0FDF4; color: #16A34A; }
        .ci-empty { text-align: center; padding: 40px 20px; color: #9CA3AF; font-size: 13px; }
        .skel { background: #F3F4F6; border-radius: 8px; animation: pulse 1.5s ease-in-out infinite; margin-bottom: 8px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
      `}</style>

      <div className="ci-title">Check In</div>
      <div className="ci-sub">Record your attendance for today.</div>

      {msg && <div className="ci-err">{msg}</div>}
      {success && <div className="ci-success">{success}</div>}

      <button
        className={`ci-punch${todayPunched ? ' done' : ''}`}
        onClick={handleCheckIn}
        disabled={punching || todayPunched}
      >
        {punching ? '📍 Getting location…' : todayPunched ? '✅ Checked In Today' : '📍 Check In Now'}
      </button>

      {todayPunched && !success && (
        <div className="ci-success">You&apos;re checked in for today.</div>
      )}

      <div className="ci-history-title">Recent History</div>

      {loading ? (
        <><div className="skel" style={{ height: 56 }} /><div className="skel" style={{ height: 56 }} /></>
      ) : checkins.length === 0 ? (
        <div className="ci-empty">No check-ins recorded yet.</div>
      ) : checkins.slice(0, 10).map((c, i) => (
        <div key={c.id} className="ci-item">
          <div>
            <div className="ci-item-time">{fmt(c.checked_in_at)}</div>
            <div className="ci-item-loc">{c.lat && c.lng ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : 'Location not recorded'}</div>
          </div>
          {i === 0 && checkins[0].checked_in_at.startsWith(todayStr) && (
            <span className="ci-badge">Today</span>
          )}
        </div>
      ))}
    </div>
  );
}
