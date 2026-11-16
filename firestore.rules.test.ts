/**
 * Phase 0 Rules Verification Specification for BD Train Track.
 * Verifies all 12 Dirty Dozen adversarial payloads are rejected (PERMISSION_DENIED)
 * while valid verified-user operations succeed.
 */
export interface RuleTestCase {
  name: string;
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'ALLOW' | 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: RuleTestCase[] = [
  {
    name: '1. Identity Spoofing on Chat',
    path: '/trains/ekota-706/messages/m1',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      trainId: 'ekota-706',
      authorUid: 'userB',
      author: 'Spoofer',
      text: 'Fake update',
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Identity Spoofing on Ping',
    path: '/trains/ekota-706/pings/p1',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      trainId: 'ekota-706',
      reporterUid: 'userB',
      progress01: 0.31,
      speedKmh: 65,
      delayMinutes: 10,
      labelBn: 'GPS',
      labelEn: 'GPS',
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unverified Email Write',
    path: '/trains/ekota-706/messages/m2',
    operation: 'create',
    auth: { uid: 'userA', email_verified: false },
    payload: {
      trainId: 'ekota-706',
      authorUid: 'userA',
      author: 'User A',
      text: 'Hello',
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Shadow Field Injection on Train',
    path: '/trains/ekota-706',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: { isAdmin: true, speedKmh: 70 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Orphaned Message without Parent Train',
    path: '/trains/nonexistent-train-999/messages/m1',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      trainId: 'nonexistent-train-999',
      authorUid: 'userA',
      author: 'User A',
      text: 'Orphaned',
      isPublic: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Invalid Train Document ID',
    path: '/trains/bad$train$id',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: { id: 'bad$train$id', isPublic: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Client Timestamp Forgery',
    path: '/trains/ekota-706/messages/m3',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      trainId: 'ekota-706',
      authorUid: 'userA',
      author: 'User A',
      text: 'Forged time',
      isPublic: true,
      createdAt: '1970-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Out-of-Bounds Train Speed',
    path: '/trains/ekota-706',
    operation: 'update',
    auth: { uid: 'userA', email_verified: true },
    payload: { speedKmh: 9999, progress01: 0.5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Favorite Trains Array Overflow',
    path: '/users/userA/private/info',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      uid: 'userA',
      displayName: 'User A',
      favoriteTrainIds: Array.from({ length: 40 }, (_, i) => `train-${i}`),
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Cross-User PII Read',
    path: '/users/userB/private/info',
    operation: 'get',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Chat Tampering Update',
    path: '/trains/ekota-706/messages/m1',
    operation: 'update',
    auth: { uid: 'userB', email_verified: true },
    payload: { text: 'Edited someone else message' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Unauthorized Private Collection List',
    path: '/users/userB/private',
    operation: 'list',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '13. Cross-User Push Alert Preference Read',
    path: '/users/userB/private/push_alerts',
    operation: 'get',
    auth: { uid: 'userA', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '14. Oversized Push Endpoint Injection',
    path: '/users/userA/private/push_alerts',
    operation: 'create',
    auth: { uid: 'userA', email_verified: true },
    payload: {
      uid: 'userA',
      trainId: 'ekota-706',
      stationId: 'santahar',
      enabled: true,
      alertOnArrival: true,
      alertOnDelay: true,
      endpoint: `https://push.example.com/${'a'.repeat(600)}`,
    },
    expected: 'PERMISSION_DENIED',
  },
];
