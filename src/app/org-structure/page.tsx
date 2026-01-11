'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { AppLayout } from '@/components/layout';
import OrgChart from '@/components/org-structure/OrgChart';

export default function OrgStructurePage() {
    const router = useRouter();
    const { isSuperAdmin, isLoading, isAuthenticated } = useAuth();

    // Redirect non-admins
    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !isSuperAdmin)) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, isSuperAdmin, router]);

    // Show loading while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-slate-400">Загрузка...</div>
            </div>
        );
    }

    // Don't render if not admin
    if (!isSuperAdmin) {
        return null;
    }

    return (
        <AppLayout>
            <div className="p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        🏢 Организационная структура
                    </h1>
                    <p className="text-slate-400">
                        Матричная структура MIXIT • 527 сотрудников • 19 департаментов
                    </p>
                </div>

                {/* Org Chart */}
                <OrgChart />
            </div>
        </AppLayout>
    );
}
