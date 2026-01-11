'use client';

import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import SEODashboard from '@/components/seo/SEODashboard';

export default function SEOPage() {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4 animate-pulse">🔍</div>
                    <div className="text-slate-400">Загрузка...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return <SEODashboard />;
}
