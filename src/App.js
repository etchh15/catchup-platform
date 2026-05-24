import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';

// ── Components ────────────────────────────────────────────────────────────────
import AuthGateway        from './components/AuthGateway';
import IdentitySelection  from './components/IdentitySelection';
import Navigation         from './components/Navigation';
import Marketplace        from './components/Marketplace';
import ProjectRoom        from './components/ProjectRoom';
import AnalyticsLedger    from './components/AnalyticsLedger';
import SystemTelemetry    from './components/SystemTelemetry';
import ProfileHub         from './components/ProfileHub';
import { ToastProvider, useToast } from './components/Toast';

// ── Inner app (needs toast context) ──────────────────────────────────────────
function CatchUpApp() {
  const toast = useToast();

  // ── Auth & identity ──────────────────────────────────────────────────────
  const [user,       setUser]       = useState(null);
  const [userRole,   setUserRole]   = useState(null);  // 'client' | 'specialist'
  const [appLoading, setAppLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  // ── Data ─────────────────────────────────────────────────────────────────
  const [tasks,       setTasks]       = useState([]);
  const [allBids,     setAllBids]     = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [specialistStats, setSpecialistStats] = useState({});

  // ── Navigation ───────────────────────────────────────────────────────────
  const [activeTab,      setActiveTab]      = useState('marketplace');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [activeRoom,     setActiveRoom]     = useState(null);

  // Track realtime channel refs so we can clean them up
  const realtimeChannels = useRef([]);

  // ── Data sync ─────────────────────────────────────────────────────────────
  const syncPlatformEngineData = useCallback(async () => {
    try {
      const [
        { data: taskData },
        { data: specData },
        { data: bidData, error: bidErr },
      ] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'specialist'),
        supabase
          .from('bids')
          .select('*, profiles!specialist_id(full_name, category, professional_title)')
          .order('created_at', { ascending: false }),
      ]);

      if (taskData) setTasks(taskData);
      if (specData) {
        setSpecialists(specData);
        // Build a quick stats map keyed by specialist id
        const statsMap = {};
        specData.forEach(s => {
          statsMap[s.id] = { rating: s.average_rating ?? 5.0, count: s.review_count ?? 0 };
        });
        setSpecialistStats(statsMap);
      }
      if (!bidErr && bidData) {
        setAllBids(bidData);
      } else {
        // Fallback: fetch bids without join
        const { data: plainBids } = await supabase
          .from('bids').select('*').order('created_at', { ascending: false });
        if (plainBids) setAllBids(plainBids);
      }
    } catch (err) {
      console.error('Data sync error:', err.message);
    }
  }, []);

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  const setupRealtimeSubscriptions = useCallback(() => {
    // Clean up old channels first
    realtimeChannels.current.forEach(ch => supabase.removeChannel(ch));
    realtimeChannels.current = [];

    const tasksChannel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        syncPlatformEngineData();
      })
      .subscribe();

    const bidsChannel = supabase
      .channel('bids-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, () => {
        syncPlatformEngineData();
      })
      .subscribe();

    realtimeChannels.current = [tasksChannel, bidsChannel];
  }, [syncPlatformEngineData]);

  // ── Profile fetch ──────────────────────────────────────────────────────────
  const fetchProfileMetadata = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles').select('role').eq('id', userId).maybeSingle();
      if (!error && data?.role) {
        setUserRole(data.role);
        return;
      }
      // Fallback checks for legacy table structure
      const { data: clientRow } = await supabase
        .from('clients').select('id').eq('id', userId).maybeSingle();
      if (clientRow) { setUserRole('client'); return; }

      const { data: specRow } = await supabase
        .from('specialists').select('id').eq('id', userId).maybeSingle();
      if (specRow) setUserRole('specialist');
    } catch {
      // Profile not set up yet — show IdentitySelection
    } finally {
      setAppLoading(false);
      syncPlatformEngineData();
      setupRealtimeSubscriptions();
    }
  }, [syncPlatformEngineData, setupRealtimeSubscriptions]);

  // ── Auth state ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfileMetadata(session.user.id);
      } else {
        setAppLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfileMetadata(session.user.id);
      } else {
        setUser(null);
        setUserRole(null);
        setAppLoading(false);
        // Clean up realtime on logout
        realtimeChannels.current.forEach(ch => supabase.removeChannel(ch));
        realtimeChannels.current = [];
      }
    });

    return () => {
      subscription.unsubscribe();
      realtimeChannels.current.forEach(ch => supabase.removeChannel(ch));
    };
  }, [fetchProfileMetadata]);

  // ── Identity setup ─────────────────────────────────────────────────────────
  const handleRoleConfig = async (chosenRole) => {
    setRoleLoading(true);
    try {
      const name = user.email?.split('@')[0] || 'User';
      if (chosenRole === 'client') {
        await supabase.from('clients').upsert([{ id: user.id, full_name: name, city_district: 'Tala' }]);
      } else {
        await supabase.from('specialists').upsert([
          { id: user.id, business_name: name, profession_category: 'General Specialist', is_verified: false },
        ]);
      }
      const { error } = await supabase.from('profiles').upsert({
        id: user.id, role: chosenRole, email: user.email, full_name: name,
      });
      if (error) throw error;
      setUserRole(chosenRole);
      syncPlatformEngineData();
      setupRealtimeSubscriptions();
    } catch (err) {
      toast('Profile setup failed: ' + err.message, 'error');
    } finally {
      setRoleLoading(false);
    }
  };

  // ── Role switching (persists to DB) ────────────────────────────────────────
  const handleRoleSwitch = async (newRole) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles').update({ role: newRole }).eq('id', user.id);
      if (error) throw error;
      setUserRole(newRole);
      toast(`Switched to ${newRole} mode`, 'success');
      syncPlatformEngineData();
    } catch (err) {
      toast('Could not switch role: ' + err.message, 'error');
    }
  };

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // ── Unread count (rooms awaiting client action) ────────────────────────────
  const unreadCount = allBids.filter(
    b => b.status === 'pending' && tasks.some(t => t.id === b.task_id && t.user_id === user?.id)
  ).length;

  // ── Open workspace room after accepting a bid ──────────────────────────────
  const handleOpenRoom = useCallback((room) => {
    setActiveRoom(room);
    setActiveTab('messages');
  }, []);

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (appLoading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0b0f19', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #1e293b',
          borderTop: '3px solid #38bdf8', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#64748b', fontSize: '14px' }}>Loading CatchUp...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!user) {
    return <AuthGateway onAuthSuccess={(u) => setUser(u)} />;
  }

  // ── Role selection ─────────────────────────────────────────────────────────
  if (!userRole) {
    return <IdentitySelection onSelectComplete={handleRoleConfig} isLoading={roleLoading} />;
  }

  // ── Main app ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <Navigation
        user={user}
        role={userRole}
        setRole={handleRoleSwitch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={unreadCount}
        onSignOut={handleSignOut}
      />

      <main className="main-content">
        {activeTab === 'marketplace' && (
          <Marketplace
            user={user}
            role={userRole}
            tasks={tasks}
            bids={allBids}
            specialistStats={specialistStats}
            realSpecialists={specialists}
            districtFilter={districtFilter}
            setDistrictFilter={setDistrictFilter}
            syncPlatformEngineData={syncPlatformEngineData}
            setActiveTab={setActiveTab}
            onOpenRoom={handleOpenRoom}
          />
        )}

        {activeTab === 'messages' && (
          <ProjectRoom
            user={user}
            activeRoom={activeRoom}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsLedger
            tasks={tasks}
            bids={allBids}
            user={user}
            role={userRole}
          />
        )}

        {activeTab === 'telemetry' && (
          <SystemTelemetry />
        )}

        {activeTab === 'profile' && (
          <ProfileHub
            user={user}
            role={userRole}
            syncPlatformEngineData={syncPlatformEngineData}
          />
        )}
      </main>

      <footer className="site-footer">
        ⚡ CatchUp — Connecting Menoufia's local professionals &nbsp;·&nbsp; All rights reserved {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// ── Root export (wraps with ToastProvider) ─────────────────────────────────
export default function App() {
  return (
    <ToastProvider>
      <CatchUpApp />
    </ToastProvider>
  );
}
