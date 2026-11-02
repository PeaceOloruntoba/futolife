create table if not exists public.post_hashtags (
  post_id uuid not null references public.posts(id) on delete cascade,
  hashtag text not null check(char_length(hashtag) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key(post_id,hashtag)
);
create index if not exists post_hashtags_lookup on public.post_hashtags(hashtag,post_id);
alter table public.post_hashtags enable row level security;
drop policy if exists "Users can read hashtags for visible posts" on public.post_hashtags;
create policy "Users can read hashtags for visible posts" on public.post_hashtags for select to authenticated
using(exists(select 1 from public.posts p where p.id=post_id));

create or replace function public.index_post_hashtags()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tag_row record;
begin
  delete from public.post_hashtags where post_id=new.id;
  for tag_row in
    select distinct lower((m.parts)[1]) as value
    from regexp_matches(new.body,'#([[:alnum:]_]{1,32})','g') as m(parts)
  loop
    insert into public.post_hashtags(post_id,hashtag) values(new.id,tag_row.value) on conflict do nothing;
  end loop;
  return new;
end;
$$;
drop trigger if exists index_post_hashtags on public.posts;
create trigger index_post_hashtags after insert or update on public.posts
for each row execute function public.index_post_hashtags();

update public.posts set body=body;
