'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
}

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [users, setUsers] = useState<User[]>([]);

    // Fetch users from public API for dropdown
    useEffect(() => {
        fetch('/api/auth/users')
            .then(res => res.json())
            .then(data => {
                if (data.users) {
                    setUsers(data.users);
                }
            })
            .catch(() => {
                // Fallback if API not available
            });
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            setError('Введите email и пароль');
            return;
        }

        setIsLoading(true);
        setError('');

        const result = await signIn('credentials', {
            email,
            password,
            redirect: false,
            callbackUrl: '/'
        });

        if (result?.error) {
            setError('Неверный email или пароль');
            setIsLoading(false);
        } else if (result?.ok) {
            window.location.href = '/';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="text-5xl mb-3">🚦</div>
                    <h1 className="text-2xl font-bold text-white">Светофор</h1>
                </div>

                {/* Login Card */}
                <div className="bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-xl">
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email */}
                        <div>
                            <select
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer"
                            >
                                <option value="">Выберите пользователя...</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.email}>
                                        {u.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Password */}
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Пароль"
                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="text-red-400 text-sm text-center">
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={!email || !password || isLoading}
                            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Вход...' : 'Войти'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
