-- Migration: 006_platform_users.sql
-- Description: Create platform users table for user management

-- Create enum for user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'marketplace_admin', 'category_manager', 'manager', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create platform_users table
CREATE TABLE IF NOT EXISTS platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'pending' CHECK (role IN ('super_admin', 'marketplace_admin', 'category_manager', 'manager', 'pending')),
    category_id TEXT CHECK (category_id IS NULL OR category_id IN ('face', 'body', 'makeup', 'hair')),
    manager_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES platform_users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_platform_users_email ON platform_users(email);
CREATE INDEX IF NOT EXISTS idx_platform_users_role ON platform_users(role);
CREATE INDEX IF NOT EXISTS idx_platform_users_category ON platform_users(category_id);
CREATE INDEX IF NOT EXISTS idx_platform_users_active ON platform_users(is_active);

-- Enable RLS
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data"
    ON platform_users FOR SELECT
    USING (true); -- For now, allow all reads through service role

-- Policy: Admins can insert new users
CREATE POLICY "Admins can insert users"
    ON platform_users FOR INSERT
    WITH CHECK (true); -- Controlled by service role

-- Policy: Admins can update users
CREATE POLICY "Admins can update users"
    ON platform_users FOR UPDATE
    USING (true); -- Controlled by service role

-- Policy: Admins can delete users (soft delete via is_active)
CREATE POLICY "Admins can delete users"
    ON platform_users FOR DELETE
    USING (true); -- Controlled by service role

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_platform_users_updated_at ON platform_users;
CREATE TRIGGER trigger_platform_users_updated_at
    BEFORE UPDATE ON platform_users
    FOR EACH ROW
    EXECUTE FUNCTION update_platform_users_updated_at();

-- =====================================================
-- INITIAL SEED DATA
-- =====================================================

-- Insert super admin (replace with actual email)
INSERT INTO platform_users (email, name, role, is_active)
VALUES 
    ('admin@mixit.ru', 'Администратор', 'super_admin', true)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    name = EXCLUDED.name;

-- Insert marketplace admin (Вероника - replace email as needed)
INSERT INTO platform_users (email, name, role, is_active)
VALUES 
    ('veronika@mixit.ru', 'Вероника', 'marketplace_admin', true)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    name = EXCLUDED.name;

-- Insert category managers
INSERT INTO platform_users (email, name, role, category_id, is_active)
VALUES 
    ('face.manager@mixit.ru', 'Иванова Мария', 'category_manager', 'face', true),
    ('body.manager@mixit.ru', 'Петров Алексей', 'category_manager', 'body', true),
    ('makeup.manager@mixit.ru', 'Сидорова Елена', 'category_manager', 'makeup', true),
    ('hair.manager@mixit.ru', 'Козлов Дмитрий', 'category_manager', 'hair', true)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    name = EXCLUDED.name,
    category_id = EXCLUDED.category_id;

-- Grant permissions to service role
GRANT ALL ON platform_users TO service_role;
GRANT ALL ON platform_users TO authenticated;
