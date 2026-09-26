alter table public.weight_entries
  alter column user_id set default auth.uid();
