import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { ChatMessage, LiveTrainState, TrainMotionPhase } from './data/railwayNetwork';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isAnalyticsSupported()
    .then((supported) => {
      if (supported) getAnalytics(app);
    })
    .catch(() => {
      // Ignore analytics initialization errors under ad-blockers
    });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

void testConnection();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeToPublicTrains(
  onTrains: (updates: Partial<LiveTrainState>[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const trainsPath = 'trains';
  const q = query(collection(db, trainsPath), where('isPublic', '==', true), limit(25));
  return onSnapshot(
    q,
    (snapshot) => {
      const updates: Partial<LiveTrainState>[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.id === 'string' && typeof d.progress01 === 'number') {
          updates.push({
            id: d.id,
            progress01: Math.max(0, Math.min(1, d.progress01)),
            speedKmh: typeof d.speedKmh === 'number' ? d.speedKmh : 60,
            delayMinutes: typeof d.delayMinutes === 'number' ? d.delayMinutes : 0,
            activeReporters: typeof d.activeReporters === 'number' ? d.activeReporters : 1,
            lastReporterLabelBn:
              typeof d.lastReporterLabelBn === 'string'
                ? d.lastReporterLabelBn
                : 'ফায়ারবেস লাইভ',
            lastReporterLabelEn:
              typeof d.lastReporterLabelEn === 'string' ? d.lastReporterLabelEn : 'Firebase Live',
            motionPhase: d.motionPhase as TrainMotionPhase | undefined,
            lastUpdatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : Date.now(),
          });
        }
      });
      if (updates.length > 0) onTrains(updates);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, trainsPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToTrainMessages(
  trainId: string,
  onMessages: (msgs: ChatMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const msgPath = `trains/${trainId}/messages`;
  const q = query(
    collection(db, 'trains', trainId, 'messages'),
    where('isPublic', '==', true),
    limit(50)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (typeof d.text === 'string' && typeof d.author === 'string') {
          list.push({
            id: docSnap.id,
            trainId,
            author: d.author,
            coach: typeof d.coach === 'string' ? d.coach : undefined,
            text: d.text,
            createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
          });
        }
      });
      list.sort((a, b) => a.createdAt - b.createdAt);
      onMessages(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, msgPath);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function publishTrainLocationPing(
  trainId: string,
  current: LiveTrainState,
  payload: {
    progress01: number;
    speedKmh: number;
    delayMinutes: number;
    labelBn: string;
    labelEn: string;
  }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required for Firestore write');

  const safeProgress = Math.max(0, Math.min(1, payload.progress01));
  const safeSpeed = Math.max(0, Math.min(160, Math.round(payload.speedKmh)));
  const safeDelay = Math.max(0, Math.min(720, Math.round(payload.delayMinutes)));
  const safeLabelBn = (payload.labelBn || 'অন-বোর্ড যাত্রী GPS').trim().slice(0, 80);
  const safeLabelEn = (payload.labelEn || 'Onboard Passenger GPS').trim().slice(0, 80);
  const safeReporters = Math.max(1, Math.min(10000, current.activeReporters + 1));

  const trainRef = doc(db, 'trains', trainId);
  const pingId = `ping-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const pingRef = doc(db, 'trains', trainId, 'pings', pingId);

  const batch = writeBatch(db);
  batch.set(
    trainRef,
    {
      id: trainId,
      progress01: safeProgress,
      speedKmh: safeSpeed,
      delayMinutes: safeDelay,
      activeReporters: safeReporters,
      lastReporterLabelBn: safeLabelBn,
      lastReporterLabelEn: safeLabelEn,
      motionPhase: current.motionPhase ?? 'cruising',
      updatedByUid: user.uid,
      isPublic: true,
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );

  batch.set(pingRef, {
    trainId,
    reporterUid: user.uid,
    progress01: safeProgress,
    speedKmh: safeSpeed,
    delayMinutes: safeDelay,
    labelBn: safeLabelBn,
    labelEn: safeLabelEn,
    isPublic: true,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `trains/${trainId}/pings/${pingId}`);
  }
}

export async function publishTrainChatMessage(
  trainId: string,
  current: LiveTrainState,
  input: { author: string; coach?: string; text: string }
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Authentication required for Firestore chat');

  const safeText = input.text.trim().slice(0, 280);
  if (!safeText) return;
  const safeAuthor = (input.author || user.displayName || 'যাত্রী').trim().slice(0, 40);
  const safeCoach = input.coach?.trim().slice(0, 24);

  const trainRef = doc(db, 'trains', trainId);
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const msgRef = doc(db, 'trains', trainId, 'messages', msgId);

  // Ensure parent train document exists atomically before creating subcollection message
  const batch = writeBatch(db);
  batch.set(trainRef, {
    id: trainId,
    progress01: Math.max(0, Math.min(1, current.progress01)),
    speedKmh: Math.max(0, Math.min(160, Math.round(current.speedKmh))),
    delayMinutes: Math.max(0, Math.min(720, Math.round(current.delayMinutes))),
    activeReporters: Math.max(1, Math.min(10000, current.activeReporters)),
    lastReporterLabelBn: (current.lastReporterLabelBn || 'অন-বোর্ড যাত্রী GPS').slice(0, 80),
    lastReporterLabelEn: (current.lastReporterLabelEn || 'Onboard Passenger GPS').slice(0, 80),
    motionPhase: current.motionPhase ?? 'cruising',
    updatedByUid: user.uid,
    isPublic: true,
    updatedAt: serverTimestamp(),
  });

  const msgPayload: Record<string, unknown> = {
    trainId,
    authorUid: user.uid,
    author: safeAuthor,
    text: safeText,
    isPublic: true,
    createdAt: serverTimestamp(),
  };
  if (safeCoach) msgPayload.coach = safeCoach;

  batch.set(msgRef, msgPayload);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `trains/${trainId}/messages/${msgId}`);
  }
}

export async function syncPrivateUserProfile(
  user: User,
  favoriteTrainIds?: string[]
): Promise<string[]> {
  const profilePath = `users/${user.uid}/private/info`;
  const profileRef = doc(db, 'users', user.uid, 'private', 'info');

  try {
    const snap = await getDoc(profileRef);
    const existingFavs = snap.exists()
      ? (snap.data().favoriteTrainIds as string[] | undefined) ?? []
      : [];
    const nextFavs = (favoriteTrainIds ?? existingFavs).slice(0, 20);

    await setDoc(profileRef, {
      uid: user.uid,
      email: (user.email || '').slice(0, 160),
      displayName: (user.displayName || 'BD Rail Passenger').slice(0, 60),
      favoriteTrainIds: nextFavs,
      updatedAt: serverTimestamp(),
    });
    return nextFavs;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }
}

export interface PushAlertPreferenceData {
  trainId: string;
  stationId: string;
  enabled: boolean;
  alertOnArrival: boolean;
  alertOnDelay: boolean;
  endpoint?: string;
}

export async function loadPushAlertPreference(
  user: User
): Promise<PushAlertPreferenceData | null> {
  const prefPath = `users/${user.uid}/private/push_alerts`;
  const prefRef = doc(db, 'users', user.uid, 'private', 'push_alerts');

  try {
    const snap = await getDoc(prefRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    if (typeof d.trainId !== 'string' || typeof d.stationId !== 'string') return null;
    return {
      trainId: d.trainId,
      stationId: d.stationId,
      enabled: Boolean(d.enabled),
      alertOnArrival: Boolean(d.alertOnArrival),
      alertOnDelay: Boolean(d.alertOnDelay),
      endpoint: typeof d.endpoint === 'string' ? d.endpoint : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, prefPath);
  }
}

export async function savePushAlertPreference(
  user: User,
  pref: PushAlertPreferenceData
): Promise<void> {
  const prefPath = `users/${user.uid}/private/push_alerts`;
  const prefRef = doc(db, 'users', user.uid, 'private', 'push_alerts');

  const payload: Record<string, unknown> = {
    uid: user.uid,
    trainId: pref.trainId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'ekota-706',
    stationId: pref.stationId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'santahar',
    enabled: Boolean(pref.enabled),
    alertOnArrival: Boolean(pref.alertOnArrival),
    alertOnDelay: Boolean(pref.alertOnDelay),
    updatedAt: serverTimestamp(),
  };

  if (pref.endpoint) {
    payload.endpoint = pref.endpoint.slice(0, 512);
  }

  try {
    await setDoc(prefRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, prefPath);
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
          <div className="max-w-md rounded-2xl border border-rose-500/30 bg-slate-900 p-6 text-center shadow-2xl">
            <h2 className="text-lg font-bold text-rose-400">
              অ্যাপ্লিকেশন ত্রুটি / Application Error
            </h2>
            <p className="mt-2 break-words text-xs text-slate-300">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600 cursor-pointer"
            >
              রিলোড করুন / Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
