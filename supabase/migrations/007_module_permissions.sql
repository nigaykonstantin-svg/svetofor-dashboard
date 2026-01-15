-- Migration: 007_module_permissions.sql
-- Description: Flexible module-level access control system

-- Create module_permissions table
CREATE TABLE IF NOT EXISTS module_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id TEXT NOT NULL,
    module_name TEXT NOT NULL,
    module_icon TEXT,
    module_path TEXT NOT NULL,
    
    -- Role-based access (which roles can access by default)
    allowed_roles TEXT[] DEFAULT ARRAY['super_admin'],
    
    -- User-specific overrides (grant access even if role doesn't have it)
    allowed_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- User-specific denials (deny access even if role has it)
    denied_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
    
    -- Category restrictions (only for category-aware modules)
    category_restricted BOOLEAN DEFAULT false,
    
    -- Module ordering in sidebar
    sort_order INTEGER DEFAULT 0,
    
    -- Is module active/visible
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(module_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_module_permissions_module_id ON module_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_module_permissions_active ON module_permissions(is_active);

-- Enable RLS
ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read module permissions
CREATE POLICY "Anyone can read module permissions"
    ON module_permissions FOR SELECT
    USING (true);

-- Policy: Only admins can modify
CREATE POLICY "Admins can manage module permissions"
    ON module_permissions FOR ALL
    USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_module_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_module_permissions_updated_at ON module_permissions;
CREATE TRIGGER trigger_module_permissions_updated_at
    BEFORE UPDATE ON module_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_module_permissions_updated_at();

-- =====================================================
-- SEED DEFAULT MODULE PERMISSIONS
-- =====================================================

INSERT INTO module_permissions (module_id, module_name, module_icon, module_path, allowed_roles, category_restricted, sort_order)
VALUES 
    ('dashboard', 'Дашборд', '📊', '/', 
     ARRAY['super_admin', 'marketplace_admin', 'category_manager'], 
     true, 1),
    
    ('tasks', 'Задачи', '📋', '/tasks', 
     ARRAY['super_admin', 'marketplace_admin', 'category_manager', 'manager'], 
     true, 2),
    
    ('goals', 'Цели', '🎯', '/goals', 
     ARRAY['super_admin', 'marketplace_admin', 'category_manager'], 
     false, 3),
    
    ('seo', 'SEO', '🔍', '/seo', 
     ARRAY['super_admin', 'marketplace_admin'], 
     false, 4),
    
    ('org-structure', 'Орг. структура', '🏢', '/org-structure', 
     ARRAY['super_admin', 'marketplace_admin'], 
     false, 5),
    
    ('goals-45b', 'Цели 45 млрд.', '💰', '/goals-45b', 
     ARRAY['super_admin', 'marketplace_admin'], 
     false, 6),
    
    ('admin', 'Управление пользователями', '👥', '/admin', 
     ARRAY['super_admin', 'marketplace_admin'], 
     false, 99)
ON CONFLICT (module_id) DO UPDATE SET
    module_name = EXCLUDED.module_name,
    module_icon = EXCLUDED.module_icon,
    module_path = EXCLUDED.module_path,
    allowed_roles = EXCLUDED.allowed_roles,
    category_restricted = EXCLUDED.category_restricted,
    sort_order = EXCLUDED.sort_order;

-- Grant permissions
GRANT ALL ON module_permissions TO service_role;
GRANT ALL ON module_permissions TO authenticated;
