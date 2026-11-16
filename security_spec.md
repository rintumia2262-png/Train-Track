# BD Train Track — Security Specification (Phase 0)

## 1. Data Invariants
1. **Train Live Status (`/trains/{trainId}`)**:
   - Publicly readable telemetry (`resource.data.isPublic == true`) with zero user PII.
   - `id` must match path `trainId` (`^[a-zA-Z0-9_-]+$`, <= 64 chars).
   - `progress01` must stay within `[0.0, 1.0]`, `speedKmh` within `[0, 160]`, `delayMinutes` within `[0, 720]`.
   - Any authenticated verified user (`email_verified == true`) creating or updating a train status must bind `updatedByUid == request.auth.uid` and `updatedAt == request.time`.
2. **Passenger Chat (`/trains/{trainId}/messages/{messageId}`)**:
   - Master Gate: Parent `/trains/{trainId}` document must exist.
   - `trainId` must equal path `trainId`, `authorUid` must equal `request.auth.uid`.
   - Message `text` bounded to `1..280` chars; `author` bounded to `1..40` chars; `createdAt == request.time`.
   - Messages are immutable (`allow update: if false;`), and only the author may delete their own message.
3. **Onboard Location Pings (`/trains/{trainId}/pings/{pingId}`)**:
   - Master Gate: Parent `/trains/{trainId}` document must exist.
   - `reporterUid == request.auth.uid`, `trainId == trainId`, `createdAt == request.time`.
   - Atomic GPS / check-in writes are immutable after creation.
4. **Private User Profile (`/users/{userId}/private/info`)**:
   - Strictly isolated PII (`email`, `favoriteTrainIds`).
   - Only `request.auth.uid == userId` with `email_verified == true` may `get`, `create`, or `update` their own document; `list` is denied.
5. **Private Web Push Alert Preferences (`/users/{userId}/private/push_alerts`)**:
   - Owner-only (`request.auth.uid == userId && email_verified == true`); cross-user `get` and collection `list` are denied.
   - `uid` is immutable and equals `userId`; `trainId` and `stationId` must match valid ID patterns (`^[a-zA-Z0-9_-]+$`, <= 64 chars); optional `endpoint` string capped at `512` chars; `updatedAt == request.time`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Identity Spoofing on Chat**: Signed-in user A creates `/trains/ekota-706/messages/m1` with `authorUid: "userB"`.
2. **Identity Spoofing on Train Ping**: Signed-in user A creates `/trains/ekota-706/pings/p1` with `reporterUid: "userB"`.
3. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to post chat or train update.
4. **Shadow / Ghost Field Injection**: User adds `{ isAdmin: true, role: "admin" }` alongside valid train status fields.
5. **Orphaned Subcollection Write**: User creates `/trains/nonexistent-train-999/messages/m1` where parent `/trains/nonexistent-train-999` does not exist.
6. **ID Poisoning**: User attempts to create `/trains/<200-char-junk-id>` or `/trains/bad$id`.
7. **Timestamp Forgery**: Client sends `{ createdAt: new Date(0) }` instead of `request.time` (`serverTimestamp()`).
8. **Out-of-Bounds Physics Value**: Client updates `/trains/ekota-706` with `speedKmh: 9999` or `progress01: 5.2`.
9. **Array Exhaustion on Favorite Trains**: User attempts to store 100 strings or non-string entries inside `favoriteTrainIds`.
10. **PII Cross-User Read**: User A attempts `get` on `/users/userB/private/info`.
11. **Chat Tampering**: User A attempts to `update` User B's message text in `/trains/ekota-706/messages/msg1`.
12. **Blanket List Scraping on Users**: Authenticated user attempts `list` on `/users/userB/private`.
13. **Cross-User Push Alert Tampering**: User A attempts `get` or `create` on `/users/userB/private/push_alerts` or injects an oversized `endpoint` (> 512 chars).

