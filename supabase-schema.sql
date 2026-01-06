-- Supabase SQL: Create daily_analytics table
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)

CREATE TABLE IF NOT EXISTS daily_analytics (
    id SERIAL PRIMARY KEY,
    date DATE UNIQUE NOT NULL,
    order_sum NUMERIC DEFAULT 0,
    order_count INTEGER DEFAULT 0,
    avg_check NUMERIC DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    cart_count INTEGER DEFAULT 0,
    buyout_count INTEGER DEFAULT 0,
    buyout_sum NUMERIC DEFAULT 0,
    cr_cart NUMERIC DEFAULT 0,
    cr_order NUMERIC DEFAULT 0,
    buyout_percent NUMERIC DEFAULT 0,
    advert_spend NUMERIC DEFAULT 0,
    drr NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast date range queries
CREATE INDEX IF NOT EXISTS idx_daily_analytics_date ON daily_analytics(date);

-- Enable RLS (Row Level Security) but allow service key access
ALTER TABLE daily_analytics ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations with service role
CREATE POLICY "Allow service role full access" ON daily_analytics
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow anon read access (for dashboard)
CREATE POLICY "Allow anon read access" ON daily_analytics
    FOR SELECT
    USING (true);
