'use client';

import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';

interface AppLayoutProps {
    children: ReactNode;
    signalCounts?: {
        OOS_NOW?: number;
        OOS_SOON?: number;
        LOW_CTR?: number;
        LOW_CR?: number;
        HIGH_DRR?: number;
        OVERSTOCK?: number;
    };
    onSignalClick?: (signal: string) => void;
    selectedSignal?: string | null;
    hideSidebar?: boolean;
}

export default function AppLayout({
    children,
    signalCounts,
    onSignalClick,
    selectedSignal,
    hideSidebar = false,
}: AppLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    if (hideSidebar) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Sidebar */}
            <Sidebar
                isCollapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                signalCounts={signalCounts}
                onSignalClick={onSignalClick}
                selectedSignal={selectedSignal}
            />

            {/* Main Content - shifts based on sidebar width */}
            <main
                className={`
                    min-h-screen transition-all duration-300 ease-out
                    ${sidebarCollapsed ? 'ml-16' : 'ml-64'}
                `}
            >
                {children}
            </main>
        </div>
    );
}
