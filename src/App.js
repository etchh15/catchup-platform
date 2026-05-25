import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

import { ToastProvider, useToast } from './components/Toast';
import AuthGateway       from './components/AuthGateway';
import IdentitySelection from './components/IdentitySelection';
import Navigation        from './components/Navigation';
import Marketplace       from './components/Marketplace';
import ProjectRoom       from './components/ProjectRoom';
import AnalyticsLedger   from './components/AnalyticsLedger';
import SystemTelemetry   from './components/SystemTelemetry';
import ProfileHub        from './components/ProfileHub';

function CatchUpApp() {
  const toast = useToast();

  const [user,        setUser]        = useState(null);
  const [userRole,    setUserRole]    = useState(null);
  const [appLoading,  setAppLoading]  = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  const [tasks,       setTasks]       = useState([]);
  const [allBids,     setAllBids]     = useState([]);
  const [specialists, setSpecialists] = useState([]);
  const [specStats,   setSpecStats]   = useState({});

  const [activeTab,      setActiveTab]      = useState('marketplace');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [activeRoom,     setActiveRoom]     = useState(null);

  const channels = useRef([]);

  const syncData = useCallback(async () => {
    try {
      const [{ data: taskData }, { data: specData }, { data: bidData, error: bidErr }] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'specialist'),
        supabase.from('bids').select('*, profiles!specialist_id(full_name, category, professional_title)').order('created_at', { ascending: false }),
      ]);
      if (taskData) setTasks(taskData);
      if (specData) {
        setSpecialists(specData);
        const map = {};
        specData.forEach(s => { map[s.id] = { rating: s.average_rating ?? 5.0, count: s.review_count ?? 0 }; });
        setSpecStats(map);
      }
      if (!bidErr && bidData) {
        setAllBids(bidData);
      } else {
        const { data: plain } = await supabase.from('bids').select('*').order('created_at', { ascending: false });
        if (plain) setAllBids(plain);
      }
    } catch (err) {
      console.error('Sync error:', err.message);
    }
  }, []);

  const setupRealtime = useCallback(() => {
    channels.current.forEach(ch => supabase.removeChannel(ch));
    const ch1 = supabase.channel('rt-tasks').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, syncData).subscribe();
    const ch2 = supabase.channel('rt-bids').on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, syncData).subscribe();
    channels.current = [ch1, ch2];
  }, [syncData]);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (data?.role) { setUserRole(data.role); return; }
      const { data: c } = await supabase.from('clients').select('id').eq('id', userId).maybeSingle();
      if (c) { setUserRole('client'); return; }
      const { data: s } = await supabase.from('specialists').select('id').eq('id', userId).maybeSingle();
      if (s) setUserRole('specialist');
    } catch { /* profile not yet created */ } finally {
      setAppLoading(false);
      syncData();
      setupRealtime();
    }
  }, [syncData, setupRealtime]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      else setAppLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) { setUser(session.user); fetchProfile(session.user.id); }
      else { setUser(null); setUserRole(null); setAppLoading(false); channels.current.forEach(ch => supabase.removeChannel(ch)); }
    });
    return () => { subscription.unsubscribe(); channels.current.forEach(ch => supabase.removeChannel(ch)); };
  }, [fetchProfile]);

  const handleRoleConfig = async (chosen) => {
    setRoleLoading(true);
    try {
      const name = user.email?.split('@')[0] || 'User';
      if (chosen === 'client') {
        await supabase.from('clients').upsert([{ id: user.id, full_name: name, city_district: 'Tala' }]);
      } else {
        await supabase.from('specialists').upsert([{ id: user.id, business_name: name, profession_category: 'General', is_verified: false }]);
      }
      const { error } = await supabase.from('profiles').upsert({ id: user.id, role: chosen, email: user.email, full_name: name });
      if (error) throw error;
      setUserRole(chosen);
      syncData();
      setupRealtime();
    } catch (err) {
      toast('Setup failed: ' + err.message, 'error');
    } finally {
      setRoleLoading(false);
    }
  };

  const handleRoleSwitch = async (newRole) => {
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', user.id);
      setUserRole(newRole);
      toast(`Switched to ${newRole} mode`, 'success');
      syncData();
    } catch (err) {
      toast('Could not switch role: ' + err.message, 'error');
    }
  };

  const unread = allBids.filter(b => b.status === 'pending' && tasks.some(t => t.id === b.task_id && t.user_id === user?.id)).length;

  if (appLoading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>Loading CatchUp…</span>
      </div>
    );
  }

  if (!user)     return <AuthGateway onAuthSuccess={u => setUser(u)} />;
  if (!userRole) return <IdentitySelection onSelectComplete={handleRoleConfig} isLoading={roleLoading} />;

  return (
    <div className="app-shell">
      <Navigation
        user={user}
        role={userRole}
        setRole={handleRoleSwitch}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={unread}
        onSignOut={() => supabase.auth.signOut()}
      />

      <div className="page-content">
        {activeTab === 'marketplace' && (
          <Marketplace
            user={user} role={userRole}
            tasks={tasks} bids={allBids}
            specialistStats={specStats} realSpecialists={specialists}
            districtFilter={districtFilter} setDistrictFilter={setDistrictFilter}
            syncPlatformEngineData={syncData} setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'messages'    && <ProjectRoom user={user} activeRoom={activeRoom} />}
        {activeTab === 'analytics'   && <AnalyticsLedger tasks={tasks} bids={allBids} user={user} role={userRole} />}
        {activeTab === 'telemetry'   && <SystemTelemetry />}
        {activeTab === 'profile'     && <ProfileHub user={user} role={userRole} syncPlatformEngineData={syncData} />}
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
