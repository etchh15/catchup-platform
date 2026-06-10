import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchAbuseEvents,
  fetchAdminAlerts,
  fetchPlatformSettings,
  createSpecialistIdentityDocumentSignedUrl,
  fetchVerificationQueue,
  fetchWaitlistSignups,
  markAdminAlertReviewed,
  updateAbuseEventStatus,
  updatePlatformOnboarding,
  updateProfileAccountStatus,
  updateSpecialistVerification,
  updateWaitlistSignupStatus,
} from '../services/supabaseService';
import { useToast } from './Toast';
import { formatDate, normalizeEgyptMarket } from '../utils/statusHelpers';
import { sendMonitoringTestEvent } from '../monitoring';

const verificationLabels = {
  pending_verification: 'Pending',
  unverified: 'Unverified',
  verified: 'Verified',
  rejected: 'Rejected',
};

export default function AdminBetaOperations() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [verificationQueue, setVerificationQueue] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [adminAlerts, setAdminAlerts] = useState([]);
  const [abuseEvents, setAbuseEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [verificationSearch, setVerificationSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [waitlistSearch, setWaitlistSearch] = useState('');
  const [waitlistRoleFilter, setWaitlistRoleFilter] = useState('all');
  const [waitlistStatusFilter, setWaitlistStatusFilter] = useState('all');

  const onboarding = settings?.onboarding || {};
  const isPaused = Boolean(onboarding.paused);

  const load = async () => {
    setLoading(true);
    try {
      const [settingsData, verificationData, waitlistData, alertsData, abuseData] = await Promise.all([
        fetchPlatformSettings(),
        fetchVerificationQueue(),
        fetchWaitlistSignups(),
        fetchAdminAlerts({ status: 'pending', limit: 20 }),
        fetchAbuseEvents({ status: 'open', limit: 50 }),
      ]);
      setSettings(settingsData);
      setVerificationQueue(verificationData);
      setWaitlist(waitlistData);
      setAdminAlerts(alertsData);
      setAbuseEvents(abuseData);
      setPauseReason(settingsData?.onboarding?.reason || '');
    } catch (err) {
      toast('Could not load beta operations: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const waitlistSummary = useMemo(() => {
    const clients = waitlist.filter((row) => row.requested_role === 'client').length;
    const specialists = waitlist.filter((row) => row.requested_role === 'specialist').length;
    return { clients, specialists };
  }, [waitlist]);

  const filteredVerificationQueue = useMemo(() => {
    const query = verificationSearch.trim().toLowerCase();
    return verificationQueue.filter((profile) => {
      const status = profile.verification_status || 'unverified';
      if (verificationFilter !== 'all' && status !== verificationFilter) return false;
      if (!query) return true;
      return [
        profile.full_name,
        profile.email,
        profile.category,
        profile.professional_title,
        profile.job_title,
        profile.district_tag,
        profile.phone_number,
        status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [verificationFilter, verificationQueue, verificationSearch]);

  const filteredWaitlist = useMemo(() => {
    const query = waitlistSearch.trim().toLowerCase();
    return waitlist.filter((row) => {
      const status = row.status || 'new';
      if (waitlistRoleFilter !== 'all' && row.requested_role !== waitlistRoleFilter) return false;
      if (waitlistStatusFilter !== 'all' && status !== waitlistStatusFilter) return false;
      if (!query) return true;
      return [
        row.full_name,
        row.email,
        row.phone_number,
        row.city_district,
        row.requested_role,
        status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [waitlist, waitlistRoleFilter, waitlistSearch, waitlistStatusFilter]);

  const handlePauseToggle = async () => {
    setBusyId('pause');
    try {
      const next = await updatePlatformOnboarding({
        paused: !isPaused,
        reason: !isPaused ? pauseReason.trim() || 'Operator paused onboarding.' : '',
      });
      setSettings((current) => ({ ...current, onboarding: next }));
      setPauseReason(next.reason || '');
      toast(next.paused ? 'Onboarding paused.' : 'Onboarding reopened.', next.paused ? 'warning' : 'success');
    } catch (err) {
      toast('Could not update onboarding pause: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleVerification = async (profile, status) => {
    setBusyId(`${profile.id}-${status}`);
    try {
      const updated = await updateSpecialistVerification(profile.id, status, `Admin set status to ${status}.`);
      setVerificationQueue((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      toast(`${updated.full_name || 'Specialist'} marked ${verificationLabels[status] || status}.`, 'success');
    } catch (err) {
      toast('Could not update verification: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleViewIdentityDocument = async (profile) => {
    setBusyId(`${profile.id}-identity-document`);
    try {
      const document = await createSpecialistIdentityDocumentSignedUrl(profile.id);
      if (!document.signedUrl) throw new Error('Could not create a private document link.');
      window.open(document.signedUrl, '_blank', 'noopener,noreferrer');
      toast('Private ID document link opened. It expires in 60 seconds.', 'success');
    } catch (err) {
      toast('Could not open ID document: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleWaitlistStatus = async (row, status) => {
    setBusyId(`${row.id}-${status}`);
    try {
      const updated = await updateWaitlistSignupStatus(row.id, status);
      setWaitlist((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast('Waitlist status updated.', 'success');
    } catch (err) {
      toast('Could not update waitlist status: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleAlertReviewed = async (alert) => {
    setBusyId(`alert-${alert.id}`);
    try {
      const updated = await markAdminAlertReviewed(alert.id);
      setAdminAlerts((current) => current.map((item) => (item.id === updated.id ? updated : item)).filter((item) => item.delivery_status === 'pending'));
      toast('Admin alert marked reviewed.', 'success');
    } catch (err) {
      toast('Could not update admin alert: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleAbuseStatus = async (event, status) => {
    setBusyId(`abuse-${event.id}-${status}`);
    try {
      const updated = await updateAbuseEventStatus(event.id, status);
      setAbuseEvents((current) => current.map((item) => (item.id === updated.id ? updated : item)).filter((item) => item.status === 'open'));
      toast(`Abuse event marked ${status}.`, 'success');
    } catch (err) {
      toast('Could not update abuse event: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleAccountStatus = async (profile, status) => {
    const label = profile.full_name || profile.email || 'This account';
    setBusyId(`${profile.id}-account-${status}`);
    try {
      const updated = await updateProfileAccountStatus(
        profile.id,
        status,
        `Operator set ${label} to ${status} from verification queue.`
      );
      setVerificationQueue((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      toast(`${label} marked ${status}.`, status === 'active' ? 'success' : 'warning');
    } catch (err) {
      toast('Could not update account status: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleMonitoringTest = () => {
    const sent = sendMonitoringTestEvent({ area: 'admin_beta_operations' });
    toast(
      sent
        ? 'Monitoring test event sent. Confirm it in Sentry with production release tags.'
        : 'Sentry is not initialized in this environment.',
      sent ? 'success' : 'warning'
    );
  };

  return (
    <section className="admin-beta-ops">
      <div className="dashboard-panel-head">
        <div>
          <span className="dashboard-kicker">Beta operations</span>
          <h2>Onboarding control room</h2>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-beta-grid">
        <article className={`premium-card admin-pause-panel ${isPaused ? 'paused' : ''}`}>
          <span className="dashboard-kicker">Emergency switch</span>
          <h3>{isPaused ? 'Onboarding paused' : 'Onboarding open'}</h3>
          <p>
            New waitlist submissions, account creation, and specialist proposals should stop when incidents or review backlog become risky.
          </p>
          <label>
            Pause reason
            <textarea
              className="premium-input"
              value={pauseReason}
              onChange={(event) => setPauseReason(event.target.value)}
              placeholder="Example: verification backlog, safety review, operator unavailable"
            />
          </label>
          <button type="button" className={`btn ${isPaused ? 'btn-success' : 'btn-danger'}`} onClick={handlePauseToggle} disabled={busyId === 'pause'}>
            {busyId === 'pause' ? 'Updating...' : isPaused ? 'Reopen onboarding' : 'Pause onboarding'}
          </button>
        </article>

        <article className="premium-card">
          <span className="dashboard-kicker">Waitlist</span>
          <h3>{waitlist.length} beta signups</h3>
          <div className="admin-mini-metrics">
            <div><strong>{waitlistSummary.clients}</strong><span>Clients</span></div>
            <div><strong>{waitlistSummary.specialists}</strong><span>Specialists</span></div>
          </div>
        </article>

        <article className="premium-card">
          <span className="dashboard-kicker">Admin email alerts</span>
          <h3>{adminAlerts.length} pending</h3>
          <p className="dashboard-muted">
            Alerts target etchh0@gmail.com and stay here until sent or reviewed.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleMonitoringTest}>
            Test monitoring
          </button>
        </article>

        <article className="premium-card">
          <span className="dashboard-kicker">Abuse events</span>
          <h3>{abuseEvents.length} open</h3>
          <p className="dashboard-muted">
            Review suspicious behavior and suspend accounts without deleting history.
          </p>
        </article>
      </div>

      <section className="premium-card admin-alerts-panel">
        <div className="dashboard-panel-head">
          <span className="dashboard-kicker">Operator alert outbox</span>
          <span className="dashboard-alert-count">{adminAlerts.length}</span>
        </div>
        <div className="admin-table-list">
          {adminAlerts.length === 0 ? (
            <p className="dashboard-muted">No pending admin alerts.</p>
          ) : adminAlerts.map((alert) => (
            <article key={alert.id} className={`admin-list-row alert-${alert.severity}`}>
              <div>
                <strong>{alert.subject}</strong>
                <span>{alert.event_type} · {alert.severity} · {formatDate(alert.created_at)}</span>
                <em>{alert.body}</em>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busyId)} onClick={() => handleAlertReviewed(alert)}>
                  Reviewed
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="premium-card admin-alerts-panel">
        <div className="dashboard-panel-head">
          <span className="dashboard-kicker">Abuse review queue</span>
          <span className="dashboard-alert-count">{abuseEvents.length}</span>
        </div>
        <div className="admin-table-list">
          {abuseEvents.length === 0 ? (
            <p className="dashboard-muted">No open abuse events.</p>
          ) : abuseEvents.map((event) => (
            <article key={event.id} className={`admin-list-row alert-${event.severity}`}>
              <div>
                <strong>{event.event_type}</strong>
                <span>{event.severity} · {event.target_type || 'platform'} · {formatDate(event.created_at)}</span>
                <em>{event.notes || `Actor: ${event.actor_id || 'unknown'}`}</em>
              </div>
              <div className="admin-row-actions">
                <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busyId)} onClick={() => handleAbuseStatus(event, 'reviewing')}>
                  Reviewing
                </button>
                <button type="button" className="btn btn-success btn-sm" disabled={Boolean(busyId)} onClick={() => handleAbuseStatus(event, 'resolved')}>
                  Resolve
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-beta-columns">
        <section className="premium-card">
          <div className="dashboard-panel-head">
            <span className="dashboard-kicker">Verification queue</span>
            <span className="dashboard-alert-count">{filteredVerificationQueue.length}/{verificationQueue.length}</span>
          </div>
          <div className="admin-filter-bar" aria-label="Verification filters">
            <input
              className="premium-input"
              value={verificationSearch}
              onChange={(event) => setVerificationSearch(event.target.value)}
              placeholder="Search name, category, phone, area..."
            />
            <select
              className="premium-input"
              value={verificationFilter}
              onChange={(event) => setVerificationFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="pending_verification">Pending</option>
              <option value="unverified">Unverified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="admin-table-list">
            {filteredVerificationQueue.length === 0 ? (
              <p className="dashboard-muted">{verificationQueue.length === 0 ? 'No specialists waiting for review.' : 'No specialists match these filters.'}</p>
            ) : filteredVerificationQueue.map((profile) => (
              <article key={profile.id} className="admin-list-row">
                <div>
                  <strong>{profile.full_name || profile.email || 'Unnamed specialist'}</strong>
                  <span>{profile.category || profile.professional_title || 'No category'} · {normalizeEgyptMarket(profile.district_tag)}</span>
                  <em>{verificationLabels[profile.verification_status] || profile.verification_status || 'Unverified'} · {profile.account_status || 'active'}</em>
                  <em>
                    ID: {profile.identity_document
                      ? `${profile.identity_document.review_status || 'pending_review'} · ${profile.identity_document.mime_type || 'file'} · ${formatDate(profile.identity_document.uploaded_at)}`
                      : 'missing document'}
                  </em>
                </div>
                <div className="admin-row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={Boolean(busyId) || !profile.identity_document}
                    onClick={() => handleViewIdentityDocument(profile)}
                  >
                    View ID
                  </button>
                  <button type="button" className="btn btn-success btn-sm" disabled={Boolean(busyId)} onClick={() => handleVerification(profile, 'verified')}>
                    Verify
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(busyId)} onClick={() => handleVerification(profile, 'rejected')}>
                    Reject
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busyId)} onClick={() => handleAccountStatus(profile, 'restricted')}>
                    Restrict
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" disabled={Boolean(busyId)} onClick={() => handleAccountStatus(profile, 'suspended')}>
                    Suspend
                  </button>
                  {profile.account_status && profile.account_status !== 'active' && (
                    <button type="button" className="btn btn-success btn-sm" disabled={Boolean(busyId)} onClick={() => handleAccountStatus(profile, 'active')}>
                      Restore
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="premium-card">
          <div className="dashboard-panel-head">
            <span className="dashboard-kicker">Recent waitlist</span>
            <span className="dashboard-alert-count">{filteredWaitlist.length}/{waitlist.length}</span>
          </div>
          <div className="admin-filter-bar" aria-label="Waitlist filters">
            <input
              className="premium-input"
              value={waitlistSearch}
              onChange={(event) => setWaitlistSearch(event.target.value)}
              placeholder="Search name, email, phone, area..."
            />
            <select
              className="premium-input"
              value={waitlistRoleFilter}
              onChange={(event) => setWaitlistRoleFilter(event.target.value)}
            >
              <option value="all">All roles</option>
              <option value="client">Clients</option>
              <option value="specialist">Specialists</option>
            </select>
            <select
              className="premium-input"
              value={waitlistStatusFilter}
              onChange={(event) => setWaitlistStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="invited">Invited</option>
            </select>
          </div>
          <div className="admin-table-list">
            {filteredWaitlist.length === 0 ? (
              <p className="dashboard-muted">{waitlist.length === 0 ? 'No beta signups yet.' : 'No waitlist rows match these filters.'}</p>
            ) : filteredWaitlist.slice(0, 25).map((row) => (
              <article key={row.id} className="admin-list-row">
                <div>
                  <strong>{row.full_name}</strong>
                  <span>{row.email} · {row.requested_role} · {row.city_district || 'No area'}</span>
                  <em>{row.status || 'new'} · {formatDate(row.created_at)}</em>
                </div>
                <div className="admin-row-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busyId)} onClick={() => handleWaitlistStatus(row, 'contacted')}>
                    Contacted
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(busyId)} onClick={() => handleWaitlistStatus(row, 'invited')}>
                    Invited
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
