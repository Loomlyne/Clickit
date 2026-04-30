-- Align reviews.user_id with the public profiles table used across the app.
insert into public.profiles (id)
select distinct reviews.user_id
from public.reviews
left join public.profiles on profiles.id = reviews.user_id
where profiles.id is null;

alter table public.reviews
drop constraint if exists reviews_user_id_fkey;

alter table public.reviews
add constraint reviews_user_id_fkey
foreign key (user_id) references public.profiles(id) on delete cascade;
