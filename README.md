# MwalimuConnect

A mobile-first Next.js starter for connecting Kenyan schools and educators around teaching vacancies, including positions where teachers are employed by Boards of Management (BOM), and education internships.

## Run locally

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local`.
3. Run `npm install`, then `npm run dev`.
4. Open [http://localhost:3000](http://localhost:3000).

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to enable authentication, live vacancy loading and applications. These are the browser-safe URL and publishable key; `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` are also accepted by server-side code. The public page contains no sample vacancies; the workspace requires an authenticated Supabase session and an authorized profile role. There is no sample-data or role-preview mode. Apply all SQL migrations in `supabase/migrations` to the Supabase project.

## Supabase setup

The migrations create teacher profiles, institutions, vacancies, applications and subscriptions, along with row-level security policies. Teacher signup requires a county; free teacher accounts can read published vacancies only in that county, enforced by database row-level security. Nationwide teacher access is a planned, separate subscription and is not enabled until its price and payment workflow are configured. Super admins select a school's county, subcounty and institution type (`Primary + JSS` or `Senior School`). School heads choose a vacancy teaching level: ECDE / Early Years, Lower Primary, Upper Primary, JSS, or Senior School. Primary + JSS institutions can post the first four levels; Senior School institutions can post Senior School vacancies only. Database migration `202610270004` updates existing institution types and vacancy levels and enforces this relationship. The subcounty selector uses the MIT-licensed `kenya-locations` package. Existing institutions need their subcounty filled in before they can publish vacancies after migration `202610270003`. Existing teacher accounts are prompted to choose a county once. Institution-head accounts are not self-service: a trusted administrator should provision the head's account and assign its institution and `institution` role through a secure admin workflow. Never expose a Supabase service-role key in browser code.

To bootstrap the first super administrator, apply the SQL migrations, then run `npm run seed:superadmin` from an interactive terminal. The script asks for the administrator's name and email and prompts for a password without displaying it. It creates or promotes that Supabase Auth user and sets the matching `profiles.role` to `admin`. The script requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `.env.local`. Keep the secret key server-side only; never expose it in browser code or commit it. `SUPABASE_JWKS_URL` is not currently needed because authentication is verified through Supabase Auth. Afterward, the in-app admin flow can register institutions and send head-of-institution invitations.

## IntaSend setup

Set `INTASEND_SECRET_KEY`, `INTASEND_PUBLIC_KEY` and `SUBSCRIPTION_AMOUNT_KES` in the server environment. The subscription form calls `/api/billing/checkout`, which sends an M-Pesa STK push request using the secret key on the server. Configure an IntaSend webhook and verify its signatures before changing a subscription to active; the starter intentionally does not mark a subscription active from the STK initiation response.

## Current MVP boundary

Teacher signup, county-scoped vacancy access and applications use Supabase. Institution registration/invitations and vacancy authoring are available only to authorized administrator and school accounts. Nationwide teacher subscriptions and payment-webhook reconciliation remain to be implemented before paid teacher access is enabled.
