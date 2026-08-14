# Cloud Sync setup (Firebase)

One-time setup so the **Sync** panel (Backup screen) can upload your data to
Firestore. Until this is done, the Sync panel will tell you it isn't configured.

## 1. Paste your Firebase config

Firebase Console → ⚙️ **Project Settings** → **General** → scroll to **Your apps**
→ your web app → **SDK setup and configuration**.

Copy those values into `src/firebase.js`, replacing the `YOUR_...` placeholders.

## 2. Turn on Email/Password sign-in

Firebase Console → **Authentication** → **Sign-in method** → enable
**Email/Password** → Save.

## 3. Create the account that will own the synced data

Firebase Console → **Authentication** → **Users** → **Add user**. Use any email
and password you like — this is what you'll type once into the Sync panel.

This is separate from the app's own login (the Users screen). The app login
controls who can open the app; this Firebase account controls who can write to
your Firestore data.

## 4. Create the database

Firebase Console → **Firestore Database** → **Create database** → start in
**production mode** (the rules below will replace the defaults).

## 5. Apply the security rules

Firebase Console → **Firestore Database** → **Rules** tab. Replace everything
with this, then **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Each signed-in account can only touch its own data — nobody else can
    // read or write it, even though the Firebase config is public.
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 6. Deploy and sync

Rebuild/redeploy the app, open **Backup → Cloud Sync**, sign in with the
account from step 3, and press **Sync to Cloud**.

---

## What gets uploaded

The currently-active company only, as a single document at:

```
users/{your-uid}/companies/{companyId}
```

Sync is **upload-only** — it copies local data up to Firestore and never
changes or deletes anything locally. Each sync overwrites that company's
previous cloud copy.

Your data still lives in the browser as before; this is a cloud backup on top
of that, not a replacement, and it does not make data live-shared between
devices.
