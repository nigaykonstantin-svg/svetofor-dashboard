import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'src/data/seo-keywords.json');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({
                success: false,
                error: 'SEO keywords data not found. Run: node scripts/parse-seo-keywords.js'
            }, { status: 404 });
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[SEO Keywords API] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
