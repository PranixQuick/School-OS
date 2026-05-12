// components/teacher/LeaveForm.tsx
// Item #1 Track C Phase 3 — Leave request submission form.

'use client';

import { useState } from 'react';

const LEAVE_TYPES = [
  { value: 'casual', label: 'Casual leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'earned', label: 'Earned leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
  { value: 'other', label: 'Other' },
] as const;

interface LeaveFormProps {
  onSubmitted?: () => void;
}

export default function LeaveForm({ onSubmitted }: LeaveFormProps) {
  const [leaveType, setLeaveType] = useState<string>('casual');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSuccess(false);

    if (!fromDate || !toDate) {
      setError('Please choose both from and to dates.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Reason must be at least 3 characters.');
      return;
    }
    if (new Date(fromDate) > new Date(toDate)) {
      setError('From date must be on or before to date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher/leave', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: leaveType,
          from_date: fromDate,
          to_date: toDate,
          reason: reason.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSuccess(true);
      setReason('');
      setFromDate('');
      setToDate('');
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Request leave</h3>

      <div>
        <label htmlFor="leave-type" className="block text-xs text-gray-600">Leave type</label>
        <select
          id="leave-type"
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          {LEAVE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="from-date" className="block text-xs text-gray-600">From</label>
          <input
            id="from-date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="to-date" className="block text-xs text-gray-600">To</label>
          <input
            id="to-date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-xs text-gray-600">Reason</label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Brief reason for leave"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <p className="mt-1 text-xs text-gray-400">{reason.length}/500</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
      >
        {submitting ? 'Submitting...' : 'Submit request'}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-green-700">Leave request submitted.</p>}
    </div>
  );
}
