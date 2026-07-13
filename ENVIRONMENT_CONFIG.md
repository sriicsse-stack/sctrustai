# Production Environment Configuration Guide

## Required Environment Variables

### Supabase Project Secrets (iggslegczqjfbxsxqhjm)

These must be set in Supabase Dashboard → Project Settings → Secrets:

```bash
# Payment Processing
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# AI Model (optional, set if using generate function)
OPENROUTER_API_KEY=your_openrouter_api_key
MODEL=your_model_name
```

**How to set Supabase secrets:**
```bash
npx supabase secrets set RAZORPAY_KEY_ID="your_key_id"
npx supabase secrets set RAZORPAY_KEY_SECRET="your_key_secret"
```

### Vercel Environment Variables

These must be set in Vercel Dashboard → Settings → Environment Variables:

```bash
# Supabase Configuration (already set)
VITE_SUPABASE_URL=https://iggslegczqjfbxsxqhjm.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

# App Configuration
VITE_APP_URL=https://sctrustai.vercel.app
VITE_API_URL=https://sctrustai.vercel.app/api

# AI Model (if using AI features)
OPENROUTER_API_KEY=your_openrouter_api_key
MODEL=your_model_name
```

### Edge Functions Environment

The following are automatically provided by Supabase (no configuration needed):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
- `SUPABASE_ANON_KEY` - Anonymous key for client operations

## Verification Checklist

### 1. Razorpay Configuration
- [ ] `RAZORPAY_KEY_ID` is set in Supabase Secrets
- [ ] `RAZORPAY_KEY_SECRET` is set in Supabase Secrets
- [ ] Keys match your Razorpay account settings
- [ ] Test payment flow works in production

### 2. Supabase Configuration
- [ ] `VITE_SUPABASE_URL` set in Vercel
- [ ] `VITE_SUPABASE_ANON_KEY` set in Vercel
- [ ] Auth is working (sign-in, sign-up)
- [ ] Database queries are working

### 3. Frontend URL Configuration
- [ ] `VITE_APP_URL` set to `https://sctrustai.vercel.app`
- [ ] Referral links generate with correct domain (not Supabase)
- [ ] API calls go to frontend domain (not direct edge function URLs)

## Troubleshooting

### Payment Functions Returning "Unexpected end of JSON input"
**Cause**: Response body is empty or invalid JSON  
**Fix**:
1. Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set
2. Check Supabase function logs for errors
3. Ensure response has `Content-Type: application/json` header

### Referral Links Showing Supabase Domain
**Cause**: Backend returning wrong domain  
**Status**: Temporarily fixed with frontend normalization  
**Fix**:
1. Verify `VITE_APP_URL` environment variable
2. Update edge function with correct domain logic
3. Redeploy edge function

### Edge Functions Returning 500 Errors
**Cause**: Missing environment variables  
**Fix**:
1. Check Supabase Secrets dashboard
2. Verify all required secrets are set
3. Restart/redeploy edge function

## Edge Function Deployment

After updating any edge function:

```bash
# Deploy single function
npx supabase functions deploy razorpay-order

# Deploy all functions
npx supabase functions deploy

# View logs
npx supabase functions delete razorpay-order --dry-run
```

## Testing Production Configuration

### Test Razorpay Integration
1. Open PricingPage in production
2. Select a plan
3. Complete payment with Razorpay test card (4111 1111 1111 1111)
4. Verify payment is recorded in database

### Test Referral System
1. Copy referral link from ReferralCenter
2. Verify URL format: `https://sctrustai.vercel.app/ref/CODE`
3. Open link in new browser/incognito
4. Complete signup
5. Verify referral bonus applied to original user

### Test Edge Functions
1. Check Supabase Dashboard → Edge Functions → Logs
2. Verify functions are deployed (not just local)
3. Check function execution logs for errors
4. Verify response times are acceptable

## Performance Notes

- Razorpay functions should respond in <2 seconds
- Referral functions should respond in <1 second
- If slower, check database query performance
- Consider adding caching for dashboard queries

## Security Considerations

- Never commit `.env.local` or secret files
- Rotate Razorpay keys regularly
- Use separate test/production Razorpay accounts
- Monitor edge function logs for suspicious activity
- Implement rate limiting if needed
