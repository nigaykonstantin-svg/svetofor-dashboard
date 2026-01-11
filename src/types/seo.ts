// SEO Module Types

export interface SEOProduct {
    nmId: number;
    sku: string;
    title: string;
    category: string;
    subCategory: string;
    brandManager: string;
    categoryManager: string;
    // Card completeness metrics
    hasTitle: boolean;
    titleLength: number;
    hasDescription: boolean;
    descriptionLength: number;
    photoCount: number;
    hasVideo: boolean;
    characteristicsCount: number;
    // SEO score (0-100)
    seoScore: number;
    // Issues
    issues: SEOIssue[];
}

export interface SEOIssue {
    type: 'title' | 'description' | 'photos' | 'video' | 'characteristics' | 'keywords';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    recommendation: string;
}

export interface SEOAuditResult {
    totalProducts: number;
    auditedProducts: number;
    avgSeoScore: number;
    issuesBreakdown: {
        critical: number;
        warning: number;
        info: number;
    };
    categoryBreakdown: Record<string, {
        count: number;
        avgScore: number;
    }>;
    products: SEOProduct[];
}

export interface SEORecommendation {
    nmId: number;
    sku: string;
    type: 'title' | 'description' | 'keywords';
    currentValue: string;
    suggestedValue: string;
    expectedImpact: string;
}

// Card audit checklist
export interface CardAuditChecklist {
    titleHasKeywords: boolean;
    titleOptimalLength: boolean; // 60-80 chars
    descriptionFilled: boolean;
    descriptionOptimalLength: boolean; // > 500 chars
    photosMinimum: boolean; // >= 5
    hasVideo: boolean;
    allCharacteristicsFilled: boolean;
    hasRichContent: boolean; // infographics
}
