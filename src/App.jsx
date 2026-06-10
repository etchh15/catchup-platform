import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import './App.css';
import { useNotifications } from './hooks/useNotifications';

import { ToastProvider } from './components/Toast';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import AuthGateway       from './components/AuthGateway';
import IdentitySelection from './components/IdentitySelection';
import Navigation        from './components/Navigation';
import PublicLanding     from './components/PublicLanding';
import BetaPolicyPage    from './components/BetaPolicyPage';
import LaunchChecklistPage from './components/LaunchChecklistPage';

import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useMarketplaceData } from './hooks/useMarketplaceData';
import { useRealtimeSubscriptions } from './hooks/useRealtimeSubscriptions';
import { fetchWorkspaceRoom, fetchWorkspaceRoomByTask } from './services/supabaseService';

const Marketplace = lazy(() => import('./components/Marketplace'));
const ProjectRoom = lazy(() => import('./components/ProjectRoom'));
const AnalyticsLedger = lazy(() => import('./components/AnalyticsLedger'));
const SystemTelemetry = lazy(() => import('./components/SystemTelemetry'));
const ProfileHub = lazy(() => import('./components/ProfileHub'));
const DashboardHome = lazy(() => import('./components/DashboardHome'));
const HelpDesk = lazy(() => import('./components/HelpDesk'));

const tabRoutes = {
  dashboard: '/',
  marketplace: '/browse',
  messages: '/workspace',
  analytics: '/insights',
  telemetry: '/system',
  profile: '/profile',
  help: '/help',
};

function routeToTab(pathname = '/') {
  if (pathname.startsWith('/workspace')) return 'messages';
  if (pathname.startsWith('/browse')) return 'marketplace';
  if (pathname.startsWith('/insights')) return 'analytics';
  if (pathname.startsWith('/system')) return 'telemetry';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/help')) return 'help';
  return 'dashboard';
}

function isUnreadWorkspaceNotification(notification) {
  if (!notification || notification.is_read || notification.read_at) return false;
  return String(notification.action_url || '').startsWith('/workspace/');
}

function scrollToHashTarget(hash) {
  if (!hash) return false;
  const element = document.querySelector(hash);
  if (!element) return false;
  const offset = 112;
  const top = window.scrollY + element.getBoundingClientRect().top - offset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  return true;
}

function PageLoading() {
  return (
    <div className="loading-screen" style={{ minHeight: 320 }}>
      <div className="spinner" />
      <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading workspace...</span>
    </div>
  );
}

function CatchUpApp() {
  const { direction } = useLanguage();
  const { user, loading: authLoading, signOut } = useAuth();
  const { profile, role, loading: roleLoading, setupRole, switchRole, refreshProfile } = useProfile(user);
  const [activeTab, setActiveTab] = useState(() => routeToTab(window.location.pathname || '/'));
  const [districtFilter, setDistrictFilter] = useState('all');
  const [activeRoom, setActiveRoom] = useState(null);

  const {
    tasks,
    bids,
    specialists,
    loading: marketplaceLoading,
    error: marketplaceError,
    syncData,
  } = useMarketplaceData(districtFilter, user, role);
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    clearAll,
  } = useNotifications(user?.id);
  const workspaceUnreadCount = useMemo(
    () => notifications.filter(isUnreadWorkspaceNotification).length,
    [notifications]
  );

  const openWorkspaceRoomByIdOrTaskId = async (identifier) => {
    if (!identifier) return null;

    let room = null;
    try {
      room = await fetchWorkspaceRoom(identifier);
    } catch (err) {
      console.debug('Workspace lookup by room id failed:', err?.message || err);
    }

    if (!room) {
      try {
        room = await fetchWorkspaceRoomByTask(identifier);
      } catch (err) {
        console.debug('Workspace lookup by task id failed:', err?.message || err);
      }
    }

    if (room) {
      setActiveRoom(room);
      setActiveTab('messages');
      const nextPath = `/workspace/${room.id}`;
      if (window.location.pathname !== nextPath) {
        window.history.pushState({}, '', nextPath);
      }
    }

    return room;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification?.action_url) return;
    // Mark as read and navigate into workspace when possible
    try {
      if (notification?.id) await markAsRead(notification.id);
    } catch (err) {
      console.warn('Could not mark notification as read:', err);
    }

    if (notification.action_url.startsWith('/workspace/')) {
      const id = notification.action_url.replace('/workspace/', '');
      const room = await openWorkspaceRoomByIdOrTaskId(id);
      if (room) return;
    }

    if (notification.action_url.startsWith('/')) {
      window.history.pushState({}, '', notification.action_url);
      setActiveTab(routeToTab(notification.action_url));
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(routeToTab(window.location.pathname || '/'));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!user) return;

    const path = window.location.pathname || '';
    if (path.startsWith('/workspace/')) {
      const id = path.replace('/workspace/', '');
      openWorkspaceRoomByIdOrTaskId(id);
    }
  }, [user]);

  useEffect(() => {
    if (!role || role === 'admin') return;
    if (activeTab === 'analytics' || activeTab === 'telemetry') {
      setActiveTab('dashboard');
      if (window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
      }
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (!window.location.hash) return;
    const target = window.location.hash;
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      scrollToHashTarget(target);
      if (attempts >= 20) {
        window.clearInterval(interval);
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  // Setup realtime subscriptions
  useRealtimeSubscriptions(syncData, syncData);

  const navigateToTab = (tab, hash = '') => {
    if ((tab === 'analytics' || tab === 'telemetry') && role !== 'admin') {
      tab = 'dashboard';
    }
    setActiveTab(tab);
    const nextPath = `${tabRoutes[tab] || '/'}${hash || ''}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    if (hash) {
      window.requestAnimationFrame(() => {
        scrollToHashTarget(hash);
      });
    }
  };

  const navigatePublic = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setActiveTab(routeToTab(path));
  };

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading CatchUp…</span>
      </div>
    );
  }

  if (!user && window.location.pathname === '/beta-policy') {
    return (
      <BetaPolicyPage
        onBackHome={() => navigatePublic('/')}
        onOpenAuth={() => navigatePublic('/auth')}
      />
    );
  }

  if (!user && window.location.pathname === '/launch-checklist') {
    return (
      <LaunchChecklistPage
        onBackHome={() => navigatePublic('/')}
        onOpenAuth={() => navigatePublic('/auth')}
      />
    );
  }

  if (!user && window.location.pathname !== '/auth') {
    return (
      <PublicLanding
        onOpenAuth={() => {
          window.history.pushState({}, '', '/auth');
          setActiveTab('dashboard');
        }}
      />
    );
  }
  if (!user)     return <AuthGateway onAuthSuccess={() => {}} />;
  if (!role) return <IdentitySelection onSelectComplete={setupRole} isLoading={roleLoading} />;

  return (
    <div className="app-shell" dir={direction}>
      <Navigation
        user={user}
        profile={profile}
        role={role}
        setRole={switchRole}
        activeTab={activeTab}
        setActiveTab={navigateToTab}
        unreadCount={unreadCount}
        workspaceUnreadCount={workspaceUnreadCount}
        notificationLoading={notificationsLoading}
        notifications={notifications}
        onNotificationClick={handleNotificationClick}
        onMarkAsRead={markAsRead}
        onMarkAllAsRead={markAllAsRead}
        onClearAll={clearAll}
        onSignOut={signOut}
      />

      <div className="page-content">
        <Suspense fallback={<PageLoading />}>
          {activeTab === 'dashboard' && (
            <DashboardHome
              user={user}
              profile={profile}
              role={role}
              tasks={tasks}
              bids={bids}
              specialists={specialists}
              notifications={notifications}
              unreadCount={workspaceUnreadCount}
              setActiveTab={navigateToTab}
            />
          )}
          {activeTab === 'marketplace' && (
            <Marketplace
              user={user}
              profile={profile}
              role={role}
              tasks={tasks}
              bids={bids}
              specialists={specialists}
              loading={marketplaceLoading}
              error={marketplaceError}
              districtFilter={districtFilter}
              setDistrictFilter={setDistrictFilter}
              syncPlatformEngineData={syncData}
              setActiveTab={navigateToTab}
              setActiveRoom={setActiveRoom}
            />
          )}
          {activeTab === 'messages' && <ProjectRoom user={user} activeRoom={activeRoom} />}
          {activeTab === 'analytics' && role === 'admin' && <AnalyticsLedger tasks={tasks} bids={bids} user={user} role={role} />}
          {activeTab === 'telemetry' && role === 'admin' && <SystemTelemetry tasks={tasks} bids={bids} specialists={specialists} setActiveTab={navigateToTab} />}
          {activeTab === 'profile' && (
            <ProfileHub
              user={user}
              role={role}
              syncPlatformEngineData={syncData}
              onProfileUpdated={refreshProfile}
            />
          )}
          {activeTab === 'help' && <HelpDesk user={user} role={role} />}
        </Suspense>
      </div>

      <footer className="site-footer">
        ⚡ CatchUp · Egypt service marketplace · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider><CatchUpApp /></ToastProvider>
    </LanguageProvider>
  );
}
