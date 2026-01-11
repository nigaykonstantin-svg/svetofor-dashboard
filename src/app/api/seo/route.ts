import { NextResponse } from 'next/server';
import { getAllCards, WBCard } from '@/lib/wb-api';
import { getSKUByNmId, getAllSKUs, getCategories } from '@/lib/sku-matrix';
import type { SEOProduct, SEOIssue, SEOAuditResult } from '@/types/seo';

// SEO scoring weights
const SEO_WEIGHTS = {
    title: 20,        // Up to 20 points for good title
    description: 15,  // Up to 15 points for description
    photos: 25,       // Up to 25 points for photos
    video: 15,        // 15 points for having video
    characteristics: 15, // Up to 15 points for filled characteristics
    richContent: 10,  // 10 points for rich content (description quality)
};

function calculateSEOScore(card: WBCard): { score: number; issues: SEOIssue[] } {
    let score = 0;
    const issues: SEOIssue[] = [];

    // Title scoring
    const titleLength = card.title?.length || 0;
    if (titleLength >= 60 && titleLength <= 120) {
        score += SEO_WEIGHTS.title;
    } else if (titleLength >= 40) {
        score += SEO_WEIGHTS.title * 0.5;
        issues.push({
            type: 'title',
            severity: 'warning',
            message: `Название ${titleLength < 60 ? 'короткое' : 'длинное'} (${titleLength} симв.)`,
            recommendation: 'Оптимальная длина названия: 60-120 символов. Добавьте ключевые слова.',
        });
    } else if (titleLength > 0) {
        score += SEO_WEIGHTS.title * 0.3;
        issues.push({
            type: 'title',
            severity: 'critical',
            message: `Название слишком короткое (${titleLength} симв.)`,
            recommendation: 'Добавьте ключевые слова в название. Оптимум: 60-120 символов',
        });
    } else {
        issues.push({
            type: 'title',
            severity: 'critical',
            message: 'Название отсутствует',
            recommendation: 'Добавьте SEO-оптимизированное название с ключевыми словами',
        });
    }

    // Photos scoring (REAL DATA from Content API!)
    const photoCount = card.photos?.length || 0;
    if (photoCount >= 7) {
        score += SEO_WEIGHTS.photos;
    } else if (photoCount >= 5) {
        score += SEO_WEIGHTS.photos * 0.7;
        issues.push({
            type: 'photos',
            severity: 'info',
            message: `${photoCount} фото — можно добавить еще`,
            recommendation: 'Добавьте больше фото (оптимум 7+) для лучшего ранжирования',
        });
    } else if (photoCount >= 3) {
        score += SEO_WEIGHTS.photos * 0.4;
        issues.push({
            type: 'photos',
            severity: 'warning',
            message: `Мало фото: ${photoCount}`,
            recommendation: 'Минимум 5 фото для хорошего ранжирования',
        });
    } else {
        score += SEO_WEIGHTS.photos * 0.1;
        issues.push({
            type: 'photos',
            severity: 'critical',
            message: `Критично мало фото: ${photoCount}`,
            recommendation: 'Срочно добавьте фото! Минимум 5, оптимум 7+',
        });
    }

    // Video scoring (REAL DATA from Content API!)
    const hasVideo = !!card.video && card.video.length > 0;
    if (hasVideo) {
        score += SEO_WEIGHTS.video;
    } else {
        issues.push({
            type: 'video',
            severity: 'warning',
            message: 'Нет видео на карточке',
            recommendation: 'Добавьте видео — это повышает конверсию на 20-30%',
        });
    }

    // Characteristics scoring (REAL DATA from Content API!)
    const characteristicsCount = card.characteristics?.length || 0;
    if (characteristicsCount >= 15) {
        score += SEO_WEIGHTS.characteristics;
    } else if (characteristicsCount >= 10) {
        score += SEO_WEIGHTS.characteristics * 0.7;
        issues.push({
            type: 'characteristics',
            severity: 'info',
            message: `Заполнено ${characteristicsCount} характеристик`,
            recommendation: 'Заполните все доступные характеристики (15+)',
        });
    } else if (characteristicsCount >= 5) {
        score += SEO_WEIGHTS.characteristics * 0.4;
        issues.push({
            type: 'characteristics',
            severity: 'warning',
            message: `Мало характеристик: ${characteristicsCount}`,
            recommendation: 'Заполните больше характеристик для лучшего SEO',
        });
    } else {
        issues.push({
            type: 'characteristics',
            severity: 'critical',
            message: `Критично мало характеристик: ${characteristicsCount}`,
            recommendation: 'Срочно заполните характеристики товара',
        });
    }

    // Description scoring (REAL DATA from Content API!)
    const descLength = card.description?.length || 0;
    if (descLength >= 500) {
        score += SEO_WEIGHTS.description;
    } else if (descLength >= 200) {
        score += SEO_WEIGHTS.description * 0.6;
        issues.push({
            type: 'description',
            severity: 'warning',
            message: `Описание короткое: ${descLength} симв.`,
            recommendation: 'Расширьте описание до 500+ символов с ключевыми словами',
        });
    } else if (descLength > 0) {
        score += SEO_WEIGHTS.description * 0.3;
        issues.push({
            type: 'description',
            severity: 'critical',
            message: `Описание слишком короткое: ${descLength} симв.`,
            recommendation: 'Добавьте развёрнутое описание (500+ символов) с ключевыми словами',
        });
    } else {
        issues.push({
            type: 'description',
            severity: 'critical',
            message: 'Описание отсутствует',
            recommendation: 'Добавьте описание товара с ключевыми словами',
        });
    }

    // Rich content scoring - based on description quality
    // Check for keywords, bullet points, etc.
    if (descLength >= 1000 && card.description.includes('\n')) {
        score += SEO_WEIGHTS.richContent;
    } else if (descLength >= 500) {
        score += SEO_WEIGHTS.richContent * 0.5;
    }

    return { score: Math.round(score), issues };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const manager = searchParams.get('manager');
        const limit = parseInt(searchParams.get('limit') || '200');

        console.log(`[SEO API] Fetching card data from WB Content API...`);

        // Fetch REAL card data from WB Content API
        const cards = await getAllCards(Math.min(limit * 2, 1000));

        console.log(`[SEO API] Loaded ${cards.length} cards from Content API`);

        // Build products list with SEO analysis
        const products: SEOProduct[] = [];
        const categoryBreakdown: Record<string, { count: number; avgScore: number; totalScore: number }> = {};

        for (const card of cards) {
            const nmId = card.nmID;
            if (!nmId) continue;

            const matrixData = getSKUByNmId(nmId);

            // Filter by category if specified
            if (category && matrixData?.categoryWB !== category && card.subjectName !== category) continue;

            // Filter by manager if specified
            if (manager && matrixData?.brandManager !== manager && matrixData?.categoryManager !== manager) continue;

            // Calculate SEO score using REAL data
            const { score, issues } = calculateSEOScore(card);

            const productCategory = matrixData?.categoryWB || card.subjectName || 'Unknown';

            // Track category breakdown
            if (!categoryBreakdown[productCategory]) {
                categoryBreakdown[productCategory] = { count: 0, avgScore: 0, totalScore: 0 };
            }
            categoryBreakdown[productCategory].count++;
            categoryBreakdown[productCategory].totalScore += score;

            products.push({
                nmId,
                sku: matrixData?.sku || card.vendorCode || String(nmId),
                title: card.title || '',
                category: productCategory,
                subCategory: matrixData?.subCategoryWB || '',
                brandManager: matrixData?.brandManager || '',
                categoryManager: matrixData?.categoryManager || '',
                hasTitle: (card.title?.length || 0) > 0,
                titleLength: card.title?.length || 0,
                hasDescription: (card.description?.length || 0) > 0,
                descriptionLength: card.description?.length || 0,
                photoCount: card.photos?.length || 0,
                hasVideo: !!card.video && card.video.length > 0,
                characteristicsCount: card.characteristics?.length || 0,
                seoScore: score,
                issues,
            });

            if (products.length >= limit) break;
        }

        // Calculate category averages
        const categoryBreakdownResult: Record<string, { count: number; avgScore: number }> = {};
        for (const [cat, data] of Object.entries(categoryBreakdown)) {
            categoryBreakdownResult[cat] = {
                count: data.count,
                avgScore: Math.round(data.totalScore / data.count),
            };
        }

        // Sort by SEO score (lowest first - needs attention)
        products.sort((a, b) => a.seoScore - b.seoScore);

        // Calculate issues breakdown
        let criticalCount = 0;
        let warningCount = 0;
        let infoCount = 0;
        for (const p of products) {
            for (const issue of p.issues) {
                if (issue.severity === 'critical') criticalCount++;
                else if (issue.severity === 'warning') warningCount++;
                else infoCount++;
            }
        }

        const avgScore = products.length > 0
            ? Math.round(products.reduce((sum, p) => sum + p.seoScore, 0) / products.length)
            : 0;

        const result: SEOAuditResult = {
            totalProducts: cards.length,
            auditedProducts: products.length,
            avgSeoScore: avgScore,
            issuesBreakdown: {
                critical: criticalCount,
                warning: warningCount,
                info: infoCount,
            },
            categoryBreakdown: categoryBreakdownResult,
            products,
        };

        return NextResponse.json({ success: true, data: result });

    } catch (error) {
        console.error('[SEO API] Error:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}
