import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { fetchUserProfile, updateUserProfile, updateUserRole, uploadProfilePhoto } from '../services/supabaseService';
import SpecialistReputationCard from './SpecialistReputationCard';
import ClientReputationBadge from './ClientReputationBadge';
import { useSpecialistReputation, useClientReputation } from '../hooks/useSpecialistReputation';
import NotificationPreferences from './NotificationPreferences';
import CatchUpServiceFlow from './CatchUpServiceFlow';
import { useLanguage } from '../i18n/LanguageContext';
import SpecialistAvatar from './SpecialistAvatar';
import { normalizeEgyptMarket } from '../utils/statusHelpers';

const numericRate = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ProfileHub({ user, role, syncPlatformEngineData, onProfileUpdated }) {
  const toast = useToast();
  const { t } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attachedFileName, setAttachedFileName] = useState(null);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [offeringSaving, setOfferingSaving] = useState(false);
  const [offeringDraft, setOfferingDraft] = useState({
    fulfillment_types: ['IN_PERSON'],
    online_hourly_rate: '',
    in_person_hourly_rate: '',
    latitude: '',
    longitude: '',
    service_radius_km: 25,
    metadata: '{}',
  });

  useEffect(() => {
    if (!user) return;

    fetchUserProfile(user.id)
      .then(setProfile)
      .catch(err => {
        console.error('Profile load error:', err);
        toast('Failed to load profile', 'error');
      })
      .finally(() => setLoading(false));
  }, [user, toast]);

  useEffect(() => {
    if (!profile) return;
    setOfferingDraft({
      fulfillment_types: Array.isArray(profile.fulfillment_types) && profile.fulfillment_types.length
        ? profile.fulfillment_types
        : ['IN_PERSON'],
      online_hourly_rate: profile.online_hourly_rate ?? profile.pricing?.online_hourly_rate ?? '',
      in_person_hourly_rate: profile.in_person_hourly_rate ?? profile.pricing?.in_person_hourly_rate ?? (numericRate(profile.hourly_rate) || ''),
      latitude: profile.latitude ?? '',
      longitude: profile.longitude ?? '',
      service_radius_km: profile.service_radius_km ?? 25,
      metadata: JSON.stringify(profile.metadata || {}, null, 2),
    });
  }, [profile]);

  const { reputation: specialistReputation, loading: specialistRepLoading } = useSpecialistReputation(profile?.id);
  const { reputation: clientReputation } = useClientReputation(profile?.id);
  const completedJobs = Number(specialistReputation?.total_completed_jobs || 0);
  const totalReviews = Number(specialistReputation?.total_reviews || 0);
  const averageRating = Number(specialistReputation?.average_rating || 0);
  const responseHours = Number(specialistReputation?.response_time_hours || profile?.avg_response_hours || 0);
  const skills = [
    ...(Array.isArray(specialistReputation?.service_categories) ? specialistReputation.service_categories : []),
    profile?.category,
    profile?.professional_title || profile?.job_title,
  ].filter(Boolean).slice(0, 5);
  const serviceAreas = [
    ...(Array.isArray(specialistReputation?.service_areas) ? specialistReputation.service_areas : []),
    profile?.district_tag,
  ].filter(Boolean).slice(0, 5);
  const displayRate = numericRate(profile?.in_person_hourly_rate || profile?.online_hourly_rate || profile?.hourly_rate);

  const handleRoleChange = async (newRole) => {
    if (!user) return;

    setLoading(true);
    try {
      await updateUserRole(user.id, newRole);
      setProfile(prev =>
        prev ? { ...prev, role: newRole } : null
      );
      toast(`Switched to ${newRole} mode`, 'success');
      if (syncPlatformEngineData) await syncPlatformEngineData();
      const refreshedProfile = await onProfileUpdated?.();
      if (refreshedProfile) setProfile(refreshedProfile);
    } catch (err) {
      toast('Failed to change role: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user?.id) return;

    setPhotoUploading(true);
    try {
      const updatedProfile = await uploadProfilePhoto(user.id, file);
      setProfile(updatedProfile);
      toast(t('profilePhotoUpdated', 'Profile photo updated.'), 'success');
      if (syncPlatformEngineData) await syncPlatformEngineData();
      const refreshedProfile = await onProfileUpdated?.();
      if (refreshedProfile) setProfile(refreshedProfile);
    } catch (err) {
      toast(`${t('profilePhotoUpdateFailed', 'Could not update profile photo:')} ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setPhotoUploading(false);
    }
  };

  const toggleFulfillmentType = (type) => {
    setOfferingDraft(prev => {
      const current = new Set(prev.fulfillment_types || []);
      if (current.has(type) && current.size > 1) current.delete(type);
      else current.add(type);
      return { ...prev, fulfillment_types: Array.from(current) };
    });
  };

  const handleOfferingSave = async () => {
    if (!user?.id) return;

    let parsedMetadata = {};
    try {
      parsedMetadata = offeringDraft.metadata?.trim() ? JSON.parse(offeringDraft.metadata) : {};
    } catch {
      toast('Specialist metadata must be valid JSON.', 'error');
      return;
    }

    setOfferingSaving(true);
    try {
      const onlineRate = offeringDraft.online_hourly_rate === '' ? null : Number(offeringDraft.online_hourly_rate);
      const inPersonRate = offeringDraft.in_person_hourly_rate === '' ? null : Number(offeringDraft.in_person_hourly_rate);
      const updates = {
        fulfillment_types: offeringDraft.fulfillment_types,
        online_hourly_rate: onlineRate,
        in_person_hourly_rate: inPersonRate,
        hourly_rate: inPersonRate ?? onlineRate ?? profile.hourly_rate ?? null,
        latitude: offeringDraft.latitude === '' ? null : Number(offeringDraft.latitude),
        longitude: offeringDraft.longitude === '' ? null : Number(offeringDraft.longitude),
        service_radius_km: Number(offeringDraft.service_radius_km || 0),
        metadata: parsedMetadata,
        pricing: {
          online_hourly_rate: onlineRate,
          in_person_hourly_rate: inPersonRate,
        },
      };

      const updatedProfile = await updateUserProfile(user.id, updates);
      setProfile(updatedProfile);
      toast('Specialist offering updated.', 'success');
      if (syncPlatformEngineData) await syncPlatformEngineData();
      await onProfileUpdated?.();
    } catch (err) {
      toast('Could not update specialist offering: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setOfferingSaving(false);
    }
  };

  const handleVerificationRequest = async (file) => {
    if (!file || !user?.id) return;
    setAttachedFileName(file.name);
    setVerificationBusy(true);

    try {
      const updatedProfile = await updateUserProfile(user.id, {
        verification_status: 'pending_verification',
        verification_note: `Document prepared: ${file.name}`,
        verification_requested_at: new Date().toISOString(),
      });
      setProfile(updatedProfile);
      toast('Verification request marked for admin review.', 'success');
      await onProfileUpdated?.();
    } catch (err) {
      toast('Could not request verification: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setVerificationBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--gold)', padding: '40px', textAlign: 'center' }}>
        ⏳ Loading profile...
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ color: 'var(--text-3)', padding: '40px', textAlign: 'center' }}>
        Unable to load profile
      </div>
    );
  }

  return (
    <div className="profile-storefront">
      <section className="profile-hero-card">
        <div className="profile-photo-editor">
          <SpecialistAvatar
            name={profile?.full_name || user?.email}
            avatarUrl={profile?.avatar_url}
            size={88}
            className="profile-photo-avatar"
          />
          <label className="profile-photo-action">
            {photoUploading
              ? t('uploading', 'Uploading...')
              : profile?.avatar_url
              ? t('changePhoto', 'Change photo')
              : t('uploadPhoto', 'Upload photo')}
            <input
              type="file"
              accept="image/*"
              disabled={photoUploading}
              onChange={handleProfilePhotoChange}
            />
          </label>
        </div>
        <div className="profile-hero-copy">
          <span className="dashboard-kicker">{role === 'specialist' ? t('profileSpecialist', 'Specialist storefront') : t('profileClient', 'Client reputation')}</span>
          <h2>{profile?.full_name || 'User'}</h2>
          <p>{profile?.bio || (role === 'specialist' ? 'Build buyer confidence with a verified, measurable service profile.' : 'A clear hiring reputation helps specialists respond with confidence.')}</p>
          <div className="profile-chip-row">
            <span>{role === 'admin' ? 'Platform admin' : role}</span>
            <span>{profile?.is_verified || profile?.verification_status === 'verified' ? 'Verified account' : profile?.verification_status || 'unverified'}</span>
            <span>{normalizeEgyptMarket(profile?.district_tag)}</span>
          </div>
          <CatchUpServiceFlow role={role} context="profile" activeIndex={role === 'specialist' ? 5 : 1} />
        </div>
      </section>

      {profile?.role === 'specialist' && (
        <>
          <section className="profile-metrics-grid">
            <div><span>Rating</span><strong>{averageRating ? averageRating.toFixed(1) : 'New'}</strong></div>
            <div><span>Reviews</span><strong>{totalReviews}</strong></div>
            <div><span>Completed jobs</span><strong>{completedJobs}</strong></div>
            <div><span>Response</span><strong>{responseHours ? `${Math.round(responseHours)}h` : 'Fast replies'}</strong></div>
          </section>
          <section className="profile-panel">
            <div className="dashboard-panel-head">
              <span className="dashboard-kicker">{t('marketplaceProof', 'Marketplace proof')}</span>
              <span className="dashboard-alert-count">{displayRate ? `${displayRate.toLocaleString()} EGP/hr` : 'Quote based'}</span>
            </div>
            <SpecialistReputationCard
              reputation={specialistReputation}
              loading={specialistRepLoading}
              compact={false}
              showDetails={true}
            />
            <div className="profile-two-column">
              <div>
                <h3>Skills</h3>
                <div className="profile-chip-row">
                  {(skills.length ? skills : ['Professional services']).map((skill) => <span key={skill}>{skill}</span>)}
                </div>
              </div>
              <div>
                <h3>Service areas</h3>
                <div className="profile-chip-row">
                  {(serviceAreas.length ? serviceAreas : ['Egypt']).map((area) => <span key={area}>{area}</span>)}
                </div>
              </div>
            </div>
          </section>

          <section className="profile-panel">
            <div className="dashboard-panel-head">
              <span className="dashboard-kicker">Specialist offering setup</span>
              <span className="dashboard-alert-count">Appointment ready</span>
            </div>
            <div className="profile-two-column">
              <div>
                <h3>Fulfillment</h3>
                <div className="profile-chip-row">
                  {['IN_PERSON', 'ONLINE'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`btn ${offeringDraft.fulfillment_types.includes(type) ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => toggleFulfillmentType(type)}
                    >
                      {type === 'ONLINE' ? 'Online sessions' : 'In-person visits'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3>Service radius</h3>
                <input
                  type="number"
                  className="premium-input"
                  value={offeringDraft.service_radius_km}
                  min="0"
                  max="500"
                  onChange={(event) => setOfferingDraft(prev => ({ ...prev, service_radius_km: event.target.value }))}
                />
              </div>
            </div>
            <div className="profile-two-column">
              <label>
                <span className="dashboard-kicker">Online hourly rate</span>
                <input
                  type="number"
                  className="premium-input"
                  value={offeringDraft.online_hourly_rate}
                  onChange={(event) => setOfferingDraft(prev => ({ ...prev, online_hourly_rate: event.target.value }))}
                />
              </label>
              <label>
                <span className="dashboard-kicker">In-person hourly rate</span>
                <input
                  type="number"
                  className="premium-input"
                  value={offeringDraft.in_person_hourly_rate}
                  onChange={(event) => setOfferingDraft(prev => ({ ...prev, in_person_hourly_rate: event.target.value }))}
                />
              </label>
            </div>
            <div className="profile-two-column">
              <label>
                <span className="dashboard-kicker">Base latitude</span>
                <input
                  type="number"
                  step="any"
                  className="premium-input"
                  value={offeringDraft.latitude}
                  onChange={(event) => setOfferingDraft(prev => ({ ...prev, latitude: event.target.value }))}
                />
              </label>
              <label>
                <span className="dashboard-kicker">Base longitude</span>
                <input
                  type="number"
                  step="any"
                  className="premium-input"
                  value={offeringDraft.longitude}
                  onChange={(event) => setOfferingDraft(prev => ({ ...prev, longitude: event.target.value }))}
                />
              </label>
            </div>
            <label style={{ display: 'grid', gap: 8 }}>
              <span className="dashboard-kicker">Skills, certifications, tools JSON</span>
              <textarea
                className="premium-input"
                style={{ minHeight: 120, resize: 'vertical' }}
                value={offeringDraft.metadata}
                onChange={(event) => setOfferingDraft(prev => ({ ...prev, metadata: event.target.value }))}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" type="button" disabled={offeringSaving} onClick={handleOfferingSave}>
                {offeringSaving ? 'Saving...' : 'Save offering'}
              </button>
            </div>
          </section>
        </>
      )}

      {profile?.role === 'client' && (
        <section className="profile-panel">
          <ClientReputationBadge reputation={clientReputation} compact={false} />
        </section>
      )}

      <section className="profile-panel">
        <div className="dashboard-panel-head">
          <span className="dashboard-kicker">{t('notifications', 'Notifications')}</span>
        </div>
        <NotificationPreferences userId={user?.id} />
      </section>

      <section className="profile-panel">
        <div className="dashboard-panel-head">
          <span className="dashboard-kicker">{t('accountDetails', 'Account details')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>
              Full Name
            </label>
            <input
              type="text"
              className="premium-input"
              value={profile?.full_name || ''}
              readOnly
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '6px', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              className="premium-input"
              value={profile?.email || user?.email || ''}
              readOnly
            />
          </div>
        </div>

        <h3 style={{ marginBottom: 16 }}>{t('accountType', 'Account type')}</h3>
        <div className="profile-role-grid">
          <div
            onClick={() => !loading && handleRoleChange('client')}
            className={`profile-role-card ${role === 'client' ? 'active' : ''}`}
          >
            <div className="profile-role-icon">C</div>
            <div>{t('wantToHire', 'I want to hire')}</div>
            <p>
              {t('wantToHireCopy', 'Post jobs and find specialists')}
            </p>
          </div>
          <div
            onClick={() => !loading && handleRoleChange('specialist')}
            className={`profile-role-card ${role === 'specialist' ? 'active specialist' : ''}`}
          >
            <div className="profile-role-icon">S</div>
            <div>{t('wantToWork', 'I want to work')}</div>
            <p>
              {t('wantToWorkCopy', 'Bid on jobs and grow your business')}
            </p>
          </div>
        </div>

        <div className="profile-verification-panel">
          <h4>
            {t('verificationStatus', 'Verification status')}
          </h4>
          <p>
            {profile?.is_verified
              ? t('verifiedAccountCopy', 'Your account is verified')
              : profile?.verification_status === 'pending_verification'
              ? 'Your request is waiting for admin review.'
              : t('verificationPendingCopy', 'Verification helps build trust with other users on the platform')}
          </p>
          {!profile?.is_verified && profile?.verification_status !== 'pending_verification' && (
            <label
              className="btn btn-secondary"
              style={{ display: 'inline-block', textAlign: 'center', cursor: 'pointer' }}
            >
              {verificationBusy ? 'Submitting...' : t('uploadDocument', 'Upload Document')}
              <input
                type="file"
                accept="image/*"
                disabled={verificationBusy}
                style={{ display: 'none' }}
                onChange={e => handleVerificationRequest(e.target.files?.[0])}
              />
            </label>
          )}
          {attachedFileName && (
            <div className="profile-upload-ready">
              <strong>{attachedFileName}</strong> {t('preparedForUpload', 'prepared for upload')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
