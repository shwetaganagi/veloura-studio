# Customer authentication deployment

## Environment variables

Keep these values in the deployment platform’s secret/environment settings. Never commit them.

- `DATABASE_URL`: existing PostgreSQL connection string. The application needs permission to read/update `customers` and use the authentication tables after the migration is applied. The migration runner needs permission to create those tables and add the session-version column.
- `CUSTOMER_SESSION_SECRET`: existing session signing secret, at least 32 characters. Use a randomly generated value and keep it stable across instances.
- `RESEND_API_KEY`: API key for the Resend account used to deliver verification and reset messages.
- `RESEND_FROM_EMAIL`: verified sender, for example `Veloura Studio <accounts@your-domain.example>`.
- `STORE_ORDER_EMAIL`: the store inbox that receives new order notifications. The application intentionally does not supply a default recipient.
- `APP_URL`: canonical public origin, for example `https://www.your-domain.example`, without a trailing slash. Required in production; this is used to create links in emails.
- `DATABASE_URL` and `CUSTOMER_SESSION_SECRET` are already present in the inspected local environment; Resend and store email values must be configured per environment. Values were not displayed or copied.

The code does not need a separate email password or SMTP credential. The Resend key is sent only from the server.

## Database migration

Review and apply `db/migrations/20261112_001_customer_auth_flows.sql` to each target database using the project’s normal migration process. This change has not applied the migration. The migration preserves an existing unique index on `LOWER(email)` or creates one if absent; check for case-insensitive duplicate email groups first, because duplicates will make index creation fail. The inspected Neon database already has this index and no duplicate email groups. Existing accounts default to unverified if the column is newly added; customers must complete email verification before they can sign in.

The read-only Neon inspection confirmed `customers.id` is `bigint`, `email_verified` already exists and defaults to false, the database already has a unique index on `LOWER(email)`, and there are no case-insensitive duplicate email groups. The new migration therefore avoids creating a redundant email index and adds `auth_session_version` for session revocation. It does not update existing customer records, orders, products, or admin data. The token and rate-limit tables are absent in the inspected database.

The migration creates one-time token storage and persistent per-IP rate-limit windows. Schedule the commented cleanup statement in the migration (or add it to the existing maintenance job) to remove old rate-limit rows daily. Before production approval, open Neon’s **Backup & Restore** page and create a snapshot if available for the project; verify it appears as completed. Otherwise confirm the branch’s point-in-time recovery retention and create a separate branch from the current production branch as a recovery/test point. Neon snapshots and PITR branches are separate restore targets, so test recovery on a new branch rather than overwriting production ([Neon snapshots](https://neon.com/blog/three-ways-to-use-your-snapshots), [Neon PITR](https://neon.com/blog/announcing-point-in-time-restore)).

## Release steps

1. Create a Resend account and add the domain you will send from in the Resend Domains dashboard. A dedicated sending subdomain can keep transactional mail separate. Add the exact DNS records Resend displays (including DKIM and sending/SPF records) at your DNS host, wait for propagation, and verify the domain in Resend. If the root domain already has SPF, merge the required sender into its existing SPF record rather than creating a second SPF record or replacing unrelated mail records.
2. Create a Resend API key with **Sending access**, restricted to the sending domain where available. Copy it once into the secret manager; do not commit it or paste it into chat/logs. Set `RESEND_FROM_EMAIL` to a sender on that verified domain, such as `Veloura Studio <accounts@your-domain.example>`.
3. In Vercel, open the project’s **Settings → Environment Variables**. Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STORE_ORDER_EMAIL`, and `APP_URL` to **Production**. Set `STORE_ORDER_EMAIL` to the store’s actual inbox; do not use a placeholder. Set `APP_URL` to the canonical production origin actually used by customers. Preserve the existing `DATABASE_URL` and `CUSTOMER_SESSION_SECRET`; no additional environment variables are required by this implementation. For Preview/Development, use a separate staging database, a staging Resend key/sender, a test store inbox, and that environment’s URL; do not point preview at production data. Vercel applies variable changes only to new deployments, so the deployment must be rebuilt/redeployed after saving them.
4. Review and apply the migration to the intended database using the project’s controlled migration process; do not run it against production until explicitly approved. Take and verify a Neon backup first.
5. After adding variables, create a new deployment so the deployment receives the values. Verify the deployment build and run the production smoke checklist below before directing customers to it.

## Transactional customer and order emails

The application uses its existing server-side Resend HTTP API integration; it does not require the Resend SDK. New registrations receive a welcome message containing the existing email-verification link. Successful logins trigger a security notification. Both WhatsApp orders and online payment orders collect a customer email at checkout and send an order email to that customer plus a store notification to `STORE_ORDER_EMAIL`. Online payment order emails state that payment is still pending. Email content includes the order number, line items, total, and delivery details. The API key is used only server-side. Delivery failures are logged without including addresses or provider response bodies, and do not change successful order or login responses. Resend idempotency keys reduce duplicate order email sends.

Add `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `STORE_ORDER_EMAIL` to each Vercel environment. `RESEND_FROM_EMAIL` must use a domain verified in Resend. To verify the domain, add the exact DNS records shown in Resend (including DKIM and sending/SPF records), allow DNS propagation, then confirm verification in Resend. If the domain already has an SPF record, merge the Resend sender into it instead of creating a second SPF record. Set `STORE_ORDER_EMAIL` to the actual inbox that should receive orders; no recipient address is built into the application. Local development should use the same variables in an ignored `.env.local` file. Never commit API keys or paste them into logs.

Resend’s `onboarding@resend.dev`/`delivered@resend.dev` test setup can exercise API acceptance and simulated delivery, but it is not a production sender or a real mailbox for receiving the link. It cannot fully prove a customer can open the verification/reset message. Use a verified domain and a real controlled test inbox for end-to-end link testing. Resend describes simulated delivery addresses in its [test email guidance](https://resend.com/changelog/sending-test-emails) and provides domain verification details in the [Domains workflow](https://resend.com/changelog/new-domains-workflow).

Vercel has no `vercel.json` or linked `.vercel` project configuration in this workspace; the project uses the standard Next.js build settings in `package.json`. Add variables through the Vercel project UI rather than creating or replacing local environment files. Vercel environment values are assigned separately to Production, Preview, and Development, and changes require a new deployment ([Vercel environment variables](https://vercel.com/docs/environment-variables), [managing variables](https://vercel.com/docs/environment-variables/managing-environment-variables)).

Registration responses are generic for addresses that can’t be registered, password-reset requests return the same message whether or not an account exists, and login failures use one generic credentials message. Auth API limits are per source IP: registration 5/hour, login 10/15 minutes, verification 10/hour, reset requests 5/hour, and reset submissions 10/hour.

New registrations and password resets require a password of at least 12 characters and at most 72 UTF-8 bytes. Existing customer passwords remain usable for login until the customer resets them. A successful password reset increments the customer’s session version, invalidating older customer sessions on their next request. Admin auth uses its separate existing session and is unchanged.

## Production smoke checklist

- Register a new test customer, verify the branded message arrives, and verify the account once.
- Confirm an unverified customer cannot sign in or use customer-only endpoints; confirm a verified customer can sign in.
- Request a reset for a real controlled test account, change its password, and confirm the old password and existing sessions no longer work.
- Confirm used and expired links fail, and repeated requests eventually return HTTP 429.
- Check admin login, product browsing, cart/checkout, and existing customer/order pages after deployment.
- Confirm no API key or raw token appears in browser-visible responses, deployment logs, or source control.
