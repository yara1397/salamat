-- ─── Supabase Storage: ساخت bucket برای آپلود فایل‌ها ───
-- این رو در Supabase > SQL Editor اجرا کن

-- ساخت bucket عمومی
INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: همه می‌تونن فایل‌ها رو ببینن
DROP POLICY IF EXISTS "public read" ON storage.objects;
CREATE POLICY "public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'uploads');

-- Policy: هر کسی می‌تونه آپلود کنه (سرور با anon key)
DROP POLICY IF EXISTS "allow upload" ON storage.objects;
CREATE POLICY "allow upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'uploads');

-- Policy: حذف فایل‌ها
DROP POLICY IF EXISTS "allow delete" ON storage.objects;
CREATE POLICY "allow delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'uploads');

SELECT 'Storage bucket آماده است ✅' as status;
