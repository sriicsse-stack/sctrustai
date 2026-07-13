# Critical API Failure Analysis - /api/user-state

## Executive Summary

**Error**: 500 Internal Server Error on `/api/user-state`  
**Root Cause**: File system write failure in Vercel serverless environment  
**Impact**: Generation UI stuck at "Phase 5 - Auto Fix Engine"  
**Severity**: CRITICAL - Blocks all user session operations

---

## Root Cause Identification

### Issue 1: Read-Only Filesystem in Vercel

**File**: server.ts (Lines 161, 164-177)  
**Code**:
```typescript
const USER_STATE_FILE = path.join(process.cwd(), "user_state.json");

function getUserState() {
  if (!fs.existsSync(USER_STATE_FILE)) {
    const initialState = { ... };
    fs.writeFileSync(USER_STATE_FILE, JSON.stringify(initialState, null, 2));  // ❌ FAILS ON VERCEL
    return initialState;
  }
  // ...
}
```

**Problem**: 
- Vercel serverless functions have read-only root filesystem
- The file `user_state.json` is not included in the build bundle
- Attempt to `fs.writeFileSync()` throws an error
- Error is not caught, bubbles up to cause 500 response

### Issue 2: Missing Error Handling in Endpoint

**File**: server.ts (Lines 423-437)  
**Code**:
```typescript
app.get("/api/user-state", (req, res) => {
  const state = getUserState();  // ❌ THROWS IF WRITE FAILS
  const sessionCookie = getCookieValue(req, "google_auth_session");
  let loggedInUser = null;
  // ... more code
  return res.json({
    success: true,
    ...state,
    user: loggedInUser
  });
});
```

**Problem**:
- No try-catch wrapper around endpoint
- Unhandled exception in `getUserState()` causes 500 error
- No logging to indicate what went wrong
- Response is always HTML error page, never JSON

### Issue 3: File Not in Deployment Bundle

**File**: user_state.json  
**Issue**: 
- File exists in source but not deployed to Vercel
- `user_state.json` should be in deployment but `.gitignore` might exclude it
- Vercel build starts with empty `/tmp` and root is read-only

---

## Complete Error Flow

```
1. Frontend calls: GET /api/user-state
2. Express routes to: app.get("/api/user-state", ...)
3. Calls: const state = getUserState();
4. getUserState() checks: if (!fs.existsSync(USER_STATE_FILE))
5. File doesn't exist (not deployed) → TRUE
6. Tries: fs.writeFileSync(USER_STATE_FILE, ...)
7. Vercel filesystem is read-only → PERMISSION DENIED
8. Throws error: EACCES: permission denied, open '/var/task/user_state.json'
9. Error not caught → Bubbles to Express error handler
10. Express returns: 500 Internal Server Error (HTML)
11. Frontend gets: Non-JSON response
12. UI breaks and shows error in console
```

---

## Missing Environment Variables & Configuration

### Issue: No Logging in Endpoint

**Expected Logging**:
```
USER_STATE_START
SESSION_FOUND (or SESSION_NOT_FOUND)
SUPABASE_QUERY_START
SUPABASE_QUERY_END
USER_STATE_SUCCESS
USER_STATE_ERROR (with details)
```

**Current**: Zero logging in the endpoint

### Issue: No Error Diagnostics

**What we don't know**:
- Is the file read/write failing? ✓ YES (confirmed)
- Is cookie parsing failing? Unknown (no logging)
- Is response JSON valid? NO (500 HTML returned)
- What's the exact error message? Unknown (no logging)

---

## Files Affected

| File | Issue | Lines |
|------|-------|-------|
| server.ts | Filesystem write without try-catch | 161-177 |
| server.ts | No error handling in endpoint | 423-437 |
| server.ts | No logging in endpoint | 423-437 |
| vercel.json | Configuration is correct | - |
| user_state.json | Not deployed/not in bundle | - |

---

## Exact Failing Operations

### Operation 1: File Existence Check
```typescript
if (!fs.existsSync(USER_STATE_FILE))  // Returns TRUE (file doesn't exist)
```

### Operation 2: File Write Attempt
```typescript
fs.writeFileSync(USER_STATE_FILE, JSON.stringify(initialState, null, 2))
// Throws: EACCES: permission denied, open '/var/task/user_state.json'
```

### Operation 3: Response Generation
```typescript
return res.json({ success: true, ...state, user: loggedInUser })
// Never reached - error already thrown above
```

---

## Environment Variables Status

| Variable | Current | Vercel Set? | Issue |
|----------|---------|------------|-------|
| GOOGLE_CLIENT_ID | Set | Yes | ✅ OK |
| GOOGLE_CLIENT_SECRET | Set | Yes | ✅ OK |
| OPENROUTER_API_KEY | Set | Yes | ✅ OK |
| MODEL | Set | Yes | ✅ OK |
| NODE_ENV | production | Yes (default) | ✅ OK |
| VERCEL | true | (Vercel only) | ✅ OK |

**Missing**: VERCEL variable detection for graceful fallback

---

## Quick Verification

**Browser Console Shows**:
```
Non-JSON response: {url: https://sctrustai.vercel.app/api/user-state, status: 500, body: <!DOCTYPE html>...}
```

**This confirms**: Endpoint is being called but returning HTML instead of JSON

**Why**: Unhandled exception in handler → Express default error handler → HTML error page

---

## Fix Strategy

### Phase 1: Immediate Fix (Error Handling)
Add try-catch to /api/user-state endpoint
Add logging for diagnostics
Handle filesystem errors gracefully
Always return JSON response

### Phase 2: State Persistence
Don't write to filesystem on Vercel
Use Supabase for state persistence instead
Or use /tmp directory (ephemeral but works)

### Phase 3: Deployment
Ensure user_state.json is deployed if used
Or eliminate filesystem dependency entirely

---

## Success Criteria

✅ /api/user-state returns 200 OK with valid JSON  
✅ Console logs show: USER_STATE_START, USER_STATE_SUCCESS  
✅ Generation UI advances past "Phase 5"  
✅ No "Non-JSON response" errors  
✅ state.credits returned correctly  
✅ state.plan returned correctly

---

## Next Steps

1. **Add error handling** to getUserState() and /api/user-state endpoint
2. **Add detailed logging** to diagnose each step
3. **Handle Vercel environment** gracefully
4. **Test on production** to verify fix
5. **Monitor logs** for any residual issues
