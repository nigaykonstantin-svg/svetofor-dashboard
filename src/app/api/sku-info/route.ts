import { NextResponse } from 'next/server';
import { getSKUByCode } from '@/lib/sku-matrix';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (!sku) {
        return NextResponse.json({ success: false, error: 'SKU required' }, { status: 400 });
    }

    const skuInfo = getSKUByCode(sku);

    if (!skuInfo) {
        return NextResponse.json({
            success: true,
            data: {
                sku,
                nmId: null,
                name: sku,
                category: 'Неизвестно',
                wbUrl: null
            }
        });
    }

    return NextResponse.json({
        success: true,
        data: {
            sku: skuInfo.sku,
            nmId: skuInfo.nmId,
            name: skuInfo.subCategoryWB || skuInfo.categoryWB || skuInfo.sku,
            category: skuInfo.categoryWB,
            subCategory: skuInfo.subCategoryWB,
            brandManager: skuInfo.brandManager,
            wbUrl: skuInfo.nmId ? `https://www.wildberries.ru/catalog/${skuInfo.nmId}/detail.aspx` : null
        }
    });
}
