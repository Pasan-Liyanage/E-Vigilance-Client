import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { STATUS_FILTERS } from '../constants';
import { Skeleton, EmptyState } from '../components/ui';
import ReportCard from '../components/ReportCard';
import { Search, Plus, Alert, Refresh, X } from '../components/Icons';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState('All');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const firstLoad = useRef(true);

  // Debounce the search box so we do not hit the API on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 320);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const { reports: list } = await api.listReports({ status, search: debounced, limit: 100 });
      setReports(list || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [status, debounced]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => reports.length, [reports]);
  const filtering = status !== 'All' || debounced !== '';

  return (
    <div className="container stack gap-20">
      <div className="between gap-12">
        <div>
          <h1>My reports</h1>
          <p className="muted small mt-4">
            {loading ? 'Loading…' : `${counts} report${counts === 1 ? '' : 's'}${filtering ? ' matching your filters' : ''}`}
          </p>
        </div>
        <Link to="/report" className="btn btn-primary hide-mobile">
          <Plus size={18} /> New report
        </Link>
      </div>

      <div className="stack gap-12">
        <div className="input-group">
          <span className="lead"><Search size={18} /></span>
          <input
            className="input"
            placeholder="Search by plate, issue, location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search reports"
          />
          {search && (
            <button className="trail" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-bar" role="tablist" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              className={`chip ${status === s ? 'active' : ''}`}
              onClick={() => setStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="stack gap-10">
          {[0, 1, 2, 3].map((i) => (
            <div className="card card-pad row gap-14" key={i}>
              <Skeleton h={76} w={76} r="var(--r-md)" />
              <div className="grow stack gap-8">
                <Skeleton h={15} w="60%" />
                <Skeleton h={12} w="42%" />
                <Skeleton h={12} w="28%" />
              </div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="card card-pad">
          <EmptyState
            icon={Alert}
            title="Could not load your reports"
            message="Check your connection and try again."
            action={<button className="btn btn-outline" onClick={load}><Refresh size={17} /> Retry</button>}
          />
        </div>
      ) : reports.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            icon={filtering ? Search : undefined}
            title={filtering ? 'Nothing matches those filters' : 'No reports yet'}
            message={
              filtering
                ? 'Try a different search term or clear the status filter.'
                : 'When you report a violation it will appear here so you can follow its progress.'
            }
            action={
              filtering ? (
                <button className="btn btn-outline" onClick={() => { setSearch(''); setStatus('All'); }}>
                  Clear filters
                </button>
              ) : (
                <Link to="/report" className="btn btn-primary"><Plus size={18} /> File your first report</Link>
              )
            }
          />
        </div>
      ) : (
        <div className="stack gap-10">
          {reports.map((r) => <ReportCard key={r._id} report={r} />)}
        </div>
      )}
    </div>
  );
}
