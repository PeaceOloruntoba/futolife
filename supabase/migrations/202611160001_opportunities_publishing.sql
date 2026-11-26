-- Public opportunity listings and editorial articles with a separate CMS role.
alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('admin','opportunities_admin'));

create or replace function public.can_manage_opportunities()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists(
    select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='opportunities_admin'
  );
$$;
revoke all on function public.can_manage_opportunities() from public;
grant execute on function public.can_manage_opportunities() to authenticated;

create table if not exists public.opportunity_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  organization text not null,
  category_id uuid references public.opportunity_categories(id) on delete set null,
  summary text not null default '',
  description text not null default '',
  eligibility text not null default '',
  benefits text not null default '',
  required_documents text not null default '',
  location text not null default 'Online',
  deadline timestamptz,
  application_instructions text not null default '',
  source_url text not null,
  application_url text not null,
  status text not null default 'draft' check(status in ('draft','pending_review','published','rejected','archived')),
  featured boolean not null default false,
  verified_at timestamptz,
  last_checked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists opportunities_public_idx on public.opportunities(status,deadline,created_at desc);
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  section text not null default 'Guides',
  cover_image_url text,
  status text not null default 'draft' check(status in ('draft','published','archived')),
  featured boolean not null default false,
  author_name text not null default 'FUTO Life Editorial Team',
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.opportunities drop constraint if exists opportunities_source_url_http;
alter table public.opportunities add constraint opportunities_source_url_http check(source_url ~* '^https?://');
alter table public.opportunities drop constraint if exists opportunities_application_url_http;
alter table public.opportunities add constraint opportunities_application_url_http check(application_url ~* '^https?://');
alter table public.articles drop constraint if exists articles_cover_image_url_http;
alter table public.articles add constraint articles_cover_image_url_http check(cover_image_url is null or cover_image_url ~* '^https?://');
alter table public.articles drop constraint if exists articles_status_check;
alter table public.articles add constraint articles_status_check check(status in ('draft','pending_review','published','rejected','archived'));
create index if not exists articles_public_idx on public.articles(status,published_at desc);

alter table public.opportunity_categories enable row level security;
alter table public.opportunities enable row level security;
alter table public.articles enable row level security;
drop policy if exists "Anyone can read opportunity categories" on public.opportunity_categories;
create policy "Anyone can read opportunity categories" on public.opportunity_categories for select to anon,authenticated using(true);
drop policy if exists "Opportunity managers manage categories" on public.opportunity_categories;
create policy "Opportunity managers manage categories" on public.opportunity_categories for all to authenticated using(public.can_manage_opportunities()) with check(public.can_manage_opportunities());
drop policy if exists "Anyone can read published opportunities" on public.opportunities;
create policy "Anyone can read published opportunities" on public.opportunities for select to anon,authenticated using(status='published' or public.can_manage_opportunities());
drop policy if exists "Opportunity managers manage opportunities" on public.opportunities;
create policy "Opportunity managers manage opportunities" on public.opportunities for all to authenticated using(public.can_manage_opportunities()) with check(public.can_manage_opportunities());
drop policy if exists "Users can submit opportunities for review" on public.opportunities;
create policy "Users can submit opportunities for review" on public.opportunities for insert to authenticated with check(created_by=auth.uid() and status='pending_review' and not featured and verified_at is null and last_checked_at is null);
drop policy if exists "Users can view their opportunity submissions" on public.opportunities;
create policy "Users can view their opportunity submissions" on public.opportunities for select to authenticated using(created_by=auth.uid());
drop policy if exists "Anyone can read published articles" on public.articles;
create policy "Anyone can read published articles" on public.articles for select to anon,authenticated using(status='published' or public.can_manage_opportunities());
drop policy if exists "Opportunity managers manage articles" on public.articles;
create policy "Opportunity managers manage articles" on public.articles for all to authenticated using(public.can_manage_opportunities()) with check(public.can_manage_opportunities());
drop policy if exists "Users can submit articles for review" on public.articles;
create policy "Users can submit articles for review" on public.articles for insert to authenticated with check(created_by=auth.uid() and status='pending_review' and not featured and published_at is null);
drop policy if exists "Users can view their article submissions" on public.articles;
create policy "Users can view their article submissions" on public.articles for select to authenticated using(created_by=auth.uid());

insert into public.opportunity_categories(name,slug,description) values
 ('Scholarships','scholarships','Undergraduate, postgraduate and other education funding.'),
 ('Internships','internships','SIWES, local, international and remote placements.'),
 ('Fellowships','fellowships','Leadership, research and professional development.'),
 ('Jobs','jobs','Graduate, entry-level, experienced and public sector roles.'),
 ('Grants & Funding','grants-funding','Research, business and project funding.'),
 ('Competitions','competitions','Challenges, prizes and open calls.'),
 ('Training & Bootcamps','training-bootcamps','Skills programmes, workshops and bootcamps.'),
 ('Events','events','Conferences, exchange programmes and volunteering.'),
 ('Other','other','Other verified opportunities.')
on conflict(slug) do nothing;

-- A clearly labeled, private starter record for trying the CMS editor.
-- Replace every placeholder and verify its source before publishing.
insert into public.opportunities(
  title,slug,organization,category_id,summary,description,eligibility,benefits,
  required_documents,location,application_instructions,source_url,application_url,status
)
select
  'SAMPLE DRAFT — Graduate Internship Opportunity',
  'sample-draft-graduate-internship',
  'Sample organisation — replace before publishing',
  c.id,
  'Demo listing for checking the opportunities dashboard. Replace with a current, verified opportunity.',
  'This is sample content for CMS setup only. Confirm the provider, eligibility, benefits, requirements, dates, and application instructions from an official source before publishing.',
  'Replace with verified eligibility requirements.',
  'Replace with verified benefits.',
  'Replace with verified required documents.',
  'Online',
  'Replace with verified application instructions.',
  'https://example.org/source',
  'https://example.org/apply',
  'draft'
from public.opportunity_categories c
where c.slug='internships'
on conflict(slug) do nothing;
