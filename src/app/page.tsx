'use client';

import { useEffect, useState, useMemo } from 'react';
import UserHeader from '@/components/auth/UserHeader';
import AiInsightsPanel from '@/components/AiInsightsPanel';
import SettingsPanel from '@/components/SettingsPanel';
import PeriodSelector from '@/components/PeriodSelector';

interface Signal {
  type: string;
  priority: string;
  message: string;
}

interface SKUData {
  sku: string;
  nmId: number;
  title: string;
  category: string;
  subCategory?: string;
  brandName?: string;
  subjectName?: string;
  // Managers from matrix
  brandManager?: string;
  categoryManager?: string;
  // Stocks
  stockTotal: number;
  inTransit: number;
  effectiveStock: number;
  stocksWb?: number;
  stocksMp?: number;
  // Velocity
  ordersPerDay: string;
  stockCoverDays: string;
  // Funnel
  openCount?: number;
  cartCount?: number;
  orderCount?: number;
  buyoutCount?: number;
  buyoutSum?: number;
  // Conversions
  crCart?: string;
  crOrder?: string;
  buyoutPercent?: string;
  orderSum: number;
  // Advert
  drr?: string;
  advertSpend?: string;
  signals: Signal[];
}

interface SvetoforData {
  success: boolean;
  timestamp: string;
  totalSKUs: number;
  funnelSKUs?: number;
  clusters: {
    OOS_NOW: number;
    OOS_SOON: number;
    HIGH_DRR: number;
    LOW_CTR: number;
    LOW_CR: number;
    LOW_BUYOUT: number;
    OVERSTOCK: number;
    ABOVE_MARKET: number;
  };
  data: {
    OOS_NOW: SKUData[];
    OOS_SOON: SKUData[];
    HIGH_DRR: SKUData[];
    LOW_CTR: SKUData[];
    LOW_CR: SKUData[];
    LOW_BUYOUT: SKUData[];
    OVERSTOCK: SKUData[];
    ABOVE_MARKET: SKUData[];
  };
}

const CLUSTER_CONFIG: Record<string, { label: string; color: string; textColor: string; priority: number }> = {
  OOS_NOW: { label: '🚨 OOS', color: 'bg-red-500', textColor: 'text-red-500', priority: 1 },
  HIGH_DRR: { label: '💸 ДРР', color: 'bg-red-600', textColor: 'text-red-400', priority: 2 },
  OOS_SOON: { label: '⚠️ Скоро OOS', color: 'bg-orange-500', textColor: 'text-orange-400', priority: 3 },
  LOW_CTR: { label: '👁️ Low CTR', color: 'bg-purple-500', textColor: 'text-purple-400', priority: 4 },
  LOW_CR: { label: '🛒 Low CR', color: 'bg-yellow-500', textColor: 'text-yellow-400', priority: 5 },
  LOW_BUYOUT: { label: '📦 Низкий выкуп', color: 'bg-pink-500', textColor: 'text-pink-400', priority: 6 },
  OVERSTOCK: { label: '📦 Затоварка', color: 'bg-blue-500', textColor: 'text-blue-400', priority: 7 },
  ABOVE_MARKET: { label: '🏆 Топ', color: 'bg-green-500', textColor: 'text-green-400', priority: 8 },
};

function formatMoney(value: number): string {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
  return value.toLocaleString('ru-RU');
}

type SortField = 'sku' | 'title' | 'stockTotal' | 'ordersPerDay' | 'stockCoverDays' | 'crCart' | 'crOrder' | 'drr' | 'orderSum';
type SortDirection = 'asc' | 'desc';

export default function SvetoforDashboard() {
  const [data, setData] = useState<SvetoforData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('stockCoverDays');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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

  // Task management
  const [selectedSKUs, setSelectedSKUs] = useState<Set<number>>(new Set());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskForm, setTaskForm] = useState({
    type: 'optimize',
    assignee: '',
    deadline: '',
    comment: '',
  });

  // Task interface
  interface Task {
    id: string;
    skus: SKUData[];
    type: string;
    assignee: string;
    deadline: string;
    comment: string;
    status: 'new' | 'in_progress' | 'done';
    createdAt: string;
  }

  // Load tasks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('svetofor_tasks');
    if (saved) {
      setTasks(JSON.parse(saved));
    }
  }, []);

  // Save tasks to localStorage
  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem('svetofor_tasks', JSON.stringify(tasks));
    }
  }, [tasks]);

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

  // Task type labels
  const TASK_TYPES = {
    optimize: '🎯 Оптимизировать карточку',
    price_down: '📉 Снизить цену',
    price_up: '📈 Повысить цену',
    restock: '📦 Заказать поставку',
    ads: '📢 Проверить рекламу',
    photo: '📷 Обновить фото',
    other: '📝 Другое',
  };

  // Create task
  const createTask = () => {
    if (selectedSKUs.size === 0) return;

    const selectedItems = filteredSKUs.filter(s => selectedSKUs.has(s.nmId));
    const newTask: Task = {
      id: Date.now().toString(),
      skus: selectedItems,
      type: taskForm.type,
      assignee: taskForm.assignee,
      deadline: taskForm.deadline,
      comment: taskForm.comment,
      status: 'new',
      createdAt: new Date().toISOString(),
    };

    setTasks([...tasks, newTask]);
    setSelectedSKUs(new Set());
    setShowTaskModal(false);
    setTaskForm({ type: 'optimize', assignee: '', deadline: '', comment: '' });
  };

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
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${selectedCategory === cat
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
            >
              {cat === 'Все' && '🏠 '}
              {cat === 'Лицо' && '😊 '}
              {cat === 'Тело' && '🧴 '}
              {cat === 'Макияж' && '💄 '}
              {cat === 'Волосы' && '💇 '}
              {cat}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-emerald-900/50 to-emerald-950/50 rounded-xl p-5 border border-emerald-800/30">
              <div className="text-emerald-400 text-sm mb-1">Заказы ({period} дней)</div>
              <div className="text-3xl font-bold">{formatMoney(kpis.totalOrderSum)} ₽</div>
            </div>
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-950/50 rounded-xl p-5 border border-blue-800/30">
              <div className="text-blue-400 text-sm mb-1">Количество заказов</div>
              <div className="text-3xl font-bold">{kpis.totalOrders.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-950/50 rounded-xl p-5 border border-purple-800/30">
              <div className="text-purple-400 text-sm mb-1">Средний чек</div>
              <div className="text-3xl font-bold">{formatMoney(kpis.avgCheck)} ₽</div>
            </div>
            <div className={`bg-gradient-to-br rounded-xl p-5 border ${kpis.avgDRR > 30 ? 'from-red-900/50 to-red-950/50 border-red-800/30' :
              kpis.avgDRR > 20 ? 'from-yellow-900/50 to-yellow-950/50 border-yellow-800/30' :
                'from-green-900/50 to-green-950/50 border-green-800/30'
              }`}>
              <div className={`text-sm mb-1 ${kpis.avgDRR > 30 ? 'text-red-400' : kpis.avgDRR > 20 ? 'text-yellow-400' : 'text-green-400'
                }`}>Средний ДРР</div>
              <div className="text-3xl font-bold">{kpis.avgDRR.toFixed(1)}%</div>
            </div>
          </div>
        )}

        {/* Signal Clusters */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-300">Сигналы</h2>
            <button
              onClick={() => { setShowAllSKUs(!showAllSKUs); setSelectedCluster(null); }}
              className={`text-sm px-3 py-1 rounded-full transition ${showAllSKUs ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
            >
              {showAllSKUs ? '✓ Все SKU' : 'Показать все SKU'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.entries(CLUSTER_CONFIG).map(([key, config]) => {
              const count = categoryClusters?.[key as keyof typeof categoryClusters] || 0;
              const isSelected = selectedCluster === key;

              return (
                <button
                  key={key}
                  onClick={() => { setSelectedCluster(isSelected ? null : key); setShowAllSKUs(false); }}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${isSelected
                    ? `${config.color} text-white shadow-lg`
                    : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                >
                  <span className={isSelected ? 'text-white' : config.textColor}>{config.label}</span>
                  <span className={`px-2 py-0.5 rounded-full text-sm ${isSelected ? 'bg-white/20' : 'bg-slate-700'
                    }`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

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
                        {columns.orderCount && <td className="p-3 text-right font-mono">{(item.orderCount || 0).toLocaleString()}</td>}
                        {columns.buyoutCount && <td className="p-3 text-right font-mono">{(item.buyoutCount || 0).toLocaleString()}</td>}
                        {columns.buyoutSum && <td className="p-3 text-right font-mono">{item.buyoutSum ? formatMoney(item.buyoutSum) + ' ₽' : '—'}</td>}
                        {columns.ctr && (
                          <td className={`p-3 text-right font-mono ${parseFloat(item.crCart || '0') < 4 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            {item.crCart ? `${item.crCart}%` : '—'}
                          </td>
                        )}
                        {columns.crCart && <td className="p-3 text-right font-mono text-slate-300">{item.crCart ? `${item.crCart}%` : '—'}</td>}
                        {columns.crOrder && (
                          <td className={`p-3 text-right font-mono ${parseFloat(item.crOrder || '0') < 25 ? 'text-yellow-400' : 'text-slate-300'}`}>
                            {item.crOrder ? `${item.crOrder}%` : '—'}
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
                        {columns.orderSum && <td className="p-3 text-right font-mono">{item.orderSum > 0 ? formatMoney(item.orderSum) + ' ₽' : '—'}</td>}
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

      {/* Task Creation Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl w-full max-w-lg border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>📤</span> Создать задачу
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Выбрано товаров: <span className="text-white font-semibold">{selectedSKUs.size}</span>
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Task Type */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Тип задачи</label>
                <select
                  value={taskForm.type}
                  onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                >
                  {Object.entries(TASK_TYPES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Исполнитель</label>
                <input
                  type="text"
                  placeholder="Имя сотрудника..."
                  value={taskForm.assignee}
                  onChange={(e) => setTaskForm({ ...taskForm, assignee: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Срок выполнения</label>
                <input
                  type="date"
                  value={taskForm.deadline}
                  onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Комментарий</label>
                <textarea
                  placeholder="Инструкции для исполнителя..."
                  value={taskForm.comment}
                  onChange={(e) => setTaskForm({ ...taskForm, comment: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Selected SKUs preview */}
              <div className="bg-slate-800/50 rounded-lg p-3 max-h-32 overflow-y-auto">
                <div className="text-xs text-slate-500 mb-2">Товары в задаче:</div>
                <div className="space-y-1">
                  {filteredSKUs.filter(s => selectedSKUs.has(s.nmId)).slice(0, 5).map(s => (
                    <div key={s.nmId} className="text-sm truncate">
                      <span className="text-slate-500">{s.sku}</span>
                      <span className="ml-2">{s.title}</span>
                    </div>
                  ))}
                  {selectedSKUs.size > 5 && (
                    <div className="text-xs text-slate-500">...и ещё {selectedSKUs.size - 5} товаров</div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => setShowTaskModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Отмена
              </button>
              <button
                onClick={createTask}
                disabled={!taskForm.assignee}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Создать задачу
              </button>
            </div>
          </div>
        </div>
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
          setTaskForm({ ...taskForm, type: taskType });
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
