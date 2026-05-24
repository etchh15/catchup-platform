# CatchUp Platform — Deployment Guide

## Stack
- **Frontend**: React 19 (Create React App)
- **Backend / DB / Auth**: Supabase
- **Recommended hosting**: Vercel (free tier works)

---

## Step 1 — Set up Supabase

### 1.1 Create project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a region close to Egypt (e.g. Frankfurt or Mumbai)
3. Save your database password somewhere safe

### 1.2 Run the SQL setup
Open the **SQL Editor** in your Supabase dashboard and run these scripts in order:

#### Tables (run first)
```sql
-- Profiles (single source of truth for all users)
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text,
  role          text check (role in ('client','specialist')),
  category      text,
  professional_title text,
  bio           text,
  district_tag  text default 'Tala',
  phone_number  text,
  portfolio_images text[],
  is_verified   boolean default false,
  average_rating numeric(3,2) default 5.0,
  review_count  int default 0,
  hourly_rate   numeric,
  updated_at    timestamptz default now()
);

-- Clients
create table if not exists clients (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  city_district text default 'Tala',
  created_at  timestamptz default now()
);

-- Specialists
create table if not exists specialists (
  id                  uuid primary key references auth.users(id) on delete cascade,
  business_name       text,
  profession_category text,
  is_verified         boolean default false,
  created_at          timestamptz default now()
);

-- Tasks / job postings
create table if not exists tasks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id) on delete cascade,
  client_name           text,
  title                 text not null,
  description           text,
  category              text,
  district_tag          text default 'Tala',
  budget                numeric,
  status                text default 'open' check (status in ('open','active','completed','archived','expired')),
  assigned_specialist_id uuid,
  created_at            timestamptz default now()
);

-- Bids / proposals
create table if not exists bids (
  id                   uuid primary key default gen_random_uuid(),
  task_id              uuid references tasks(id) on delete cascade,
  specialist_id        uuid references auth.users(id) on delete cascade,
  amount               numeric not null,
  note                 text,
  proposal_text        text,
  status               text default 'pending' check (status in ('pending','accepted','rejected')),
  platform_fee_amount  numeric,
  provider_net_payout  numeric,
  created_at           timestamptz default now()
);

-- Workspace rooms (opened when a bid is accepted)
create table if not exists workspace_rooms (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid references tasks(id),
  client_id     uuid references auth.users(id),
  specialist_id uuid references auth.users(id),
  status        text default 'active' check (status in ('active','completed','disputed')),
  dispute_initiated_by uuid,
  dispute_reason text,
  created_at    timestamptz default now()
);

-- Workspace chat messages
create table if not exists workspace_messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid references workspace_rooms(id) on delete cascade,
  sender_id    uuid references auth.users(id),
  message_text text not null,
  created_at   timestamptz default now()
);

-- Reviews
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid references workspace_rooms(id),
  task_id       uuid references tasks(id),
  client_id     uuid references auth.users(id),
  specialist_id uuid references auth.users(id),
  rating_score  int check (rating_score between 1 and 5),
  feedback_text text,
  created_at    timestamptz default now()
);
```

#### RLS Policies & Realtime (run second — file is included in the repo)
Run the contents of `supabase/setup-realtime-and-specialists.sql`.

Then add these additional policies:
```sql
-- Tasks: anyone authenticated can read open tasks
create policy "Authenticated users can read tasks"
  on tasks for select using (auth.role() = 'authenticated');

-- Tasks: clients can insert their own tasks
create policy "Clients can post tasks"
  on tasks for insert with check (auth.uid() = user_id);

-- Tasks: clients can update their own tasks
create policy "Clients can update own tasks"
  on tasks for update using (auth.uid() = user_id);

-- Bids: anyone authenticated can read bids
create policy "Authenticated users can read bids"
  on bids for select using (auth.role() = 'authenticated');

-- Bids: specialists can submit bids
create policy "Specialists can insert bids"
  on bids for insert with check (auth.uid() = specialist_id);

-- Bids: clients can update bid status (accept/reject)
create policy "Clients can update bid status"
  on bids for update using (
    auth.uid() in (select user_id from tasks where id = task_id)
  );

-- Workspace rooms: participants can read
create policy "Participants can read workspace rooms"
  on workspace_rooms for select using (
    auth.uid() = client_id or auth.uid() = specialist_id
  );

-- Workspace rooms: system can insert (via accepted bid flow)
create policy "Authenticated users can create rooms"
  on workspace_rooms for insert with check (auth.role() = 'authenticated');

-- Workspace messages: participants can read and send
create policy "Room participants can read messages"
  on workspace_messages for select using (
    auth.uid() in (
      select client_id from workspace_rooms where id = room_id
      union
      select specialist_id from workspace_rooms where id = room_id
    )
  );

create policy "Room participants can send messages"
  on workspace_messages for insert with check (auth.role() = 'authenticated');

-- Profiles: users can update their own profile
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Profiles: users can read their own profile
create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

-- Enable RLS on all tables
alter table profiles          enable row level security;
alter table tasks             enable row level security;
alter table bids              enable row level security;
alter table workspace_rooms   enable row level security;
alter table workspace_messages enable row level security;
alter table reviews           enable row level security;
```

### 1.3 Get your API keys
Dashboard → Project Settings → API:
- Copy **Project URL** → `REACT_APP_SUPABASE_URL`
- Copy **anon / public key** → `REACT_APP_SUPABASE_ANON_KEY`

---

## Step 2 — Local development

```bash
# 1. Clone / unzip the project
cd catchup-platform

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env and paste your Supabase URL and anon key

# 4. Start dev server
npm start
# Opens at http://localhost:3000
```

---

## Step 3 — Deploy to Vercel (recommended)

### Option A: Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
# Follow prompts — Vercel auto-detects Create React App
```

### Option B: Vercel Dashboard (easiest)
1. Push your code to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Framework Preset: **Create React App** (auto-detected)
4. Add environment variables:
   - `REACT_APP_SUPABASE_URL` = your URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your key
5. Click **Deploy**

The `vercel.json` in the repo handles SPA routing and security headers automatically.

---

## Step 4 — Deploy to Netlify (alternative)

1. Run `npm run build` locally
2. Drag the `build/` folder to [netlify.com/drop](https://netlify.com/drop)
3. Add environment variables in Site Settings → Environment
4. The `public/_redirects` file handles SPA routing

---

## Post-deployment checklist

- [ ] Auth emails working (Supabase Dashboard → Auth → Email Templates — customize with your domain)
- [ ] Test sign up as a client, post a task
- [ ] Test sign up as a specialist, submit a bid
- [ ] Test accepting a bid (workspace room opens)
- [ ] Test the live chat in a workspace room
- [ ] Add your custom domain in Vercel/Netlify settings
- [ ] In Supabase Dashboard → Auth → URL Configuration → add your production URL to **Redirect URLs**

---

## Environment variables reference

| Variable | Where to get it |
|---|---|
| `REACT_APP_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |

---

## Troubleshooting

**"Invalid API key" error**: Double check your `.env` file has no extra spaces around the `=` sign.

**Auth redirect loops**: Make sure your production URL (e.g. `https://catchup.vercel.app`) is added to Supabase → Auth → URL Configuration → Site URL and Redirect URLs.

**Tasks not appearing**: Run the SQL setup scripts, especially the RLS policies.

**Realtime not working**: Run `setup-realtime-and-specialists.sql` to enable Supabase Realtime on the tables.
