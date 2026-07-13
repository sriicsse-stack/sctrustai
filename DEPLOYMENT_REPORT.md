# Production Deployment Report

Date: 2026-07-07
Project: sctrustai

## Summary

Frontend deployment is live on Vercel. The referral landing route is serving on the production domain. Supabase Edge Functions deployment is currently blocked by Supabase CLI authorization, so the backend functions were not successfully published to production.

## Step-by-step status

| Step | Status | Evidence |
| --- | --- | --- |
| 1. Run full production build | PASS | `corepack pnpm run build` completed successfully and produced the Vercel/Vite build artifacts. |
| 2. Verify no TypeScript errors | PASS | `npx tsc --noEmit` completed successfully. |
| 3. Verify no ESLint/build failures | PASS | Production build completed without build errors; only Vite chunk-size warnings were reported. |
| 4. Deploy latest frontend to Vercel production | PASS | Vercel deployment completed successfully and the app is reachable at https://sctrustai.vercel.app. |
| 5. Deploy updated Supabase Edge Functions | FAIL | `npx supabase functions deploy referral-profile referral-signup --project-ref iggslegczqjfbxsxqhjm --use-api --no-verify-jwt` returned `401 Unauthorized`. |
| 6. Verify environment variables | PASS | Vercel environment variables include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_APP_URL`. |
| 7. Verify referral link format | PASS | Verified public referral URL responds as `https://sctrustai.vercel.app/ref/TESTCODE` with `HTTP/1.1 200 OK`. |
| 8. End-to-end referral flow verification | BLOCKED | Live signup flow was not executed because the production Supabase functions deployment is currently blocked. |
| 9. Verify referral dashboard metrics | BLOCKED | Not verifiable until the edge functions are deployed and a real signup is exercised. |
| 10. Check browser console | PASS with warnings | No referral-specific `FunctionsFetchError` was observed for the landing route; unrelated app warnings appeared around `/api/user-state` and missing tables. |
| 11. Generate deployment report | PASS | Report created successfully. |

## Deployment details

- Vercel deployment URL: https://sctrustai.vercel.app
- Vercel deployment alias: https://sctrustai.vercel.app
- Supabase project ref: `iggslegczqjfbxsxqhjm`
- Supabase functions attempted: `referral-profile`, `referral-signup`

## Environment variables verified

- `VITE_SUPABASE_URL`: present in Vercel production environment
- `VITE_SUPABASE_ANON_KEY`: present in Vercel production environment
- `SUPABASE_SERVICE_ROLE_KEY`: present in Vercel production environment
- `VITE_APP_URL`: set to `https://sctrustai.vercel.app`

## Referral verification results

- Referral URL format is correct: `https://sctrustai.vercel.app/ref/REFERRAL_CODE`
- The public route returned `200 OK` for `/ref/TESTCODE`
- The existing landing page rendered correctly in the browser

## Remaining blocker

The referral backend functions could not be deployed to Supabase production because the CLI returned `401 Unauthorized` for both the standard and API-based deployment paths. This means the live signup and reward processing flow remains unverified until Supabase access is restored.

## Recommended next step

Restore valid Supabase CLI/Project authorization and retry the edge-function deployment. After that, run a real signup test from a referral link and confirm the credit award and dashboard updates in production.
