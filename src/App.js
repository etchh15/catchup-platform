import React, { useState } from 'react';
import './App.css';

import { ToastProvider, useToast } from './components/Toast';
import AuthGateway       from './components/AuthGateway';
import IdentitySelection from './components/IdentitySelection';
import Navigation        from './components/Navigation';
import Marketplace       from './components/Marketplace';
import ProjectRoom       from './components/ProjectRoom';
import AnalyticsLedger   from './components/AnalyticsLedger';
import SystemTelemetry   from './components/SystemTelemetry';
import ProfileHub        from './components/ProfileHub';

import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useMarketplaceData } from './hooks/useMarketplaceData';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';

function CatchUpApp() {
  const toast = useToast();

  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, role, loading: roleLoading, setupRole, switchRole } = useProfile(user);
  const [activeTab, setActiveTab] = useState('marketplace');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [activeRoom, setActiveRoom] = useState(null);

  const { tasks, bids, specialists, loading: dataLoading, syncData, unreadBids } = useMarketplaceData(districtFilter);

  // Setup realtime subscriptions
  useRealtimeSubscriptions(syncData, syncData);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading CatchUp…</span>
      </div>
    );
  }

  if (!user)     return <AuthGateway onAuthSuccess={() => {}} />;
  if (!role) return <IdentitySelection onSelectComplete={setupRole} isLoading={roleLoading} />;

  return (
    <div className="app-shell">
      <Navigation
        user={user}
        role={role}
        setRole={switchRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={unreadBids}
        onSignOut={signOut}
      />

      <div className="page-content">
        {activeTab === 'marketplace' && (
          <Marketplace
            user={user}
            role={role}
            tasks={tasks}
            bids={bids}
            specialists={specialists}
            districtFilter={districtFilter}
            setDistrictFilter={setDistrictFilter}
            syncPlatformEngineData={syncData}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'messages'    && <ProjectRoom user={user} activeRoom={activeRoom} />}
        {activeTab === 'analytics'   && <AnalyticsLedger tasks={tasks} bids={bids} user={user} role={role} />}
        {activeTab === 'telemetry'   && <SystemTelemetry />}
        {activeTab === 'profile'     && <ProfileHub user={user} role={role} syncPlatformEngineData={syncData} />}
      </div>

      <footer className="site-footer">
        ⚡ CatchUp · Menoufia's local services platform · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function App() {
  return <ToastProvider><CatchUpApp /></ToastProvider>;
}
