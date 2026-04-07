-- Increase show-artwork bucket file size limit from 5MB to 10MB
-- Hero images (16:9) and posters (2:3) at high quality often exceed 5MB
update storage.buckets
set file_size_limit = 10485760  -- 10MB
where id = 'show-artwork';
