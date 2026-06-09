import React, { useState, useEffect, useRef, useOptimistic, useCallback, useMemo, startTransition } from 'react';
import { supabase } from '../supabaseClient';
import { subscribeToWorkspaceChat } from '../lib/chat';
import ContactCard from './ContactCard';
import AgreementCard from './AgreementCard';
import DeliveryButton from './DeliveryButton';
import CompletionConfirmationModal from './CompletionConfirmationModal';
import MilestoneChecklist from './MilestoneChecklist';
import { useContactVisibility, useWorkspaceContact } from '../hooks/useContactVisibility';
import { useAgreement } from '../hooks/useAgreement';
import { useCompletion } from '../hooks/useCompletion';
import { useMilestones } from '../hooks/useMilestones';
import { useAppointmentScheduling } from '../hooks/useAppointmentScheduling';
import { useReceiptGeneration } from '../hooks/useReceiptGeneration';
import {
  fetchWorkspaceRoomsForUser,
  fetchTaskById,
  fetchWorkspaceChatMessages,
  resolveWorkspaceChatRoomId,
  sendWorkspaceMessage,
  submitReview,
  uploadDisputeEvidence,
  updateWorkspaceRoomStatus,
  createCompletionReceipt,
  fetchCompletionReceipt,
  fetchWorkspaceReview,
  fetchSpecialistRatings,
  rateClient,
} from '../services/supabaseService';
import { useDispute } from '../hooks/useDispute';
import DisputeForm from './DisputeForm';
import DisputeThread from './DisputeThread';
import ReceiptPDF from './ReceiptPDF';
import ScheduleAppointment from './ScheduleAppointment';
import SmartNextAction from './SmartNextAction';
import TrustTimeline from './TrustTimeline';
import JobJourneyStepper from './JobJourneyStepper';
import { useToast } from './Toast';
import CatchUpServiceFlow from './CatchUpServiceFlow';
import { useLanguage } from '../i18n/LanguageContext';
import PaymentBetaNotice from './PaymentBetaNotice';

const sameId = (left, right) => {
  if (left == null || right == null) return false;
  return String(left) === String(right);
};

const formatRoomBudget = (budget, t = (_key, fallback) => fallback) => {
  const amount = Number(budget || 0);
  return amount > 0 ? `${amount.toLocaleString()} EGP` : t('budgetPending', 'Budget pending');
};

const roomStatusLabel = (status = 'active', t = (_key, fallback) => fallback) => {
  if (status === 'completed') return t('completed', 'Completed');
  if (status === 'disputed') return t('disputed', 'Case open');
  if (status === 'active') return t('active', 'Active');
  return status;
};

const roomParticipantProfile = (room, viewerId) => {
  if (!room?.tasks) return null;
  return sameId(room.client_id, viewerId)
    ? room.tasks.assigned_specialist || null
    : room.tasks.client || null;
};

const roomParticipantFallback = (room, viewerId, t = (_key, fallback) => fallback) =>
  sameId(room?.client_id, viewerId) ? t('specialist', 'Specialist') : t('client', 'Client');

const roomParticipantName = (room, viewerId, t = (_key, fallback) => fallback) =>
  roomParticipantProfile(room, viewerId)?.full_name || roomParticipantFallback(room, viewerId, t);

export default function ProjectRoom({ user, activeRoom: activeRoomProp }) {
  const toast = useToast();
  const { t } = useLanguage();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(activeRoomProp ?? null);
  const [messages, setMessages] = useState([]);
  const [chatRoomId, setChatRoomId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [taskDetails, setTaskDetails] = useState(null);
  const [review, setReview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const messageEndRef = useRef(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [isEditingAgreement, setIsEditingAgreement] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeBusy, setDisputeBusy] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [clientRating, setClientRating] = useState(null);
  const [showClientReviewModal, setShowClientReviewModal] = useState(false);
  const [clientRatingScore, setClientRatingScore] = useState(5);
  const [clientRatingComment, setClientRatingComment] = useState('');
  const [clientRatingSubmitting, setClientRatingSubmitting] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');

  // Optimistic state for messages: shows message in chat immediately, sends in background
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, message) => [
      ...state,
      {
        id: `temp-${Date.now()}`,
        sender_id: user?.id,
        message_text: message.text,
        created_at: new Date().toISOString(),
        isPending: true,
      }
    ]
  );

  const [sendingMessage, setSendingMessage] = useState(false);

  const {
    dispute,
    responses,
    loading: disputeLoading,
    fetchDispute,
    fileDispute,
    respondToDispute,
  } = useDispute(activeRoom?.task_id, user?.id);

  const {
    completion,
    loading: completionLoading,
    markDelivered,
    confirmCompleted,
  } = useCompletion(activeRoom?.task_id, user?.id);

  const { generateAndDownloadPDF } = useReceiptGeneration();

  useEffect(() => {
    if (activeRoomProp) setActiveRoom(activeRoomProp);
  }, [activeRoomProp]);

  useEffect(() => {
    if (!activeRoom?.task_id) {
      setTaskDetails(null);
      setReview(null);
      setReceipt(null);
      return;
    }

    const loadTaskData = async () => {
      try {
        const task = await fetchTaskById(activeRoom.task_id);
        setTaskDetails(task);
      } catch (err) {
        console.error('Failed to load task for receipt:', err);
      }
    };

    const loadReviewData = async () => {
      try {
        const fetchedReview = await fetchWorkspaceReview({
          roomId: activeRoom.id,
          taskId: activeRoom.task_id,
          clientId: activeRoom.client_id,
          specialistId: activeRoom.specialist_id,
        });
        setReview(fetchedReview);
      } catch (err) {
        console.error('Failed to load review for receipt:', err);
      }
    };

    const loadReceiptData = async () => {
      try {
        const fetchedReceipt = await fetchCompletionReceipt(activeRoom.task_id);
        setReceipt(fetchedReceipt);
      } catch (err) {
        console.warn('Failed to load completion receipt:', err);
      }
    };

    loadTaskData();
    loadReviewData();
    loadReceiptData();
  }, [activeRoom?.task_id]);

  useEffect(() => {
    if (!activeRoom?.id || !user) {
      setChatRoomId(null);
      return;
    }

    let cancelled = false;
    resolveWorkspaceChatRoomId(activeRoom.id, activeRoom.task_id)
      .then((resolvedId) => {
        if (!cancelled) setChatRoomId(resolvedId);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to resolve chat room id:', err);
          setChatRoomId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom?.id, activeRoom?.task_id, user]);

  const userId = user?.id;
  const isClient = sameId(activeRoom?.client_id, userId);
  const isSpecialist = sameId(activeRoom?.specialist_id, userId);
  const otherParticipantId = isClient
    ? activeRoom?.specialist_id
    : activeRoom?.client_id;
  const currentRole = isSpecialist ? 'specialist' : 'client';
  const activeRoomStatus = activeRoom?.status || 'pending';
  const activeRoomBudget = activeRoom?.tasks?.budget;
  const activeRoomTitle = activeRoom?.tasks?.title || taskDetails?.title || 'Marketplace deal';
  const activeParticipantProfile = roomParticipantProfile(activeRoom, userId);
  const activeParticipantName = roomParticipantName(activeRoom, userId, t);
  const canMessage = activeRoomStatus === 'active';
  const workspaceMeta = chatRoomId
    ? t('secureChannel', 'Secure channel {id}', { id: String(chatRoomId).slice(0, 8) })
    : t('workspacePending', 'Workspace {id}', { id: activeRoom?.id || t('pending', 'pending') });
  const completionStatus = completion || {
    taskId: activeRoom?.task_id,
    workDeliveredBy: taskDetails?.work_delivered_by || null,
    workDeliveredAt: taskDetails?.work_delivered_at || null,
    confirmedByClient: taskDetails?.confirmed_by_client || null,
    confirmedByClientAt: taskDetails?.confirmed_by_client_at || null,
    status: taskDetails?.status || activeRoomStatus,
  };

  const {
    isContactRevealed,
    revealedAt,
    loading: contactLoading,
    revealContact,
  } = useContactVisibility(user?.id, otherParticipantId, activeRoom?.id, activeRoom?.status);

  const {
    contactInfo,
    loading: contactInfoLoading,
  } = useWorkspaceContact(user?.id, otherParticipantId, activeRoom?.status);
  const visibleContactRevealed = canMessage && isContactRevealed;
  const contactCopy = visibleContactRevealed
    ? t('contactUnlocked', 'Contact unlocked')
    : activeRoomStatus === 'active'
    ? t('inAppChatActive', 'In-app chat active')
    : t('protectedMode', 'Protected mode');

  // Fetch agreement for active room's task
  const { agreement, loading: agreementLoading, updateAgreement } = useAgreement(activeRoom?.task_id, user?.id);
  const receiptAgreement = agreement || (taskDetails && activeRoomStatus === 'completed'
    ? {
        id: `TASK-${String(activeRoom?.task_id || taskDetails.id)}`,
        agreed_amount: activeRoomBudget || taskDetails.budget || 0,
        accepted_at: taskDetails.updated_at || taskDetails.created_at,
        expected_delivery_date: taskDetails.work_delivered_at || taskDetails.updated_at,
        proposal_note: 'Receipt generated from completed CatchUp workspace.',
      }
    : null);

  const {
    milestones,
    loading: milestonesLoading,
    completeMilestone,
  } = useMilestones(agreement?.id, user?.id);

  const {
    appointment,
    loading: appointmentLoading,
    proposeAppointment,
    confirmAppointment: confirmScheduledAppointment,
    counterPropose,
  } = useAppointmentScheduling(activeRoom?.task_id, agreement?.id, user?.id);

  useEffect(() => {
    if (!activeRoom?.task_id || receipt || activeRoomStatus !== 'completed') return;
    if (!review?.id && taskDetails?.status !== 'completed') return;

    let cancelled = false;
    createCompletionReceipt({
      taskId: activeRoom.task_id,
      agreementId: agreement?.id || null,
      receiptType: 'service_agreement',
      note: 'Generated automatically after completed review closeout',
    })
      .then((savedReceipt) => {
        if (!cancelled) setReceipt(savedReceipt);
      })
      .catch((err) => {
        if (!cancelled) console.warn('Could not ensure completion receipt:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom?.task_id, activeRoomStatus, agreement?.id, receipt, review?.id, taskDetails?.status]);

  const workspaceFlowIndex =
    review?.id ? 5 :
    completionStatus?.confirmedByClientAt ? 5 :
    completionStatus?.workDeliveredAt ? 4 :
    appointment?.status === 'confirmed' ? 3 :
    ['active', 'completed', 'disputed'].includes(activeRoomStatus) ? 2 :
    1;
  const hasWorkspaceActions = Boolean(
    (activeRoomStatus === 'active' && (isClient || isSpecialist)) ||
    (activeRoomStatus === 'completed' && receiptAgreement && taskDetails) ||
    (activeRoomStatus === 'active' && isSpecialist) ||
    (activeRoomStatus === 'active' && isClient) ||
    (completionStatus?.workDeliveredAt && !completionStatus?.confirmedByClientAt && isClient) ||
    (isClient && activeRoomStatus === 'completed') ||
    (isSpecialist && activeRoomStatus === 'completed') ||
    (isSpecialist && activeRoomStatus === 'active' && agreement)
  );
  const clientReviewSealed = Boolean(review?.id);
  const specialistReviewSealed = Boolean(clientRating);
  const activeMessagePreview = optimisticMessages.at(-1)?.message_text || 'No messages yet';
  const filteredRooms = useMemo(() => {
    const search = roomSearch.trim().toLowerCase();
    if (!search) return rooms;

    return rooms.filter((room) => {
      const searchable = [
        room.tasks?.title,
        room.tasks?.category,
        room.tasks?.district_tag,
        room.status,
        room.tasks?.budget,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(search);
    });
  }, [rooms, roomSearch]);

  useEffect(() => {
    setIsEditingAgreement(false);
  }, [activeRoom?.id, agreement?.id]);

  useEffect(() => {
    if (!isSpecialist || !user?.id || !activeRoom?.task_id) {
      setClientRating(null);
      return;
    }

    let cancelled = false;
    fetchSpecialistRatings(user.id, [activeRoom.task_id])
      .then((ratings) => {
        if (!cancelled) {
          setClientRating((ratings || []).find((rating) => sameId(rating.task_id, activeRoom.task_id)) || null);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('Could not load client rating status:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom?.task_id, isSpecialist, user?.id]);

  useEffect(() => {
    if (!activeRoom?.task_id) return;
    fetchDispute();
  }, [activeRoom?.task_id, fetchDispute]);

  // 1. Fetch all active legal workspace contracts involving the current user session
  useEffect(() => {
    if (!user) return;

    const fetchActiveWorkspaces = async () => {
      try {
        const data = await fetchWorkspaceRoomsForUser(user.id);
        // Ensure rooms belong to current user (defensive filter)
        const myRooms = (data || []).filter(r => sameId(r.client_id, user.id) || sameId(r.specialist_id, user.id));
        const nextRooms =
          activeRoomProp && !myRooms.some((room) => room.id === activeRoomProp.id)
            ? [activeRoomProp, ...myRooms]
            : myRooms;
        setRooms(nextRooms);
        setActiveRoom((currentRoom) => {
          if (activeRoomProp) return activeRoomProp;
          if (currentRoom && nextRooms.some((room) => room.id === currentRoom.id)) {
            return nextRooms.find((room) => room.id === currentRoom.id) || currentRoom;
          }
          return nextRooms[0] || null;
        });
      } catch (err) {
        console.error("Workspace ingestion error:", err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveWorkspaces();
  }, [user, activeRoomProp]);

  // 2. Stream historical messages and hook real-time listeners to the active room
  useEffect(() => {
    if (!user || !activeRoom || !chatRoomId) return;

    let cancelled = false;

    const loadChatHistory = async () => {
      const data = await fetchWorkspaceChatMessages(activeRoom.id, activeRoom.task_id);

      if (!cancelled) {
        setMessages(data || []);
        scrollToBottom();
      }
    };

    loadChatHistory();

    const workspaceChatChannel = subscribeToWorkspaceChat(chatRoomId, (newRow) => {
      setMessages((prev) => [...prev, newRow]);
      scrollToBottom();
    });

    return () => {
      cancelled = true;
      console.log(`🔌 Scaling protection: Dissolving channel stream room-${chatRoomId}`);
      supabase.removeChannel(workspaceChatChannel);
    };
  }, [user, activeRoom, chatRoomId]);

  const scrollToBottom = () => {
    setTimeout(() => messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  // 3. Dispatch text packet over network
  const handleSendMessage = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newMessage.trim() || !activeRoom || !userId || !canMessage) return;

      const messageText = newMessage.trim();

      // 1. Optimistic UI: add message immediately
      startTransition(() => {
        addOptimisticMessage({ text: messageText });
      });
      setNewMessage('');
      setSendingMessage(true);

      try {
        // 2. Send in background
        await sendWorkspaceMessage(chatRoomId || activeRoom.id, userId, messageText, activeRoom.task_id);
      } catch (err) {
        // On error, remove optimistic message and show error
        console.error('Message failed:', err);
        toast('Message failed: ' + (err?.message || err), 'error');
        setNewMessage(messageText); // Restore the unsent message
      } finally {
        setSendingMessage(false);
      }
    },
    [newMessage, activeRoom, chatRoomId, userId, canMessage, addOptimisticMessage, toast]
  );

  const handleOpenDisputeForm = () => {
    setShowDisputeForm(true);
  };

  const handleDisputeFiled = useCallback(
    async ({ reason, category, files }) => {
      if (!activeRoom || !user) return;
      
      // 1. Optimistic UI: immediately show room as disputed
      const updatedRoom = {
        ...activeRoom,
        status: 'disputed',
        dispute_initiated_by: user.id,
        dispute_reason: reason,
      };
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((room) => (room.id === activeRoom.id ? updatedRoom : room)));
      setShowDisputeForm(false);
      setDisputeBusy(true);

      try {
        // 2. Create dispute in background
        const created = await fileDispute(reason, category);

        if (files && files.length > 0) {
          await uploadDisputeEvidence(created.id, files);
        }

        await updateWorkspaceRoomStatus(activeRoom.id, 'disputed', {
          initiatedBy: user.id,
          reason,
        });

        await fetchDispute();
        toast('Dispute filed and evidence uploaded. The other party has been notified.', 'success');
      } catch (err) {
        // On error, revert disputed status
        setActiveRoom(activeRoom);
        setRooms((prev) => prev.map((room) => (room.id === activeRoom.id ? activeRoom : room)));
        setShowDisputeForm(true);
        console.error('Dispute filing failed:', err);
        toast(`Could not file dispute: ${err.message || 'Unknown error'}`, 'error');
      } finally {
        setDisputeBusy(false);
      }
    },
    [activeRoom, user, fileDispute, fetchDispute, toast]
  );

  const handleDisputeResponse = async (message) => {
    if (!dispute || !activeRoom || !user) return;
    setReplyBusy(true);

    try {
      await respondToDispute(message);
      // Notification created in service layer (respondToDispute)
      await fetchDispute();
      toast('Dispute response sent.', 'success');
    } catch (err) {
      console.error('Dispute reply failed:', err);
      toast(`Unable to send dispute response: ${err.message || 'Unknown error'}`, 'error');
    } finally {
      setReplyBusy(false);
    }
  };

  const handleConfirmCompleted = useCallback(
    async (message) => {
      if (!activeRoom || !user) return;

      try {
        await confirmCompleted(message);

        const milestone5 = milestones.find((m) => m.milestone_number === 5);
        if (milestone5 && milestone5.status !== 'completed') {
          await completeMilestone(milestone5.id, user.id, 'Client confirmed completion');
        }

        const updatedRoom = { ...activeRoom, status: 'completed' };
        setActiveRoom(updatedRoom);
        setRooms((prev) => prev.map((room) => (room.id === activeRoom.id ? updatedRoom : room)));
        setShowCompletionModal(false);
        setShowReviewModal(true);
      } catch (err) {
        toast('Unable to confirm completion: ' + (err?.message || 'Unknown error'), 'error');
        throw err;
      }
    },
    [activeRoom, user, confirmCompleted, completeMilestone, milestones, toast]
  );

  const handleRateClient = async () => {
    if (!activeRoom || !user) return;
    setClientRatingSubmitting(true);

    try {
      const rating = await rateClient(
        user.id,
        activeRoom.client_id,
        activeRoom.task_id,
        Number(clientRatingScore),
        clientRatingComment.trim()
      );
      setClientRating(rating);
      setShowClientReviewModal(false);
      setClientRatingComment('');
      toast('Client review submitted. This helps keep the marketplace accountable.', 'success');
    } catch (err) {
      toast('Could not submit client review: ' + (err?.message || 'Unknown error'), 'error');
    } finally {
      setClientRatingSubmitting(false);
    }
  };

  const handleFinalizeProject = async () => {
    if (!activeRoom) return;

    try {
      // 1. Submit review via service (handles reputation + notifications)
      const submittedReview = await submitReview({
        room_id: activeRoom.id,
        task_id: activeRoom.task_id,
        client_id: activeRoom.client_id,
        specialist_id: activeRoom.specialist_id,
        rating_score: parseInt(ratingScore),
        feedback_text: feedbackText.trim()
      });

      toast('Project completed. Review added to specialist reputation.', 'success');
      setShowReviewModal(false);
      setReview(submittedReview);
      const completedRoom = { ...activeRoom, status: 'completed' };
      setActiveRoom(completedRoom);
      setRooms((prev) => prev.map((room) => (room.id === activeRoom.id ? completedRoom : room)));

    } catch (err) {
      toast('Error submitting review: ' + err.message, 'error');
    }
  };

  const handleDownloadReceipt = async () => {
    if (!receiptAgreement || !taskDetails) {
      toast('Receipt data is still loading. Please wait a moment and try again.', 'warning');
      return;
    }

    setReceiptLoading(true);

    try {
      await generateAndDownloadPDF('receipt-pdf', receiptAgreement.id);
      const savedReceipt = await createCompletionReceipt({
        taskId: taskDetails.id,
        agreementId: agreement?.id || null,
        receiptType: 'service_agreement',
        note: 'Download created after completion',
      });
      setReceipt(savedReceipt);
      toast('Receipt downloaded and saved to completion history.', 'success');
    } catch (err) {
      console.error('Receipt download failed:', err);
      const message = err?.message || 'Failed to generate receipt. Please try again.';
      toast(message, 'error');
    } finally {
      setReceiptLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="workspace-loading">
        <div className="spinner" />
        <span>{t('loadingPrivateWorkspaces', 'Loading private workspaces...')}</span>
      </div>
    );
  }

  return (
    <div className="project-room-shell workspace-os">
      <aside className="workspace-rail">
        <div className="workspace-inbox-hero">
          <div>
            <span className="workspace-eyebrow">{t('messages', 'Messages')}</span>
            <h3>{t('workspaceInbox', 'Workspace inbox')}</h3>
            <p>{t('workspaceInboxIntro', 'Private task chats, delivery updates, and closeout actions.')}</p>
          </div>
          <strong>{rooms.length}</strong>
        </div>

        <div className="workspace-inbox-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={roomSearch}
            onChange={(event) => setRoomSearch(event.target.value)}
            placeholder={t('searchConversations', 'Search conversations...')}
          />
          {roomSearch && (
            <button type="button" onClick={() => setRoomSearch('')} aria-label={t('clearWorkspaceSearch', 'Clear workspace search')}>
              ×
            </button>
          )}
        </div>

        <div className="workspace-inbox-filter-row" aria-label="Workspace inbox summary">
          <span>{rooms.filter((room) => room.status === 'active').length} {t('live', 'live')}</span>
          <span>{rooms.filter((room) => room.status === 'completed').length} {t('closed', 'closed')}</span>
          <span>{rooms.filter((room) => room.status === 'disputed').length} {t('cases', 'cases')}</span>
        </div>

        {filteredRooms.length === 0 ? (
          <p className="workspace-empty-copy">
            {rooms.length === 0 ? t('noPrivateConversations', 'No private conversations yet.') : t('noConversationsMatch', 'No conversations match this search.')}
          </p>
        ) : (
          <div className="workspace-inbox-list">
            {filteredRooms.map(room => {
              const selected = activeRoom?.id === room.id;
              const participantLabel = roomParticipantFallback(room, userId, t);
              const participantProfile = roomParticipantProfile(room, userId);
              const participantName = roomParticipantName(room, userId, t);
              const preview = selected ? activeMessagePreview : t('openSecureChat', 'Open secure chat');

              return (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  className={`workspace-room-tile ${selected ? 'active' : ''} ${room.status === 'disputed' ? 'risk' : ''}`}
                >
                  {participantProfile?.avatar_url ? (
                    <img
                      src={participantProfile.avatar_url}
                      alt=""
                      className="workspace-room-avatar workspace-room-avatar-img"
                    />
                  ) : (
                    <span className="workspace-room-avatar" aria-hidden="true">
                      {participantName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="workspace-room-body">
                    <span className="workspace-room-topline">
                      <span className="workspace-room-status">{roomStatusLabel(room.status, t)}</span>
                      <span>{formatRoomBudget(room.tasks?.budget, t)}</span>
                    </span>
                    <strong>{room.tasks?.title || t('marketplaceDeal', 'Marketplace deal')}</strong>
                    <span className="workspace-room-preview">{preview}</span>
                    <span className="workspace-room-meta">
                      {participantLabel}: {participantName} · #{String(room.task_id || room.id).slice(0, 8)}
                    </span>
                    {room.status === 'disputed' && (
                      <em>{t('underArbitration', 'Under arbitration')}</em>
                    )}
                  </span>
                  {selected && (
                    <span className="workspace-room-unread" aria-hidden="true">•</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      <section className="workspace-board">
        {activeRoom ? (
          <>
            <div className="workspace-chat-appbar">
              <div className="workspace-chat-identity">
                {activeParticipantProfile?.avatar_url ? (
                  <img
                    src={activeParticipantProfile.avatar_url}
                    alt=""
                    className="workspace-chat-avatar workspace-chat-avatar-img"
                  />
                ) : (
                  <span className="workspace-chat-avatar" aria-hidden="true">
                    {activeParticipantName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <span>{currentRole === 'specialist' ? t('clientConversation', 'Client conversation') : t('specialistConversation', 'Specialist conversation')}</span>
                  <strong>{activeParticipantName} · {activeRoomTitle}</strong>
                </div>
              </div>
              <div className="workspace-chat-meta">
                <span>{roomStatusLabel(activeRoomStatus, t)}</span>
                <span>{canMessage ? t('chatLive', 'Chat live') : t('paused', 'Paused')}</span>
                <span>{t('messageCount', '{count} messages', { count: optimisticMessages.length })}</span>
              </div>
            </div>

            <header className={`workspace-hero workspace-hero-${activeRoomStatus}`}>
              <div className="workspace-hero-main">
                <div className="workspace-title-row">
                  <span className="workspace-status-pill">{roomStatusLabel(activeRoomStatus, t)}</span>
                  <span className="workspace-mini-meta">{workspaceMeta}</span>
                </div>
                <h2>{activeRoomTitle}</h2>
                <div className="workspace-metrics">
                  <span>{activeRoomBudget ? `${activeRoomBudget.toLocaleString()} EGP` : t('budgetPending', 'Budget pending')}</span>
                  <span>{currentRole === 'specialist' ? t('specialistView', 'Specialist view') : t('clientView', 'Client view')}</span>
                  <span>{contactCopy}</span>
                </div>
                <JobJourneyStepper
                  task={taskDetails || { id: activeRoom.task_id, ...(activeRoom?.tasks || {}), status: activeRoom.status }}
                  bids={[]}
                  agreement={agreement}
                  appointment={appointment}
                  completion={completion}
                  review={review}
                  room={activeRoom}
                />
                {activeRoomStatus !== 'completed' && (
                  <CatchUpServiceFlow role={currentRole} context="workspace" activeIndex={workspaceFlowIndex} />
                )}
                {activeRoom.status === 'active' && (
                  <div className="workspace-contact-dock">
                    <ContactCard
                      contact={contactInfo}
                      isRevealed={visibleContactRevealed}
                      onReveal={revealContact}
                      loading={contactLoading || contactInfoLoading}
                    />
                    {visibleContactRevealed && revealedAt && (
                      <div className="workspace-contact-note">
                        {t('contactDetailsRevealedAt', 'Contact details first revealed at {date}', { date: new Date(revealedAt).toLocaleString() })}
                      </div>
                    )}
                    {agreement && (
                      <div className="workspace-agreement-dock">
                        <AgreementCard
                          agreement={agreement}
                          isEditing={isEditingAgreement && isSpecialist}
                          onUpdate={updateAgreement}
                          loading={agreementLoading}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {hasWorkspaceActions && (
              <div className="workspace-action-stack">
                {activeRoom.status === 'active' &&
                  (isClient || isSpecialist) && (
                    <button
                      type="button"
                      onClick={handleOpenDisputeForm}
                      className="workspace-action danger"
                    >
                      <span>{t('dispute', 'Dispute')}</span>
                      <small>{t('openCase', 'Open case')}</small>
                    </button>
                  )}

                {activeRoom.status === 'completed' && receiptAgreement && taskDetails && (
                  <button 
                    onClick={handleDownloadReceipt}
                    disabled={receiptLoading}
                    className="workspace-action secondary"
                  >
                    <span>{receiptLoading ? t('generating', 'Generating') : t('receipt', 'Receipt')}</span>
                    <small>{receiptLoading ? t('pleaseWait', 'Please wait') : receipt?.id ? t('openAnytime', 'Open anytime') : t('createOnce', 'Create once')}</small>
                  </button>
                )}

                {isClient && activeRoom.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!clientReviewSealed) setShowReviewModal(true);
                    }}
                    className={`workspace-action ${clientReviewSealed ? 'secondary' : 'success'}`}
                    disabled={clientReviewSealed}
                  >
                    <span>{clientReviewSealed ? t('specialistReviewed', 'Specialist reviewed') : t('leaveReview', 'Leave review')}</span>
                    <small>{clientReviewSealed ? t('reputationSealed', 'Reputation sealed') : t('closeoutScore', 'Closeout score')}</small>
                  </button>
                )}

                {activeRoom.status === 'active' && isSpecialist && (
                  <DeliveryButton
                    isSpecialist
                    hasDelivered={!!completionStatus?.workDeliveredAt}
                    onMarkDelivered={markDelivered}
                    loading={completionLoading}
                    disabled={completionLoading}
                  />
                )}

                {isClient && activeRoom.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => setShowCompletionModal(true)}
                    className="workspace-action success"
                  >
                    <span>{completionStatus?.confirmedByClientAt ? t('review', 'Review') : t('reviewWork', 'Review work')}</span>
                    <small>{completionStatus?.workDeliveredAt ? t('confirmDone', 'Confirm done') : t('deliveryStatus', 'Delivery status')}</small>
                  </button>
                )}

                {completionStatus?.workDeliveredAt && !completionStatus?.confirmedByClientAt && isClient && (
                  <div className="workspace-action-note">
                    {t('workDeliveredAwaiting', 'Work delivered on {date}; awaiting your confirmation.', { date: new Date(completionStatus.workDeliveredAt).toLocaleString() })}
                  </div>
                )}

                {isSpecialist && activeRoom.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!specialistReviewSealed) setShowClientReviewModal(true);
                    }}
                    className={`workspace-action ${specialistReviewSealed ? 'secondary' : 'success'}`}
                    disabled={clientRatingSubmitting || specialistReviewSealed}
                  >
                    <span>{specialistReviewSealed ? t('clientReviewed', 'Client reviewed') : t('rateClient', 'Rate client')}</span>
                    <small>{specialistReviewSealed ? t('reputationSealed', 'Reputation sealed') : t('closeoutScore', 'Closeout score')}</small>
                  </button>
                )}

                {isSpecialist && activeRoom.status === 'active' && agreement && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAgreement(!isEditingAgreement)}
                    className="workspace-action secondary"
                  >
                    <span>{isEditingAgreement ? t('cancelEdit', 'Cancel edit') : t('editDate', 'Edit date')}</span>
                    <small>{t('deliveryPlan', 'Delivery plan')}</small>
                  </button>
                )}
              </div>
              )}
            </header>

            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '1200px', opacity: 0, pointerEvents: 'none' }}>
              {receiptAgreement && taskDetails && (
                <ReceiptPDF
                  agreement={receiptAgreement}
                  task={taskDetails}
                  completion={completionStatus}
                  review={review}
                  receipt={receipt}
                  dispute={dispute}
                  loading={receiptLoading}
                  onDownload={handleDownloadReceipt}
                  milestones={milestones}
                />
              )}
            </div>

            <div className="workspace-content">
              <PaymentBetaNotice compact />

              {activeRoom.status === 'disputed' && (
                <div className="workspace-alert risk" role="alert">
                  <strong>{t('workspaceUnderArbitration', 'Workspace under arbitration')}</strong>
                  <span>
                    {t('arbitrationCopy', 'Chat records are preserved for administrative case evaluation.')}
                    {activeRoom.dispute_reason ? ` ${t('reasonOnFile', 'Reason on file: "{reason}"', { reason: activeRoom.dispute_reason })}` : ''}
                  </span>
                </div>
              )}

              {activeRoom.status === 'active' && showDisputeForm && (
                <div className="workspace-module">
                  <DisputeForm
                    taskId={activeRoom.task_id}
                    onDisputeFiled={handleDisputeFiled}
                    onCancel={() => setShowDisputeForm(false)}
                    loading={disputeBusy}
                  />
                </div>
              )}

              {dispute && (
                <div className="workspace-module">
                  <DisputeThread
                    dispute={dispute}
                    responses={responses}
                    currentUserId={user.id}
                    onRespond={handleDisputeResponse}
                    loading={replyBusy || disputeLoading}
                  />
                </div>
              )}

              <div className="workspace-command-grid">
                <SmartNextAction
                  role={currentRole}
                  task={taskDetails}
                  agreement={agreement}
                  appointment={appointment}
                  completion={completion}
                  review={review}
                  dispute={dispute}
                  receipt={receipt}
                />
                <TrustTimeline
                  task={taskDetails}
                  agreement={agreement}
                  appointment={appointment}
                  completion={completion}
                  review={review}
                  dispute={dispute}
                  receipt={receipt}
                  milestones={milestones}
                />
              </div>

              {activeRoom.status === 'active' && (
                <div className="workspace-module">
                  <ScheduleAppointment
                    isSpecialist={isSpecialist}
                    appointment={appointment}
                    loading={appointmentLoading}
                    onPropose={proposeAppointment}
                    onConfirm={confirmScheduledAppointment}
                    onCounterPropose={counterPropose}
                  />
                </div>
              )}

              <div className="workspace-module">
                <MilestoneChecklist
                  milestones={milestones}
                  isSpecialist={isSpecialist}
                  isClient={isClient}
                  onMilestoneComplete={completeMilestone}
                  loading={milestonesLoading}
                />
              </div>
            </div>

            <div className="workspace-chat-stream">
              <div className="workspace-chat-title">
                <span>{t('secureMessages', 'Secure messages')}</span>
                <strong>{optimisticMessages.length}</strong>
              </div>
              {optimisticMessages.map((msg, index) => {
                const isMe = sameId(msg.sender_id, userId);
                return (
                  <div key={msg.id || index} className={`workspace-message-row ${isMe ? 'me' : 'them'}`}>
                    <div className={`workspace-message-bubble ${isMe ? 'me' : 'them'} ${msg.isPending ? 'pending' : ''}`}>
                      {msg.message_text}
                      {msg.isPending && <span>{t('sending', 'Sending')}</span>}
                    </div>
                  </div>
                );
              })}
              {optimisticMessages.length === 0 && (
                <div className="workspace-message-empty">
                  {t('noMessagesYet', 'No messages yet. Start with a short work update or appointment note.')}
                </div>
              )}
              <div ref={messageEndRef} />
            </div>

            <div className={`workspace-guard ${canMessage ? 'verified' : 'locked'}`}>
              <div>
                <strong>{canMessage ? t('agreementRecorded', 'Agreement recorded') : t('systemProtectionActive', 'System protection active')}</strong>
                <span>
                  {canMessage && visibleContactRevealed
                    ? t('directContactAvailable', 'Direct communication coordinates are available in the workspace header.')
                    : canMessage
                    ? t('workspaceChatActive', 'In-app workspace chat is active. Contact details remain controlled by reveal permissions.')
                    : activeRoomStatus === 'completed'
                    ? t('completedChatClosed', 'This task is completed. Messaging, contact reveal, and sharing are closed.')
                    : t('adminReviewPaused', 'Messaging is paused while this case is under administrative review.')}
                </span>
              </div>
              <span>{canMessage ? t('live', 'live') : t('locked', 'locked')}</span>
            </div>

            {canMessage ? (
              <form onSubmit={handleSendMessage} className="workspace-composer">
                <input
                  type="text"
                  placeholder={t('writeWorkspaceUpdate', 'Write a clear update for the other participant...')}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  className="workspace-send-button"
                  disabled={sendingMessage}
                >
                  {sendingMessage ? t('sending', 'Sending...') : t('send', 'Send')}
                </button>
              </form>
            ) : (
              <div className="workspace-composer-closed" role="status">
                <strong>{activeRoomStatus === 'completed' ? t('conversationClosed', 'Conversation closed') : t('messagingPaused', 'Messaging paused')}</strong>
                <span>
                  {activeRoomStatus === 'completed'
                    ? t('completedNoMessaging', 'Completed tasks cannot send messages, reveal contact details, or share direct information.')
                    : t('caseUnderAdminReview', 'This case is under administrative review.')}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="workspace-empty-panel">
            <strong>{t('selectDealChannel', 'Select a deal channel')}</strong>
            <span>{t('selectDealChannelCopy', 'Choose an active contract from the sidebar to open the secure workspace.')}</span>
          </div>
        )}
      </section>

      <CompletionConfirmationModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        completion={completionStatus}
        isClient={isClient}
        onConfirmCompleted={handleConfirmCompleted}
        loading={completionLoading}
      />

      {showClientReviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '500px', width: '100%', padding: '32px', background: 'var(--bg-soft)', border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text)' }}>{t('reviewClientTitle', 'Review Client')}</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-2)', fontSize: '14px' }}>
              {t('reviewClientIntro', 'Rate the client’s communication, clarity, and completion behavior. This keeps the marketplace fair for specialists too.')}
            </p>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{t('clientScore', 'Client Score')}</label>
            <select
              value={clientRatingScore}
              onChange={(e) => setClientRatingScore(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '20px', outline: 'none' }}
            >
              <option value="5">{t('excellentClient', '5 - Excellent client')}</option>
              <option value="4">{t('goodClient', '4 - Good client')}</option>
              <option value="3">{t('okayClient', '3 - Okay client')}</option>
              <option value="2">{t('difficultClient', '2 - Difficult client')}</option>
              <option value="1">{t('seriousIssue', '1 - Serious issue')}</option>
            </select>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{t('privateMarketplaceNote', 'Private Marketplace Note')}</label>
            <textarea
              rows="4"
              placeholder={t('clientReviewPlaceholder', 'Was the scope clear? Did the client respond and confirm fairly?')}
              value={clientRatingComment}
              onChange={(e) => setClientRatingComment(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '24px', outline: 'none', resize: 'none', fontFamily: 'sans-serif', fontSize: '14px', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowClientReviewModal(false)}
                disabled={clientRatingSubmitting}
                style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #334155', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer' }}
              >
                {t('later', 'Later')}
              </button>
              <button
                onClick={handleRateClient}
                disabled={clientRatingSubmitting || Boolean(clientRating)}
                className="btn btn-primary"
              >
                {clientRatingSubmitting ? t('submitting', 'Submitting...') : clientRating ? t('reviewSubmitted', 'Review submitted') : t('submitClientReview', 'Submit Client Review')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 OVERLAY TRANSACTIONS COMPLETION MODAL */}
      {showReviewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '500px', width: '100%', padding: '32px', background: 'var(--bg-soft)', border: '1px solid #334155' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--text)' }}>{t('finalizeAssignment', 'Finalize Marketplace Assignment')}</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-2)', fontSize: '14px' }}>{t('specialistReviewIntro', 'Rate the service quality of the specialist to seal the operational transaction block.')}</p>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{t('performanceScore', 'Performance Score Matrix')}</label>
            <select 
              value={ratingScore} 
              onChange={(e) => setRatingScore(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '20px', outline: 'none' }}
            >
              <option value="5">{t('excellentDelivery', '⭐⭐⭐⭐⭐ Excellent Delivery (5/5)')}</option>
              <option value="4">{t('satisfactoryProject', '⭐⭐⭐⭐ Satisfactory Project (4/5)')}</option>
              <option value="3">{t('averageQuality', '⭐⭐⭐ Average Quality (3/5)')}</option>
              <option value="2">{t('substandardOutput', '⭐⭐ Substandard Output (2/5)')}</option>
              <option value="1">{t('criticalBreakdown', '⭐ Critical Breakdown (1/5)')}</option>
            </select>

            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>{t('publicFeedback', 'Public Feedback Commentary')}</label>
            <textarea 
              rows="4"
              placeholder={t('specialistReviewPlaceholder', 'Share performance insights regarding response velocity, technical modification capability, and delivery...')}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              style={{ width: '100%', padding: '12px', background: 'var(--bg)', border: '1px solid #334155', borderRadius: '8px', color: 'var(--text)', marginBottom: '24px', outline: 'none', resize: 'none', fontFamily: 'sans-serif', fontSize: '14px', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReviewModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>{t('cancel', 'Cancel')}</button>
              <button onClick={handleFinalizeProject} className="btn-primary" style={{ background: 'var(--green)', padding: '12px 24px' }}>{t('submitLockDeal', 'Submit & Lock Deal')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
