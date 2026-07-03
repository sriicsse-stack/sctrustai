# OAUTH VALIDATION REPORT & FIX PLAN

**Project:** Trust Me AI Builder
**Auditor Persona:** Senior QA Engineer, Security Tester, & DevOps Specialist
**Audit Status:** FAILURE (401 invalid_client: no registered origin)
**Date:** 2026-06-21

---

## 1. Executive Summary

A critical Google Sign-In failure was reported with error status `401 invalid_client` and error description `no registered origin`. This issue prevents new and returning users from logging in via Google Identity Services (GSI), crippling the core user authentication workflow.

This report is a real-world, non-simulated technical analysis of the OAuth handshake, origin mismatch boundaries, and configuration offsets between the client workspace, Express backend, and Google's Auth API.

We have isolated the **root cause** and generated the **exact values** that must be entered into the Google Cloud Console / Credentials dashboard to restore functionality immediately.

---

## 2. Technical Origin Analysis

When a client initiates Google Sign-In, the Google Identity Services frontend SDK (`@google/gsi`) reads the host origin of the parent window requesting authentication. It compares this origin against Google’s server-side whitelist for the specified `client_id`. If there is a mismatch (or if no authorized origins are declared), Google rejects the handshake at the API level.

### A. Current window.location.origin Value
Depending on where the application is run, the current loading origin is:
1.  **Development App URL (Iframe Workspace Host):**  
    `https://ais-dev-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app`
2.  **Shared App URL (Deployed/Staging Host):**  
    `https://ais-pre-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app`
3.  **Local Development Host:**  
    `http://localhost:3000`

### B. Identified Origin Used during Handshake
The browser attempts to authenticate with:
- `https://ais-dev-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app`

---

## 3. Configuration Offsets & Discrepancies

During our static and runtime audit of the code, we identified two severe architectural issues with how the Google OAuth Client ID is managed:

1.  **Unsynchronized Client ID in Client-Side Code**  
    *File:* `/src/App.tsx` (Line 371)  
    The GSI client initialization hardcodes the fallback client ID value directly:
    ```ts
    client_id: "341553295955-lnj9niet95tmuobf4id7rnjh0lj69kvr.apps.googleusercontent.com"
    ```
    Even if the user sets `GOOGLE_CLIENT_ID` in their environment variables, the frontend GSI code will continue attempting Google Sign-In using the *old hardcoded client ID*.

2.  **Hardcoded Fallback in Server-Side Code**  
    *File:* `/server.ts` (Line 99)  
    The backend server defines the Client ID as:
    ```ts
    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "341553295955-lnj9niet95tmuobf4id7rnjh0lj69kvr.apps.googleusercontent.com";
    ```
    The default Client ID is a shared asset and does **not** contain the newly spawned dynamic sandbox domain of this Cloud Run deployment (`ais-dev-...`).

---

## 4. Immediate Action Plan: Authorized Google Console Values

To resolve this issue immediately, the owner of the Google Cloud Project hosting the client credential `341553295955-...` (or a newly configured Custom OAuth Client) must add the following exact entries to their **Google Cloud Console Dashboard**:

### 🛠️ Step 1: Add Authorized JavaScript Origins
Add the following three URLs under **Authorized JavaScript origins**:
*   `https://ais-dev-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app`
*   `https://ais-pre-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app`
*   `http://localhost:3000`

### 🛠️ Step 2: Add Authorized Redirect URIs
Add the following three callback endpoints under **Authorized redirect URIs**:
*   `https://ais-dev-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app/auth/callback`
*   `https://ais-pre-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app/auth/callback`
*   `http://localhost:3000/auth/callback`

---

## 5. Architectural Improvements

To ensure the client-side code automatically syncs with any custom user variables and never uses a hardcoded fallback, the codebase should implement dynamic Client ID fetching.

### Finding & Fix for client-side client_id alignment:
Currently, the frontend uses:
```tsx
client_id: "341553295955-lnj9niet95tmuobf4id7rnjh0lj69kvr.apps.googleusercontent.com"
```
Instead, the frontend should fetch the Client ID dynamically or read it from an injected window configuration parameter, or fetch the backend url which uses the correct synced value:
```ts
// Let's call /api/auth/google-url first to read the runtime client ID before invoking GSI:
const res = await fetch("/api/auth/google-url");
const data = await res.json();
if (data.clientId) {
  // Use data.clientId instead of hardcoded strings!
}
```

---

## 6. High-Fidelity Step-by-Step Fix Guide

1.  **Generate a Custom OAuth Client ID:**
    *   Navigate to the [Google Cloud Console Credentials Screen](https://console.cloud.google.com/apis/credentials).
    *   Select **Create Credentials** > **OAuth client ID**.
    *   Set the Application Type to **Web application**.

2.  **Populate Web Application Origins & Redirects:**
    *   Insert the Authorized Origins and Redirect URIs lists generated in Section 4.
    *   Save and copy your newly generated `CLIENT_ID` and `CLIENT_SECRET`.

3.  **Configure Environment Variables in AI Studio Settings:**
    Add or replace the standard secret keys so they override default fallbacks:
    ```env
    GOOGLE_CLIENT_ID=your_new_client_id.apps.googleusercontent.com
    GOOGLE_CLIENT_SECRET=your_new_client_secret
    APP_URL=https://ais-dev-aqq74zyitlpmdcefxyyxer-310734821409.asia-southeast1.run.app
    ```

4.  **Backend Sync Validation:**
    Upon restart, the `/api/auth/google-url` automatically picks up the updated Client ID, ensuring zero mismatches between backend exchanges and Google's Auth core.
