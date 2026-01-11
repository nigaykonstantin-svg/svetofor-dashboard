'use client';

import { useState, useMemo } from 'react';
import orgData from '@/data/org-structure.json';

interface Employee {
    id: string;
    fullName: string;
    position: string;
    email: string;
    phone: string;
    unit: string;
    department: string;
    isLeader: boolean;
}

interface Unit {
    name: string;
    employeeCount: number;
    employeeIds: string[];
}

interface Department {
    id: string;
    name: string;
    icon: string;
    employeeCount: number;
    leaders: { id: string; name: string; position: string }[];
    units: Unit[];
}

interface OrgData {
    meta: {
        generatedAt: string;
        totalEmployees: number;
        totalDepartments: number;
        totalUnits: number;
    };
    departments: Department[];
    employees: Employee[];
}

const data = orgData as OrgData;

export default function OrgChart() {
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const selectedDepartment = useMemo(() => {
        return data.departments.find(d => d.id === selectedDept);
    }, [selectedDept]);

    // Get leaders for selected department
    const departmentLeaders = useMemo(() => {
        if (!selectedDept) {
            // All leaders across all departments
            return data.employees
                .filter(e => e.isLeader)
                .sort((a, b) => a.department.localeCompare(b.department));
        }
        const dept = data.departments.find(d => d.id === selectedDept);
        if (!dept) return [];
        return data.employees.filter(e => e.department === dept.name && e.isLeader);
    }, [selectedDept]);

    const filteredEmployees = useMemo(() => {
        let employees = data.employees;

        // Filter by department
        if (selectedDept) {
            const dept = data.departments.find(d => d.id === selectedDept);
            if (dept) {
                employees = employees.filter(e => e.department === dept.name);
            }
        }

        // Filter by unit
        if (selectedUnit) {
            employees = employees.filter(e => e.unit === selectedUnit);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            employees = employees.filter(e =>
                e.fullName.toLowerCase().includes(query) ||
                e.position.toLowerCase().includes(query) ||
                e.email.toLowerCase().includes(query)
            );
        }

        // Sort: leaders first, then by name
        return employees.sort((a, b) => {
            if (a.isLeader && !b.isLeader) return -1;
            if (!a.isLeader && b.isLeader) return 1;
            return a.fullName.localeCompare(b.fullName);
        });
    }, [selectedDept, selectedUnit, searchQuery]);

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    icon="👥"
                    label="Сотрудников"
                    value={data.meta.totalEmployees}
                    color="emerald"
                />
                <StatCard
                    icon="🏢"
                    label="Департаментов"
                    value={data.meta.totalDepartments}
                    color="blue"
                />
                <StatCard
                    icon="📋"
                    label="Подразделений"
                    value={data.meta.totalUnits}
                    color="purple"
                />
                <StatCard
                    icon="👔"
                    label="Руководителей"
                    value={data.employees.filter(e => e.isLeader).length}
                    color="amber"
                />
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="🔍 Поиск по ФИО, должности, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl 
                             text-white placeholder-slate-500 focus:outline-none focus:ring-2 
                             focus:ring-emerald-500/50 focus:border-emerald-500"
                />
            </div>

            {/* Main Content - Full Width Layout */}
            <div className="space-y-6">
                {/* Departments Row - Horizontal scrollable */}
                <div className="bg-slate-800/30 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-white mb-4">Департаменты</h3>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => { setSelectedDept(null); setSelectedUnit(null); }}
                            className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${!selectedDept
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                        >
                            📊 Все ({data.meta.totalEmployees})
                        </button>
                        {data.departments.map((dept) => (
                            <button
                                key={dept.id}
                                onClick={() => { setSelectedDept(dept.id); setSelectedUnit(null); }}
                                className={`px-4 py-2 rounded-xl transition-all whitespace-nowrap ${selectedDept === dept.id
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {dept.icon} {dept.name} ({dept.employeeCount})
                            </button>
                        ))}
                    </div>
                </div>

                {/* Units (show when department selected) */}
                {selectedDepartment && (
                    <div className="bg-slate-800/30 rounded-xl p-4">
                        <h3 className="text-lg font-semibold text-white mb-3">
                            {selectedDepartment.icon} {selectedDepartment.name} — Подразделения
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedUnit(null)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all ${!selectedUnit
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                Все ({selectedDepartment.employeeCount})
                            </button>
                            {selectedDepartment.units.map((unit) => (
                                <button
                                    key={unit.name}
                                    onClick={() => setSelectedUnit(unit.name)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${selectedUnit === unit.name
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {unit.name} ({unit.employeeCount})
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Leaders Section - Always visible */}
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 rounded-xl p-5 border border-amber-500/30">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                        <span className="text-2xl">👔</span>
                        Руководители {selectedDepartment ? selectedDepartment.name : 'компании'}
                        <span className="px-2 py-1 bg-amber-500/20 rounded-lg text-amber-400 text-sm font-medium">
                            {departmentLeaders.length} чел.
                        </span>
                    </h3>
                    {departmentLeaders.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {departmentLeaders.slice(0, 15).map((leader) => (
                                <div
                                    key={leader.id}
                                    className="bg-slate-800/70 rounded-xl p-4 hover:bg-slate-800 transition-all hover:scale-[1.02] border border-slate-700/50"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-lg shadow-amber-500/20">
                                            {leader.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-white text-base">{leader.fullName}</div>
                                            <div className="text-sm text-amber-400 mt-0.5">{leader.position}</div>
                                            <div className="text-xs text-slate-400 mt-2">{leader.unit}</div>
                                            <a
                                                href={`mailto:${leader.email}`}
                                                className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                                            >
                                                📧 {leader.email}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-slate-500 text-center py-4">
                            Руководители не найдены
                        </div>
                    )}
                    {departmentLeaders.length > 15 && (
                        <div className="text-center text-slate-400 text-sm mt-4 py-2 bg-slate-800/30 rounded-lg">
                            Показано 15 из {departmentLeaders.length} руководителей
                        </div>
                    )}
                </div>

                {/* Employees Table - Full Width */}
                <div className="bg-slate-800/30 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-slate-700">
                        <h3 className="text-lg font-semibold text-white">
                            Сотрудники ({filteredEmployees.length})
                        </h3>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="max-h-[600px] overflow-y-auto">
                            <table className="w-full min-w-[900px]">
                                <thead className="bg-slate-800/50 sticky top-0">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 w-[200px]">ФИО</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 w-[250px]">Должность</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 w-[250px]">Подразделение</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400 w-[200px]">Email</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50">
                                    {filteredEmployees.slice(0, 100).map((emp) => (
                                        <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {emp.isLeader && <span title="Руководитель">👔</span>}
                                                    <span className="text-white font-medium">{emp.fullName}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-300 text-sm">
                                                {emp.position || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-sm">
                                                {emp.unit}
                                            </td>
                                            <td className="px-4 py-3 text-slate-400 text-sm">
                                                <a href={`mailto:${emp.email}`} className="hover:text-emerald-400 transition-colors">
                                                    {emp.email}
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {filteredEmployees.length > 100 && (
                                <div className="p-4 text-center text-slate-500 text-sm border-t border-slate-700">
                                    Показано 100 из {filteredEmployees.length} сотрудников
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color }: {
    icon: string;
    label: string;
    value: number;
    color: 'emerald' | 'blue' | 'purple' | 'amber'
}) {
    const colorClasses = {
        emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-400',
        blue: 'from-blue-500/20 to-blue-500/5 text-blue-400',
        purple: 'from-purple-500/20 to-purple-500/5 text-purple-400',
        amber: 'from-amber-500/20 to-amber-500/5 text-amber-400',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 border border-slate-700/50`}>
            <div className="flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                    <div className="text-2xl font-bold text-white">{value}</div>
                    <div className="text-sm text-slate-400">{label}</div>
                </div>
            </div>
        </div>
    );
}
