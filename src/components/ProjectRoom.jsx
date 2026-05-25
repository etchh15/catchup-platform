import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { subscribeToWorkspaceChat } from '../lib/chat';

export default function ProjectRoom({ user, activeRoom: activeRoomProp }) {
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(activeRoomProp ?? null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [specialistProfile, setSpecialistProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const messageEndRef = useRef(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');

  useEffect(() => {
    if (activeRoomProp) setActiveRoom(activeRoomProp);
  }, [activeRoomProp]);

  // 🔌 FETCH THE SPECIALIST'S VERIFIED CONTACT DATA
  useEffect(() => {
    const fetchSpecialistContact = async () => {
      if (!activeRoom?.specialist_id) {
        setSpecialistProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number, email, email_address')
        .eq('id', activeRoom.specialist_id)
        .single();

      if (!error && data) {
        setSpecialistProfile({
          ...data,
          email_address: data.email_address ?? data.email ?? null,
        });
      } else {
        setSpecialistProfile(null);
      }
    };

    fetchSpecialistContact();
  }, [activeRoom]);

  // 1. Fetch all active legal workspace contracts involving the current user session
  useEffect(() => {
    if (!user) return;

    const fetchActiveWorkspaces = async () => {
      try {
        const { data, error } = await supabase
          .from('workspace_rooms')
          .select(`
            id, status, created_at, task_id, client_id, specialist_id,
            tasks(title, budget)
          `);

        if (error) throw error;
        setRooms(data || []);
        if (data && data.length > 0) {
          setActiveRoom(data[0]); // Default to first active room frame
        }
      } catch (err) {
        console.error("Workspace ingestion error:", err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveWorkspaces();
  }, [user]);

  // 2. Stream historical messages and hook real-time listeners to the active room
  useEffect(() => {
    if (!user || !activeRoom) return;

    const roomId = activeRoom.id;
    let cancelled = false;

    const loadChatHistory = async () => {
      const { data } = await supabase
        .from('workspace_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!cancelled) {
        setMessages(data || []);
        scrollToBottom();
      }
    };

    loadChatHistory();

    const workspaceChatChannel = subscribeToWorkspaceChat(roomId, (newRow) => {
      setMessages((prev) => [...prev, newRow]);
      scrollToBottom();
    });

    return () => {
      cancelled = true;
      console.log(`🔌 Scaling protection: Dissolving channel stream room-${roomId}`);
      supabase.removeChannel(workspaceChatChannel);
    };
  }, [user, activeRoom]);

  const scrollToBottom = () => {
    setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // 3. Dispatch text packet over network
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoom || activeRoom.status === 'disputed') return;

    const messagePayload = {
      room_id: activeRoom.id,
      sender_id: user.id,
      message_text: newMessage.trim()
    };

    setNewMessage('');

    const { error } = await supabase
      .from('workspace_messages')
      .insert([messagePayload]);

    if (error) {
      alert("Message failed: " + error.message);
    }
  };

  const handleInitiateDispute = async () => {
    if (!activeRoom || !user) return;
    const reason = prompt(
      '⚠️ State your core reason for filing a dispute claim for administration review:'
    );
    if (!reason?.trim()) return;

    try {
      const { error } = await supabase
        .from('workspace_rooms')
        .update({
          status: 'disputed',
          dispute_initiated_by: user.id,
          dispute_reason: reason.trim(),
        })
        .eq('id', activeRoom.id);

      if (error) throw error;

      const updatedRoom = {
        ...activeRoom,
        status: 'disputed',
        dispute_initiated_by: user.id,
        dispute_reason: reason.trim(),
      };
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((room) => (room.id === activeRoom.id ? updatedRoom : room)));

      alert(
        '⚖️ Dispute case officially opened. Escrow funds locked; an administrator will review this chat stream.'
      );
    } catch (err) {
      alert(`Could not file dispute: ${err.message}`);
    }
  };

  const handleFinalizeProject = async () => {
    if (!activeRoom) return;

    try {
      // 1. Log the verified feedback evaluation into the database
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert([
          {
            room_id: activeRoom.id,
            task_id: activeRoom.task_id,
            client_id: activeRoom.client_id,
            specialist_id: activeRoom.specialist_id,
            rating_score: parseInt(ratingScore),
            feedback_text: feedbackText.trim()
          }
        ]);

      if (reviewError) throw reviewError;

      // 2. Safely cycle the workspace room and the parent task states to completed
      await supabase
        .from('workspace_rooms')
        .update({ status: 'completed' })
        .eq('id', activeRoom.id);

      await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', activeRoom.task_id);

      alert("🎉 Project Completed! Verified review successfully appended to specialist reputation profile.");
      setShowReviewModal(false);
      window.location.reload(); // Refresh local cache arrays cleanly

    } catch (err) {
      alert("Error submitting review: " + err.message);
    }
  };

  // 📄 INSTANT DIGITAL TRANSACTION RECEIPT PRINT SYSTEM
  const handleExportReceipt = (room) => {
    if (!room) return;

    // Create an isolated printing sandbox layout window
    const printWindow = window.open('', '_blank');
    
    const clientName = room.client_id === user.id ? "You" : "Verified Client";
    const specialistAmount = room.tasks?.budget ? Number(room.tasks.budget).toLocaleString() : "0";

    printWindow.document.write(`
      <html>
        <head>
          <title>CatchUp Platform - Transaction Invoice #${room.id.substring(0, 8)}</title>
          <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; background: #ffffff; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; color: var(--gold); }
            .badge { background: #d1fae5; color: #065f46; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
            .meta-block h4 { margin: 0 0 6px 0; color: var(--text-3); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .meta-block p { margin: 0; font-size: 15px; font-weight: 600; color: #0f172a; }
            .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 50px; }
            .invoice-table th { background: var(--text); text-align: left; padding: 14px; font-size: 13px; color: var(--text-3); text-transform: uppercase; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
            .invoice-table td { padding: 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
            .total-row { text-align: right; font-size: 18px; font-weight: 800; color: var(--green); border-top: 2px solid #e2e8f0; padding-top: 16px; }
            .footer { font-size: 11px; color: var(--text-2); text-align: center; margin-top: 100px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">CATCHUP ESCROW SYSTEM</div>
              <span style="font-size: 12px; color: var(--text-3);">Receipt Hash Reference: ${room.id}</span>
            </div>
            <div class="badge">Paid & Settled</div>
          </div>

          <div class="details-grid">
            <div class="meta-block">
              <h4>Client Account</h4>
              <p>${clientName}</p>
            </div>
            <div class="meta-block">
              <h4>Settlement Date</h4>
              <p>${new Date(room.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <table class="invoice-table">
            <thead>
              <tr>
                <th>Assignment Description</th>
                <th style="text-align: right;">Total Transacted Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600; color: #0f172a;">
                  ${room.tasks?.title || "Marketplace Professional Service Assignment"}
                </td>
                <td style="text-align: right; font-weight: 700; color: #0f172a;">
                  ${specialistAmount} EGP
                </td>
              </tr>
            </tbody>
          </table>

          <div class="total-row">
            Total Settled Amount: ${specialistAmount} EGP
          </div>

          <div class="footer">
            This document serves as an official electronic confirmation of finalized contract settlement generated by CatchUp Platform layers. All funds passed multi-stage cryptographic token verification gates before final disbursement.
          </div>

          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return <div style={{ color: 'var(--gold)', padding: '40px', textAlign: 'center' }}>⏳ Loading private workspaces...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', height: 'calc(100vh - 140px)', fontFamily: 'sans-serif' }}>
      
      {/* LEFT SIDEBAR: ACTIVE ESCROW CONTRACT ROOMS LIST */}
      <div className="premium-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '15px', color: 'var(--text-2)', margin: '0 0 12px 0', textTransform: 'uppercase', fontWeight: '700' }}>🛡️ Active Deal Channels</h3>
        {rooms.length === 0 ? (
          <p style={{ color: 'var(--text-3)', fontSize: '13px' }}>No finalized contracts open yet.</p>
        ) : (
          rooms.map(room => (
            <div 
              key={room.id}
              onClick={() => setActiveRoom(room)}
              style={{
                padding: '14px', borderRadius: '8px', cursor: 'pointer',
                background: activeRoom?.id === room.id ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-soft)',
                border: activeRoom?.id === room.id ? '1px solid var(--gold)' : '1px solid #233149',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>{room.tasks?.title || "Marketplace Deal"}</div>
              <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: '600' }}>💰 Budget: {room.tasks?.budget?.toLocaleString()} EGP</div>
              {room.status === 'disputed' && (
                <div style={{ fontSize: '11px', color: '#f87171', fontWeight: '600', marginTop: '6px' }}>⚖️ Under arbitration</div>
              )}
            </div>
          ))
        )}
      </div>

      {/* RIGHT WORKSPACE: LIVE REAL-TIME CHAT INTERFACE AREA */}
      <div className="premium-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        {activeRoom ? (
          <>
            {/* Header Area banner */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #233149', background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text)' }}>{activeRoom.tasks?.title}</h2>
                <span style={{ color: 'var(--text-2)', fontSize: '12px' }}>Workspace Hash: {activeRoom.id}</span>
                {(activeRoom.status === 'active' || activeRoom.status === 'completed') && specialistProfile && (
                  <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px' }}>
                    <span style={{ color: '#a7f3d0', fontWeight: '600' }}>
                      👤 {specialistProfile.full_name || 'Verified Specialist'}
                    </span>
                    {specialistProfile.phone_number && (
                      <span style={{ color: 'var(--gold)' }}>📞 {specialistProfile.phone_number}</span>
                    )}
                    {specialistProfile.email_address && (
                      <span style={{ color: 'var(--gold)' }}>✉️ {specialistProfile.email_address}</span>
                    )}
                  </div>
                )}
              </div>

              {/* UPDATE ACTIONS BLOCK WITHIN THE PROJECT ROOM HEADER BANNER */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {/* Open dispute — client or specialist while room is active */}
                {activeRoom.status === 'active' &&
                  (user.id === activeRoom.client_id || user.id === activeRoom.specialist_id) && (
                    <button
                      type="button"
                      onClick={handleInitiateDispute}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid var(--red)',
                        color: 'var(--red)',
                        padding: '10px 14px',
                        fontSize: '13px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      ⚠️ File Dispute
                    </button>
                  )}

                {/* Condition A: Show Invoice Download only if the deal is completed */}
                {activeRoom.status === 'completed' && (
                  <button 
                    onClick={() => handleExportReceipt(activeRoom)}
                    style={{ 
                      background: 'rgba(56, 189, 248, 0.1)', 
                      border: '1px solid var(--gold)',
                      color: 'var(--gold)',
                      padding: '10px 18px', 
                      fontSize: '13px', 
                      fontWeight: '700',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    📄 Download PDF Invoice
                  </button>
                )}

                {/* Condition B: Show completion controls if the room is active */}
                {user.id === activeRoom.client_id && activeRoom.status === 'active' && (
                  <button 
                    onClick={() => setShowReviewModal(true)}
                    className="btn-primary" 
                    style={{ background: 'var(--green)', padding: '10px 18px', fontSize: '13px', fontWeight: '700' }}
                  >
                    Complete Contract & Review
                  </button>
                )}
              </div>
            </div>

            {/* Disputed workspace arbitration banner */}
            {activeRoom.status === 'disputed' && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--red)',
                  padding: '12px',
                  color: '#fca5a5',
                  fontSize: '13px',
                  borderRadius: '8px',
                  margin: '16px 24px 0',
                  textAlign: 'center',
                  fontWeight: '600',
                }}
                role="alert"
              >
                ⚖️ This workspace channel is under official arbitration. Chat records are preserved for
                administrative case evaluation.
                {activeRoom.dispute_reason && (
                  <span style={{ display: 'block', marginTop: '8px', fontWeight: '500', color: '#fecaca' }}>
                    Reason on file: “{activeRoom.dispute_reason}”
                  </span>
                )}
              </div>
            )}

            {/* 🚨 THE ESCROW MILESTONE TRACKER CANVAS */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              background: 'rgba(30, 41, 59, 0.7)', 
              padding: '16px 24px', 
              borderBottom: '1px solid #233149',
              gap: '12px'
            }}>
              {[
                { step: '1', label: 'Escrow Locked', active: true, done: true },
                { step: '2', label: 'Execution Phase', active: activeRoom.status === 'active', done: activeRoom.status === 'completed' },
                { step: '3', label: 'Client Inspection', active: activeRoom.status === 'active', done: activeRoom.status === 'completed' },
                { step: '4', label: 'Funds Disbursed', active: activeRoom.status === 'completed', done: activeRoom.status === 'completed' }
              ].map((phase, idx, arr) => (
                <React.Fragment key={phase.step}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: phase.done ? 'var(--green)' : phase.active ? 'var(--gold)' : 'var(--surface-2)',
                      color: phase.done || phase.active ? 'var(--bg-soft)' : 'var(--text-3)',
                      border: phase.active ? '2px solid var(--gold)' : '2px solid transparent',
                      transition: 'all 0.3s'
                    }}>
                      {phase.done ? '✓' : phase.step}
                    </div>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: '600', 
                      color: phase.done ? 'var(--text)' : phase.active ? 'var(--gold)' : 'var(--text-3)' 
                    }}>
                      {phase.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ 
                      flex: 1, 
                      height: '2px', 
                      background: phase.done ? 'var(--green)' : 'var(--border)',
                      transition: 'all 0.3s' 
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Conversation text area container */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg)' }}>
              {messages.map((msg, index) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div key={msg.id || index} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '60%', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.4',
                      background: isMe ? 'var(--gold)' : 'var(--surface-2)',
                      color: isMe ? '#ffffff' : '#cbd5e1',
                      border: isMe ? 'none' : '1px solid #334155',
                      borderBottomRightRadius: isMe ? '2px' : '12px',
                      borderBottomLeftRadius: isMe ? '12px' : '2px'
                    }}>
                      {msg.message_text}
                    </div>
                  </div>
                );
              })}
              <div ref={messageEndRef} />
            </div>

            {/* 🛡️ DISINTERMEDIATION GATEWAY INFRASTRUCTURE */}
            <div
              style={{
                padding: '12px 16px',
                margin: '0 24px 16px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: activeRoom.status === 'active' || activeRoom.status === 'completed'
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(234, 179, 8, 0.05)',
                border: activeRoom.status === 'active' || activeRoom.status === 'completed'
                  ? '1px solid rgba(16, 185, 129, 0.2)'
                  : '1px solid rgba(234, 179, 8, 0.2)',
                color: activeRoom.status === 'active' || activeRoom.status === 'completed' ? '#a7f3d0' : '#fef08a',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{activeRoom.status === 'active' || activeRoom.status === 'completed' ? '✅' : '🔒'}</span>
                <span>
                  {activeRoom.status === 'active' || activeRoom.status === 'completed'
                    ? 'Escrow Verified: Direct communication coordinates have been safely revealed in your tracking ledger header panel.'
                    : 'System Protection Active: Sharing phone numbers, emails, or personal digital channels inside this chat before escrow payment verification is automatically restricted.'}
                </span>
              </div>

              {activeRoom.status !== 'active' && activeRoom.status !== 'completed' && (
                <span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', color: '#fde047', fontWeight: '700' }}>
                  Strict Guard
                </span>
              )}
            </div>

            {/* Text input transmission interface bar form */}
            <form onSubmit={handleSendMessage} style={{ padding: '20px', borderTop: '1px solid #233149', display: 'flex', gap: '12px', background: 'rgba(15, 23, 42, 0.4)' }}>
              <input 
                type="text"
                placeholder={
                  activeRoom.status === 'disputed'
                    ? 'Messaging paused — case under administrative review'
                    : 'Type an update or milestone modification instruction...'
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={activeRoom.status === 'disputed'}
                style={{
                  flex: 1,
                  padding: '14px 16px',
                  background: 'var(--bg-soft)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  outline: 'none',
                  opacity: activeRoom.status === 'disputed' ? 0.6 : 1,
                }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ padding: '0 24px' }}
                disabled={activeRoom.status === 'disputed'}
              >
                Send ⚡
              </button>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flex1: 1, justifyContent: 'center', alignItems: 'center', color: 'var(--text-3)', height: '100%' }}>
            Select an active contract from the sidebar panel to begin secure localized sync operations.
          </div>
        )}
      </div>

      {/* 🌟 OVERLAY TRANSACTIONS COMPLETION MODAL */}
      {showReviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '500px', width: '100%', padding: '32px', background: 'var(--bg-soft)', border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text)' }}>Finalize Marketplace Assignment</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-2)', fontSize: '14px' }}>Rate the service quality of the specialist to seal the operational transaction block.</p>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Performance Score Matrix</label>
            <select 
              value={ratingScore} 
              onChange={(e) => setRatingScore(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '20px', outline: 'none' }}
            >
              <option value="5">⭐⭐⭐⭐⭐ Excellent Delivery (5/5)</option>
              <option value="4">⭐⭐⭐⭐ Satisfactory Project (4/5)</option>
              <option value="3">⭐⭐⭐ Average Quality (3/5)</option>
              <option value="2">⭐⭐ Substandard Output (2/2)</option>
              <option value="1">⭐ Critical Breakdown (1/5)</option>
            </select>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Public Feedback Commentary</label>
            <textarea 
              rows="4"
              placeholder="Share performance insights regarding response velocity, technical modification capability, and delivery..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '24px', outline: 'none', resize: 'none', fontFamily: 'sans-serif', fontSize: '14px', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReviewModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>Cancel</button>
              <button onClick={handleFinalizeProject} className="btn-primary" style={{ background: 'var(--green)', padding: '12px 24px' }}>Submit & Lock Deal</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
