UPDATE public.show_cast
SET image_url = CASE name
  WHEN 'Amina Rahman' THEN 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=240&h=240&q=80'
  WHEN 'Omar Haddad' THEN 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&h=240&q=80'
  WHEN 'Layla Mansour' THEN 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=240&h=240&q=80'
  ELSE image_url
END
WHERE name IN ('Amina Rahman', 'Omar Haddad', 'Layla Mansour')
  AND image_url IS NULL;
