-- 20260701_other_payments.sql
-- Create table for non-fee, non-salary transactions (maintenance, rent, transport, miscellaneous, etc.)

CREATE TABLE IF NOT EXISTS public.other_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('maintenance', 'rent', 'transport', 'miscellaneous', 'nutrition_supplies')),
    type TEXT NOT NULL CHECK (type IN ('inward', 'outward')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected', 'paid')),
    created_by UUID REFERENCES public.school_users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES public.school_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    payment_reference TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.other_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any
DROP POLICY IF EXISTS "allow_all_for_school" ON public.other_payments;

-- Create policy allowing authenticated users of the same school to select/insert/update
CREATE POLICY "allow_all_for_school" ON public.other_payments
    FOR ALL
    USING (school_id = (SELECT school_id FROM public.school_users WHERE email = auth.email() LIMIT 1));
