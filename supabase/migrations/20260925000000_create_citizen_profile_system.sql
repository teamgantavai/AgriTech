-- ====================================================================
-- Gram Sathi Citizen Profile System Migration
-- Secure, RLS-Enforced Citizen Profiles, Field Verifications, Documents & Audit
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Personal Information
    full_name TEXT,
    profile_photo_url TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    mobile TEXT,
    email TEXT,
    
    -- Address
    state TEXT,
    district TEXT,
    sub_district TEXT,
    village_city TEXT,
    pin_code VARCHAR(10),
    address TEXT,
    
    -- Education
    highest_qualification TEXT,
    course TEXT,
    institution TEXT,
    passing_year INTEGER,
    
    -- Social / Eligibility
    occupation TEXT,
    category TEXT CHECK (category IN ('General', 'OBC', 'SC', 'ST', 'EWS', 'Other')),
    annual_family_income NUMERIC(14, 2),
    
    -- Optional Farmer Profile
    is_farmer BOOLEAN DEFAULT false,
    farmer_land_details TEXT,
    farmer_crops TEXT,
    farmer_irrigation TEXT,
    farmer_type TEXT,
    
    -- System metadata
    profile_type TEXT DEFAULT 'general' CHECK (profile_type IN ('general', 'farmer', 'student', 'all')),
    completion_percentage NUMERIC(5, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Ensure profile_photo_url column exists on existing deployments
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 2. PROFILE FIELD VERIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.profile_field_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    value TEXT,
    source TEXT NOT NULL CHECK (source IN ('manual', 'voice', 'document', 'import', 'government_service')),
    status TEXT NOT NULL CHECK (status IN ('empty', 'detected', 'confirming', 'confirmed', 'corrected', 'rejected', 'skipped', 'needs_review')),
    confidence NUMERIC(4, 3) DEFAULT 1.000,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT unique_user_field_verification UNIQUE (user_id, field_name)
);

-- 3. USER DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.user_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('aadhaar', 'income_certificate', 'residence_certificate', 'caste_certificate', 'land_record', 'qualification_proof', 'other')),
    storage_path TEXT,
    document_number_masked TEXT,
    issue_date DATE,
    expiry_date DATE,
    verification_status TEXT DEFAULT 'user_confirmed' CHECK (verification_status IN ('pending', 'user_confirmed', 'verified', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. PROFILE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.profile_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ── Row Level Security (RLS) Policies ─────────────────────────────
-- Mandatory: A user must only ever be able to read/write their own records.

-- user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles_select_own"
    ON public.user_profiles
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "user_profiles_insert_own"
    ON public.user_profiles
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_update_own"
    ON public.user_profiles
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles_delete_own"
    ON public.user_profiles
    FOR DELETE
    USING (auth.uid() = user_id);

-- profile_field_verifications
ALTER TABLE public.profile_field_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verifications_select_own"
    ON public.profile_field_verifications
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "verifications_insert_own"
    ON public.profile_field_verifications
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verifications_update_own"
    ON public.profile_field_verifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verifications_delete_own"
    ON public.profile_field_verifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- user_documents
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_documents_select_own"
    ON public.user_documents
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "user_documents_insert_own"
    ON public.user_documents
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_documents_update_own"
    ON public.user_documents
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_documents_delete_own"
    ON public.user_documents
    FOR DELETE
    USING (auth.uid() = user_id);

-- profile_audit_logs
ALTER TABLE public.profile_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own"
    ON public.profile_audit_logs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "audit_logs_insert_own"
    ON public.profile_audit_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ── Auto-update timestamp trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_verifications_updated_at ON public.profile_field_verifications;
CREATE TRIGGER set_verifications_updated_at
    BEFORE UPDATE ON public.profile_field_verifications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_documents_updated_at ON public.user_documents;
CREATE TRIGGER set_documents_updated_at
    BEFORE UPDATE ON public.user_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
