INSERT INTO public.show_cast (show_id, name, role, sort_order)
SELECT
  shows.id,
  cast_member.name,
  cast_member.role,
  cast_member.sort_order
FROM public.shows
CROSS JOIN (
  VALUES
    ('Amina Rahman', 'Host', 0),
    ('Omar Haddad', 'Director', 1),
    ('Layla Mansour', 'Producer', 2)
) AS cast_member(name, role, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.show_cast
  WHERE show_cast.show_id = shows.id
);
