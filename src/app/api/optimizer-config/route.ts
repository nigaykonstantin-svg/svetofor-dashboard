// Optimizer Config API — CRUD operations for optimizer configuration
// Allows admin to view and update thresholds

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { reloadConfig, getGlobalConfig, getCategoryConfigs, getGoldSKUs } from '@/lib/optimizer/config-manager';

const CONFIG_DIR = path.join(process.cwd(), 'config');
const GLOBAL_CONFIG_PATH = path.join(CONFIG_DIR, 'global.yaml');
const CATEGORY_CONFIG_PATH = path.join(CONFIG_DIR, 'category.yaml');
const SKU_OVERRIDES_PATH = path.join(CONFIG_DIR, 'sku_overrides.yaml');

// GET — Retrieve current configuration
export async function GET() {
    try {
        const [global, categories, goldSkus] = await Promise.all([
            getGlobalConfig(),
            getCategoryConfigs(),
            getGoldSKUs(),
        ]);

        // Also read raw YAML for editing
        let rawGlobal = '';
        let rawCategories = '';
        let rawOverrides = '';

        try {
            rawGlobal = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf-8');
            rawCategories = await fs.readFile(CATEGORY_CONFIG_PATH, 'utf-8');
            rawOverrides = await fs.readFile(SKU_OVERRIDES_PATH, 'utf-8');
        } catch (e) {
            console.warn('[Config API] Could not read some config files');
        }

        return NextResponse.json({
            success: true,
            config: {
                global,
                categories,
                goldSkus,
            },
            raw: {
                global: rawGlobal,
                categories: rawCategories,
                overrides: rawOverrides,
            },
        });
    } catch (error) {
        console.error('[Config API] GET error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

// POST — Update configuration
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, content } = body;

        if (!type || !content) {
            return NextResponse.json(
                { success: false, error: 'Missing type or content' },
                { status: 400 }
            );
        }

        // Validate YAML
        try {
            yaml.load(content);
        } catch (e) {
            return NextResponse.json(
                { success: false, error: `Invalid YAML: ${e}` },
                { status: 400 }
            );
        }

        // Determine file path
        let filePath: string;
        switch (type) {
            case 'global':
                filePath = GLOBAL_CONFIG_PATH;
                break;
            case 'categories':
                filePath = CATEGORY_CONFIG_PATH;
                break;
            case 'overrides':
                filePath = SKU_OVERRIDES_PATH;
                break;
            default:
                return NextResponse.json(
                    { success: false, error: `Unknown config type: ${type}` },
                    { status: 400 }
                );
        }

        // Ensure config directory exists
        await fs.mkdir(CONFIG_DIR, { recursive: true });

        // Backup current file
        try {
            const currentContent = await fs.readFile(filePath, 'utf-8');
            const backupPath = `${filePath}.backup.${Date.now()}`;
            await fs.writeFile(backupPath, currentContent);
        } catch (e) {
            // No existing file to backup
        }

        // Write new content
        await fs.writeFile(filePath, content, 'utf-8');

        // Reload config cache
        await reloadConfig();

        return NextResponse.json({
            success: true,
            message: `Config ${type} updated successfully`,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Config API] POST error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}

// PATCH — Update specific fields without replacing entire file
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { type, updates } = body;

        if (!type || !updates) {
            return NextResponse.json(
                { success: false, error: 'Missing type or updates' },
                { status: 400 }
            );
        }

        // Determine file path
        let filePath: string;
        switch (type) {
            case 'global':
                filePath = GLOBAL_CONFIG_PATH;
                break;
            case 'categories':
                filePath = CATEGORY_CONFIG_PATH;
                break;
            default:
                return NextResponse.json(
                    { success: false, error: `PATCH not supported for type: ${type}` },
                    { status: 400 }
                );
        }

        // Read current config
        let currentConfig: Record<string, any> = {};
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            currentConfig = yaml.load(content) as Record<string, any> || {};
        } catch (e) {
            // No existing file
        }

        // Merge updates
        const newConfig = { ...currentConfig, ...updates };

        // Write back
        const newContent = yaml.dump(newConfig, {
            lineWidth: 120,
            quotingType: '"',
        });

        await fs.writeFile(filePath, newContent, 'utf-8');

        // Reload config cache
        await reloadConfig();

        return NextResponse.json({
            success: true,
            message: `Config ${type} patched successfully`,
            updated: Object.keys(updates),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Config API] PATCH error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
