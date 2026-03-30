-- اجرا کن در Supabase > SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public read uploads" ON storage.objects;
CREATE POLICY "public read uploads" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');

DROP POLICY IF EXISTS "allow upload" ON storage.objects;
CREATE POLICY "allow upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');

DROP POLICY IF EXISTS "allow delete uploads" ON storage.objects;
CREATE POLICY "allow delete uploads" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');

SELECT 'Storage bucket آماده ✅' as status;
