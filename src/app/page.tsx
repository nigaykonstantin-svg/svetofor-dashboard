'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import UserHeader from '@/components/auth/UserHeader';
import AiInsightsPanel from '@/components/AiInsightsPanel';
import SettingsPanel from '@/components/SettingsPanel';
import AnalyticsChart from '@/components/AnalyticsChart';
import PeriodSelector from '@/components/PeriodSelector';
import DeltaBadge from '@/components/DeltaBadge';
import { KPICards, SignalClusters, CategoryTabs, SKUTableSection, CLUSTER_CONFIG } from '@/components/dashboard';
import { TaskModal, TaskControlPanel, TaskDetailModal, TaskList, useTasks, Task, TaskStatus, TaskSKU } from '@/components/tasks';
import { useAuth } from '@/lib/useAuth';
import { SKUData, SvetoforData, SortField, SortDirection, formatMoney } from '@/types';

export default function SvetoforDashboard() {
  const [data, setData] = useState<SvetoforData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('orderSum');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAllSKUs, setShowAllSKUs] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);

  // Advanced filters
  const [filters, setFilters] = useState({
    stockMin: '',
    stockMax: '',
    daysMin: '',
    daysMax: '',
    ctrMin: '',
    ctrMax: '',
    crMin: '',
    crMax: '',
    drrMin: '',
    drrMax: '',
    salesMin: '',
    salesMax: '',
  });

  // Column visibility
  const [columns, setColumns] = useState({
    sku: true,
    title: true,
    brandName: false,
    subjectName: false,
    category: false,
    subCategory: false,
    // Managers
    brandManager: false,
    categoryManager: false,
    // Stocks
    stock: true,
    inTransit: false,
    stocksWb: false,
    stocksMp: false,
    // Velocity
    salesPerDay: true,
    coverDays: true,
    // Funnel counts
    views: false,
    cartCount: false,
    orderCount: false,
    buyoutCount: false,
    buyoutSum: false,
    // Conversions
    ctr: true,
    crCart: false,
    crOrder: true,
    buyout: false,
    // Advert
    drr: true,
    advertSpend: false,
    // Revenue
    orderSum: true,
    signal: true,
  });

  // Period selector - default to yesterday (1 day)
  const [period, setPeriod] = useState(1);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | undefined>(undefined);

  // Category filter
  const CATEGORIES = ['Все', 'Лицо', 'Тело', 'Макияж', 'Волосы'];
  const [selectedCategory, setSelectedCategory] = useState('Все');

  // AI Analysis panel
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Settings panel
  const [showSettings, setShowSettings] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Task management - using new modular system
  const [selectedSKUs, setSelectedSKUs] = useState<Set<number>>(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const { user, isSuperAdmin, isCategoryManager } = useAuth();
  const router = useRouter();

  // Use the new tasks hook
  const {
    tasks,
    addTask,
    updateTaskStatus,
    deleteTask,
    getTasksForUser,
    getTaskStats
  } = useTasks();

  // Get tasks visible to current user
  const userTasks = useMemo(() => {
    if (!user) return [];
    return getTasksForUser(user.id, user.role, user.categoryId);
  }, [user, tasks, getTasksForUser]);

  const taskStats = useMemo(() => getTaskStats(userTasks), [userTasks, getTaskStats]);

  // Can current user see task control panel?
  const canSeeTaskControl = isSuperAdmin || isCategoryManager;

  useEffect(() => {
    fetchData();
  }, [period]);

  async function fetchData() {
    try {
      setLoading(true);
      const response = await fetch(`/api/svetofor?period=${period}`);
      const result = await response.json();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  // Combine all SKUs into one array
  const allSKUs = useMemo(() => {
    if (!data) return [];
    const combined: (SKUData & { signalType: string })[] = [];

    Object.entries(data.data).forEach(([type, items]) => {
      items.forEach(item => {
        // Avoid duplicates
        if (!combined.find(x => x.nmId === item.nmId)) {
          combined.push({ ...item, signalType: type });
        }
      });
    });

    return combined;
  }, [data]);

  // Filter and sort
  const filteredSKUs = useMemo(() => {
    let result = showAllSKUs
      ? allSKUs
      : selectedCluster
        ? allSKUs.filter(s => s.signalType === selectedCluster)
        : [];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.sku.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.nmId.toString().includes(q)
      );
    }

    // Category filter - using categoryWB from matrix
    if (selectedCategory !== 'Все') {
      const categoryMap: Record<string, string[]> = {
        'Лицо': ['Уход за лицом'],
        'Тело': ['Уход за телом'],
        'Макияж': ['Макияж'],
        'Волосы': ['Уход за волосами'],
      };
      const allowedCategories = categoryMap[selectedCategory] || [];
      result = result.filter(s =>
        allowedCategories.some(cat =>
          s.category?.toLowerCase() === cat.toLowerCase()
        )
      );
    }

    // Advanced filters
    if (filters.stockMin) result = result.filter(s => s.stockTotal >= parseFloat(filters.stockMin));
    if (filters.stockMax) result = result.filter(s => s.stockTotal <= parseFloat(filters.stockMax));
    if (filters.daysMin) result = result.filter(s => parseFloat(s.stockCoverDays) >= parseFloat(filters.daysMin));
    if (filters.daysMax) result = result.filter(s => parseFloat(s.stockCoverDays) <= parseFloat(filters.daysMax));
    if (filters.ctrMin) result = result.filter(s => parseFloat(s.crCart || '0') >= parseFloat(filters.ctrMin));
    if (filters.ctrMax) result = result.filter(s => parseFloat(s.crCart || '0') <= parseFloat(filters.ctrMax));
    if (filters.crMin) result = result.filter(s => parseFloat(s.crOrder || '0') >= parseFloat(filters.crMin));
    if (filters.crMax) result = result.filter(s => parseFloat(s.crOrder || '0') <= parseFloat(filters.crMax));
    if (filters.drrMin) result = result.filter(s => parseFloat(s.drr || '0') >= parseFloat(filters.drrMin));
    if (filters.drrMax) result = result.filter(s => parseFloat(s.drr || '0') <= parseFloat(filters.drrMax));
    if (filters.salesMin) result = result.filter(s => parseFloat(s.ordersPerDay) >= parseFloat(filters.salesMin));
    if (filters.salesMax) result = result.filter(s => parseFloat(s.ordersPerDay) <= parseFloat(filters.salesMax));

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'sku': aVal = a.sku; bVal = b.sku; break;
        case 'title': aVal = a.title; bVal = b.title; break;
        case 'stockTotal': aVal = a.stockTotal; bVal = b.stockTotal; break;
        case 'ordersPerDay': aVal = parseFloat(a.ordersPerDay) || 0; bVal = parseFloat(b.ordersPerDay) || 0; break;
        case 'stockCoverDays': aVal = parseFloat(a.stockCoverDays) || 999; bVal = parseFloat(b.stockCoverDays) || 999; break;
        case 'crCart': aVal = parseFloat(a.crCart || '0'); bVal = parseFloat(b.crCart || '0'); break;
        case 'crOrder': aVal = parseFloat(a.crOrder || '0'); bVal = parseFloat(b.crOrder || '0'); break;
        case 'drr': aVal = parseFloat(a.drr || '0'); bVal = parseFloat(b.drr || '0'); break;
        case 'orderSum': aVal = a.orderSum; bVal = b.orderSum; break;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [allSKUs, selectedCluster, searchQuery, sortField, sortDirection, showAllSKUs, filters, selectedCategory]);

  // Pagination calculations (after filteredSKUs)
  const totalPages = Math.ceil(filteredSKUs.length / itemsPerPage);
  const paginatedSKUs = filteredSKUs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCluster, searchQuery, selectedCategory, filters, showAllSKUs]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportToExcel = () => {
    if (filteredSKUs.length === 0) return;

    const headers = ['Артикул', 'nmId', 'Название', 'Категория', 'Остаток', 'В пути', 'Продаж/день', 'Дней покрытия', 'CTR%', 'CR%', 'Выкуп%', 'ДРР%', 'Выручка', 'Сигнал'];
    const rows = filteredSKUs.map(s => [
      s.sku,
      s.nmId,
      `"${s.title.replace(/"/g, '""')}"`,
      s.category,
      s.stockTotal,
      s.inTransit,
      s.ordersPerDay,
      s.stockCoverDays,
      s.crCart || '',
      s.crOrder || '',
      s.buyoutPercent || '',
      s.drr || '',
      s.orderSum,
      s.signals[0]?.type || ''
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wb_analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle task creation from new TaskModal
  const handleCreateTask = (task: Task) => {
    addTask(task);
    setSelectedSKUs(new Set());
  };

  // Handle task status update
  const handleUpdateTaskStatus = (taskId: string, status: TaskStatus, completionComment?: string) => {
    updateTaskStatus(taskId, status, user?.id, user?.name, completionComment);
  };

  // Get selected SKUs for task creation
  const selectedSKUsForTask: TaskSKU[] = useMemo(() => {
    return filteredSKUs
      .filter(s => selectedSKUs.has(s.nmId))
      .map(s => ({ nmId: s.nmId, sku: s.sku, title: s.title }));
  }, [filteredSKUs, selectedSKUs]);

  // Toggle SKU selection
  const toggleSKU = (nmId: number) => {
    const newSet = new Set(selectedSKUs);
    if (newSet.has(nmId)) {
      newSet.delete(nmId);
    } else {
      newSet.add(nmId);
    }
    setSelectedSKUs(newSet);
  };

  // Select all visible SKUs
  const selectAllVisible = () => {
    if (selectedSKUs.size === filteredSKUs.length) {
      setSelectedSKUs(new Set());
    } else {
      setSelectedSKUs(new Set(filteredSKUs.map(s => s.nmId)));
    }
  };

  // Calculate clusters for selected category
  const categoryClusters = useMemo(() => {
    if (!allSKUs.length) return null;

    let skusForClusters = allSKUs;

    // Filter by category
    if (selectedCategory !== 'Все') {
      const categoryMap: Record<string, string[]> = {
        'Лицо': ['Уход за лицом'],
        'Тело': ['Уход за телом'],
        'Макияж': ['Макияж'],
        'Волосы': ['Уход за волосами'],
      };
      const allowedCategories = categoryMap[selectedCategory] || [];
      skusForClusters = allSKUs.filter(s =>
        allowedCategories.some(cat =>
          s.category?.toLowerCase() === cat.toLowerCase()
        )
      );
    }

    // Count signals by type
    const counts = {
      OOS_NOW: 0,
      HIGH_DRR: 0,
      OOS_SOON: 0,
      LOW_CTR: 0,
      LOW_CR: 0,
      LOW_BUYOUT: 0,
      OVERSTOCK: 0,
      ABOVE_MARKET: 0,
    };

    skusForClusters.forEach(sku => {
      sku.signals.forEach(signal => {
        if (signal.type in counts) {
          counts[signal.type as keyof typeof counts]++;
        }
      });
    });

    return counts;
  }, [allSKUs, selectedCategory]);

  // Calculate KPIs — respects category filter
  const kpis = useMemo(() => {
    if (!data) return null;

    // Filter SKUs by category first (same logic as filteredSKUs)
    let skusForKPI = allSKUs;

    if (selectedCategory !== 'Все') {
      const categoryMap: Record<string, string[]> = {
        'Лицо': ['Уход за лицом'],
        'Тело': ['Уход за телом'],
        'Макияж': ['Макияж'],
        'Волосы': ['Уход за волосами'],
      };
      const allowedCategories = categoryMap[selectedCategory] || [];
      skusForKPI = allSKUs.filter(s =>
        allowedCategories.some(cat =>
          s.category?.toLowerCase() === cat.toLowerCase()
        )
      );
    }

    const totalOrderSum = skusForKPI.reduce((sum, s) => sum + (s.orderSum || 0), 0);
    const totalOrders = skusForKPI.reduce((sum, s) => sum + (s.orderCount || 0), 0);
    const avgCheck = totalOrders > 0 ? totalOrderSum / totalOrders : 0;
    const skusWithDRR = skusForKPI.filter(s => s.drr && parseFloat(s.drr) > 0);
    const avgDRR = skusWithDRR.length > 0
      ? skusWithDRR.reduce((sum, s) => sum + parseFloat(s.drr || '0'), 0) / skusWithDRR.length
      : 0;
    const skuCount = skusForKPI.length;

    return { totalOrderSum, totalOrders, avgCheck, avgDRR, skuCount };
  }, [data, allSKUs, period, selectedCategory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-xl text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <div className="text-slate-400">Загрузка данных WB API...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-red-400 text-xl mb-4">Ошибка: {error}</div>
          <button onClick={fetchData} className="px-6 py-3 bg-emerald-600 rounded-lg hover:bg-emerald-700 transition">
            Повторить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <span className="text-3xl">🚦</span> WB Analytics Dashboard
            </h1>
            <p className="text-slate-500 text-sm">
              MIXIT • {data?.totalSKUs.toLocaleString()} SKU • {new Date(data?.timestamp || '').toLocaleString('ru-RU')}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period Selector */}
            <PeriodSelector
              period={period}
              onPeriodChange={(p) => {
                setPeriod(p);
                setCustomDateRange(undefined);
              }}
              dateRange={customDateRange}
              onDateRangeChange={setCustomDateRange}
              comparisonEnabled={comparisonEnabled}
              onComparisonToggle={setComparisonEnabled}
            />
            <button
              onClick={fetchData}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2"
            >
              <span className="text-lg">🔄</span> Обновить
            </button>

            {/* AI Analysis Button */}
            <button
              onClick={() => setShowAiPanel(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg transition flex items-center gap-2 shadow-lg"
            >
              <span className="text-lg">🤖</span> AI Анализ
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2"
            >
              <span className="text-lg">⚙️</span> Настройки
            </button>

            {/* User Profile */}
            <UserHeader />
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Category Tabs */}
        <CategoryTabs
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />

        {/* KPI Cards */}
        <KPICards kpis={kpis} period={period} />

        {/* Analytics Chart */}
        <div className="mb-6">
          <AnalyticsChart category={selectedCategory} period={period} />
        </div>

        {/* Signal Clusters */}
        <SignalClusters
          clusters={categoryClusters}
          selectedCluster={selectedCluster}
          showAllSKUs={showAllSKUs}
          onClusterSelect={(cluster) => { setSelectedCluster(cluster); setShowAllSKUs(false); }}
          onShowAllToggle={() => { setShowAllSKUs(!showAllSKUs); setSelectedCluster(null); }}
        />

        {/* Task Control Panel - for admins/category managers */}
        {canSeeTaskControl && userTasks.length > 0 && (
          <div className="mb-6">
            <TaskControlPanel
              tasks={userTasks}
              onFilterByStatus={() => { }}
              onFilterByAssignee={() => { }}
              onViewAllTasks={() => router.push('/tasks')}
            />
          </div>
        )}

        {/* Quick Tasks Link */}
        {user && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => router.push('/tasks')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center gap-2 text-sm"
            >
              <span>📋</span>
              {canSeeTaskControl ? 'Управление задачами' : 'Мои задачи'}
              {taskStats.total > 0 && (
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {taskStats.total - taskStats.done}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Search and Filters */}
        {(selectedCluster || showAllSKUs) && (
          <div className="bg-slate-900 rounded-xl p-4 mb-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-64">
                <input
                  type="text"
                  placeholder="🔍 Поиск по артикулу, названию, nmId..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm ${showFilters ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
              >
                <span>🎛️</span> Фильтры
              </button>
              <button
                onClick={() => setShowColumns(!showColumns)}
                className={`px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm ${showColumns ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700'
                  }`}
              >
                <span>📋</span> Колонки
              </button>
              <div className="text-slate-400 text-sm">
                Найдено: <span className="text-white font-semibold">{filteredSKUs.length}</span> SKU
                {selectedSKUs.size > 0 && (
                  <span className="ml-2 text-emerald-400">
                    ({selectedSKUs.size} выбрано)
                  </span>
                )}
              </div>
              {selectedSKUs.size > 0 && (
                <button
                  onClick={() => setShowTaskModal(true)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition flex items-center gap-2 text-sm"
                >
                  <span>📤</span> Создать задачу
                </button>
              )}
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition flex items-center gap-2 text-sm"
              >
                <span>📥</span> Экспорт
              </button>
            </div>

            {/* Column Selector */}
            {showColumns && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-slate-400 mb-2">Показать колонки:</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'sku', label: 'Артикул' },
                    { key: 'title', label: 'Название' },
                    { key: 'brandName', label: 'Бренд' },
                    { key: 'subjectName', label: 'Предмет' },
                    { key: 'category', label: 'Категория' },
                    { key: 'subCategory', label: 'Суб-категория' },
                    { key: 'brandManager', label: 'Бренд-менеджер' },
                    { key: 'categoryManager', label: 'Катег. менедж.' },
                    { key: 'stock', label: 'Остаток' },
                    { key: 'inTransit', label: 'В пути' },
                    { key: 'stocksWb', label: 'Остаток WB' },
                    { key: 'stocksMp', label: 'Остаток МП' },
                    { key: 'salesPerDay', label: 'Продаж/день' },
                    { key: 'coverDays', label: 'Дней' },
                    { key: 'views', label: 'Просмотры' },
                    { key: 'cartCount', label: 'В корзину' },
                    { key: 'orderCount', label: 'Заказы шт' },
                    { key: 'buyoutCount', label: 'Выкупы шт' },
                    { key: 'buyoutSum', label: 'Выкупы ₽' },
                    { key: 'ctr', label: 'CTR %' },
                    { key: 'crCart', label: 'CR корзина' },
                    { key: 'crOrder', label: 'CR заказ' },
                    { key: 'buyout', label: 'Выкуп %' },
                    { key: 'drr', label: 'ДРР' },
                    { key: 'advertSpend', label: 'Расход рек.' },
                    { key: 'orderSum', label: 'Выручка' },
                    { key: 'signal', label: 'Сигнал' },
                  ].map(col => (
                    <label
                      key={col.key}
                      className={`px-3 py-1 rounded-full text-sm cursor-pointer transition ${columns[col.key as keyof typeof columns]
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={columns[col.key as keyof typeof columns]}
                        onChange={(e) => setColumns({ ...columns, [col.key]: e.target.checked })}
                        className="sr-only"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Expandable Filter Panel */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Остаток</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.stockMin}
                      onChange={(e) => setFilters({ ...filters, stockMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.stockMax}
                      onChange={(e) => setFilters({ ...filters, stockMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Дней покрытия</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.daysMin}
                      onChange={(e) => setFilters({ ...filters, daysMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.daysMax}
                      onChange={(e) => setFilters({ ...filters, daysMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">CTR %</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.ctrMin}
                      onChange={(e) => setFilters({ ...filters, ctrMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.ctrMax}
                      onChange={(e) => setFilters({ ...filters, ctrMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">CR %</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.crMin}
                      onChange={(e) => setFilters({ ...filters, crMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.crMax}
                      onChange={(e) => setFilters({ ...filters, crMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">ДРР %</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.drrMin}
                      onChange={(e) => setFilters({ ...filters, drrMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.drrMax}
                      onChange={(e) => setFilters({ ...filters, drrMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Продаж/день</label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.salesMin}
                      onChange={(e) => setFilters({ ...filters, salesMin: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.salesMax}
                      onChange={(e) => setFilters({ ...filters, salesMax: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sm"
                    />
                  </div>
                </div>
                <div className="col-span-full flex justify-end">
                  <button
                    onClick={() => setFilters({ stockMin: '', stockMax: '', daysMin: '', daysMax: '', ctrMin: '', ctrMax: '', crMin: '', crMax: '', drrMin: '', drrMax: '', salesMin: '', salesMax: '' })}
                    className="px-3 py-1 text-sm text-slate-400 hover:text-white transition"
                  >
                    ✕ Сбросить фильтры
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Table */}
        {(selectedCluster || showAllSKUs) && filteredSKUs.length > 0 && (
          <div className="bg-slate-900 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-slate-400">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedSKUs.size === filteredSKUs.length && filteredSKUs.length > 0}
                        onChange={selectAllVisible}
                        className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    {columns.sku && <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort('sku')}>Артикул {sortField === 'sku' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.title && <th className="text-left p-3 cursor-pointer hover:text-white" onClick={() => handleSort('title')}>Название {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.brandName && <th className="text-left p-3">Бренд</th>}
                    {columns.subjectName && <th className="text-left p-3">Предмет</th>}
                    {columns.category && <th className="text-left p-3">Категория</th>}
                    {columns.subCategory && <th className="text-left p-3">Суб-категория</th>}
                    {columns.brandManager && <th className="text-left p-3">Бренд-менеджер</th>}
                    {columns.categoryManager && <th className="text-left p-3">Катег. менедж.</th>}
                    {columns.stock && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('stockTotal')}>Остаток {sortField === 'stockTotal' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.inTransit && <th className="text-right p-3">В пути</th>}
                    {columns.stocksWb && <th className="text-right p-3">Ост. WB</th>}
                    {columns.stocksMp && <th className="text-right p-3">Ост. МП</th>}
                    {columns.salesPerDay && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('ordersPerDay')}>Продаж/день {sortField === 'ordersPerDay' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.coverDays && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('stockCoverDays')}>Дней {sortField === 'stockCoverDays' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.views && <th className="text-right p-3">Просмотры</th>}
                    {columns.cartCount && <th className="text-right p-3">В корзину</th>}
                    {columns.orderCount && <th className="text-right p-3">Заказы шт</th>}
                    {columns.buyoutCount && <th className="text-right p-3">Выкупы шт</th>}
                    {columns.buyoutSum && <th className="text-right p-3">Выкупы ₽</th>}
                    {columns.ctr && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('crCart')}>CTR% {sortField === 'crCart' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.crCart && <th className="text-right p-3">CR корзина</th>}
                    {columns.crOrder && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('crOrder')}>CR заказ {sortField === 'crOrder' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.buyout && <th className="text-right p-3">Выкуп%</th>}
                    {columns.drr && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('drr')}>ДРР {sortField === 'drr' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.advertSpend && <th className="text-right p-3">Расход рек.</th>}
                    {columns.orderSum && <th className="text-right p-3 cursor-pointer hover:text-white" onClick={() => handleSort('orderSum')}>Выручка {sortField === 'orderSum' && (sortDirection === 'asc' ? '↑' : '↓')}</th>}
                    {columns.signal && <th className="text-left p-3">Сигнал</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedSKUs.map((item) => {
                    const coverDays = parseFloat(item.stockCoverDays) || 0;
                    const drrVal = parseFloat(item.drr || '0');

                    return (
                      <tr
                        key={item.nmId}
                        className={`border-b border-slate-800 hover:bg-slate-800/50 transition ${selectedSKUs.has(item.nmId) ? 'bg-emerald-900/20' : ''}`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedSKUs.has(item.nmId)}
                            onChange={() => toggleSKU(item.nmId)}
                            className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                          />
                        </td>
                        {columns.sku && (
                          <td className="p-3 font-mono text-xs">
                            <a
                              href={`https://www.wildberries.ru/catalog/${item.nmId}/detail.aspx`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-emerald-400 transition"
                            >
                              {item.sku}
                            </a>
                          </td>
                        )}
                        {columns.title && (
                          <td className="p-3 max-w-xs truncate" title={item.title}>
                            <a
                              href={`https://www.wildberries.ru/catalog/${item.nmId}/detail.aspx`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-emerald-400 transition"
                            >
                              {item.title}
                            </a>
                          </td>
                        )}
                        {columns.brandName && <td className="p-3 text-slate-400">{item.brandName || '—'}</td>}
                        {columns.subjectName && <td className="p-3 text-slate-400">{item.subjectName || '—'}</td>}
                        {columns.category && <td className="p-3 text-slate-400">{item.category || '—'}</td>}
                        {columns.subCategory && <td className="p-3 text-slate-400">{item.subCategory || '—'}</td>}
                        {columns.brandManager && <td className="p-3 text-purple-400 text-sm">{item.brandManager || '—'}</td>}
                        {columns.categoryManager && <td className="p-3 text-cyan-400 text-sm">{item.categoryManager || '—'}</td>}
                        {columns.stock && <td className="p-3 text-right font-mono">{item.stockTotal.toLocaleString()}</td>}
                        {columns.inTransit && <td className="p-3 text-right font-mono text-blue-400">{item.inTransit > 0 ? `+${item.inTransit}` : '—'}</td>}
                        {columns.stocksWb && <td className="p-3 text-right font-mono">{(item.stocksWb || 0).toLocaleString()}</td>}
                        {columns.stocksMp && <td className="p-3 text-right font-mono">{(item.stocksMp || 0).toLocaleString()}</td>}
                        {columns.salesPerDay && <td className="p-3 text-right font-mono">{item.ordersPerDay}</td>}
                        {columns.coverDays && (
                          <td className={`p-3 text-right font-mono font-semibold ${coverDays < 7 ? 'text-red-400' : coverDays < 14 ? 'text-orange-400' : coverDays > 90 ? 'text-blue-400' : 'text-green-400'
                            }`}>
                            {coverDays > 900 ? '∞' : item.stockCoverDays}
                          </td>
                        )}
                        {columns.views && <td className="p-3 text-right font-mono">{(item.openCount || 0).toLocaleString()}</td>}
                        {columns.cartCount && <td className="p-3 text-right font-mono">{(item.cartCount || 0).toLocaleString()}</td>}
                        {columns.orderCount && (
                          <td className="p-3 text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span>{(item.orderCount || 0).toLocaleString()}</span>
                              {comparisonEnabled && item.deltaOrderCount !== undefined && item.deltaOrderCount !== null && (
                                <DeltaBadge value={item.deltaOrderCount} format="percent" size="sm" />
                              )}
                            </div>
                          </td>
                        )}
                        {columns.buyoutCount && <td className="p-3 text-right font-mono">{(item.buyoutCount || 0).toLocaleString()}</td>}
                        {columns.buyoutSum && <td className="p-3 text-right font-mono">{item.buyoutSum ? formatMoney(item.buyoutSum) + ' ₽' : '—'}</td>}
                        {columns.ctr && (
                          <td className={`p-3 text-right font-mono ${parseFloat(item.crCart || '0') < 4 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            <div className="flex flex-col items-end">
                              <span>{item.crCart ? `${item.crCart}%` : '—'}</span>
                              {comparisonEnabled && item.deltaCrCart && (
                                <DeltaBadge value={item.deltaCrCart} format="points" size="sm" />
                              )}
                            </div>
                          </td>
                        )}
                        {columns.crCart && <td className="p-3 text-right font-mono text-slate-300">{item.crCart ? `${item.crCart}%` : '—'}</td>}
                        {columns.crOrder && (
                          <td className={`p-3 text-right font-mono ${parseFloat(item.crOrder || '0') < 25 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            <div className="flex flex-col items-end">
                              <span>{item.crOrder ? `${item.crOrder}%` : '—'}</span>
                              {comparisonEnabled && item.deltaCrOrder && (
                                <DeltaBadge value={item.deltaCrOrder} format="points" size="sm" />
                              )}
                            </div>
                          </td>
                        )}
                        {columns.buyout && <td className="p-3 text-right font-mono">{item.buyoutPercent ? `${item.buyoutPercent}%` : '—'}</td>}
                        {columns.drr && (
                          <td className={`p-3 text-right font-mono ${drrVal > 50 ? 'text-red-400 font-bold' : drrVal > 30 ? 'text-orange-400' : drrVal > 0 ? 'text-slate-300' : 'text-slate-600'
                            }`}>
                            {item.drr ? `${item.drr}%` : '—'}
                          </td>
                        )}
                        {columns.advertSpend && <td className="p-3 text-right font-mono">{item.advertSpend ? `${formatMoney(parseFloat(item.advertSpend))} ₽` : '—'}</td>}
                        {columns.orderSum && (
                          <td className="p-3 text-right font-mono">
                            <div className="flex flex-col items-end">
                              <span>{item.orderSum > 0 ? formatMoney(item.orderSum) + ' ₽' : '—'}</span>
                              {comparisonEnabled && item.deltaOrderSum !== undefined && item.deltaOrderSum !== null && (
                                <DeltaBadge value={item.deltaOrderSum} format="percent" size="sm" />
                              )}
                            </div>
                          </td>
                        )}
                        {columns.signal && (
                          <td className="p-3">
                            {item.signals[0] && (
                              <span className={`inline-block px-2 py-1 rounded text-xs ${item.signals[0].priority === 'critical' ? 'bg-red-500/20 text-red-400' :
                                item.signals[0].priority === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-green-500/20 text-green-400'
                                }`}>
                                {item.signals[0].type}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-t border-slate-700">
                <div className="text-slate-400 text-sm">
                  Показано {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredSKUs.length)} из {filteredSKUs.length} SKU
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ←
                  </button>
                  <span className="px-3 py-1 text-sm">
                    <span className="text-white font-semibold">{currentPage}</span>
                    <span className="text-slate-500"> / {totalPages}</span>
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    →
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!selectedCluster && !showAllSKUs && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-4">👆</div>
            <div className="text-lg">Выберите сигнал или нажмите "Показать все SKU"</div>
          </div>
        )}
      </main>

      {/* Task Creation Modal - using new modular component */}
      <TaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        selectedSKUs={selectedSKUsForTask}
        onCreateTask={handleCreateTask}
      />

      {/* Task Detail Modal */}
      {selectedTaskForDetail && (
        <TaskDetailModal
          task={selectedTaskForDetail}
          isOpen={true}
          onClose={() => setSelectedTaskForDetail(null)}
          onUpdateStatus={handleUpdateTaskStatus}
          onDelete={deleteTask}
        />
      )}

      {/* AI Insights Panel */}
      <AiInsightsPanel
        isOpen={showAiPanel}
        onClose={() => setShowAiPanel(false)}
        category={selectedCategory}
        period={period}
        kpis={kpis}
        clusters={data ? {
          OOS_NOW: data.data.OOS_NOW.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          OOS_SOON: data.data.OOS_SOON.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          HIGH_DRR: data.data.HIGH_DRR.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          LOW_CTR: data.data.LOW_CTR.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          LOW_CR: data.data.LOW_CR.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          LOW_BUYOUT: data.data.LOW_BUYOUT.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          OVERSTOCK: data.data.OVERSTOCK.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
          ABOVE_MARKET: data.data.ABOVE_MARKET.filter(s => selectedCategory === 'Все' || s.category?.toLowerCase().includes(selectedCategory.toLowerCase())),
        } : null}
        onCreateTask={(skus, taskType) => {
          // Set selected SKUs for task creation
          setSelectedSKUs(new Set(skus.map(s => s.nmId)));
          setShowAiPanel(false);
          setShowTaskModal(true);
        }}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
