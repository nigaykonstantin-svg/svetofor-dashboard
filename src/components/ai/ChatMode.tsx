'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, QuickPrompt, QUICK_PROMPTS } from './types';

interface ChatModeProps {
    category: string;
    period: number;
    kpis: {
        totalOrderSum: number;
        totalOrders: number;
        avgCheck: number;
        avgDRR: number;
        skuCount: number;
    } | null;
    clusters: {
        OOS_NOW: any[];
        OOS_SOON: any[];
        HIGH_DRR: any[];
        LOW_CTR: any[];
        LOW_CR: any[];
        LOW_BUYOUT: any[];
        OVERSTOCK: any[];
        ABOVE_MARKET: any[];
    } | null;
    onSkuClick?: (nmId: number) => void;
}

export default function ChatMode({
    category,
    period,
    kpis,
    clusters,
    onSkuClick,
}: ChatModeProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (text: string) => {
        if (!text.trim() || loading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch('/api/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    context: {
                        category,
                        period,
                        kpis,
                        clusters,
                        history: messages.slice(-6), // Last 6 messages for context
                    },
                }),
            });

            const result = await response.json();

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: result.success ? result.response : `Ошибка: ${result.error}`,
                timestamp: new Date().toISOString(),
                skuRefs: result.skuRefs,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Ошибка соединения: ${error}`,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPrompt = (prompt: QuickPrompt) => {
        sendMessage(prompt.prompt);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Quick Prompts */}
            {messages.length === 0 && (
                <div className="p-4 border-b border-slate-700">
                    <div className="text-sm text-slate-400 mb-3">⚡ Быстрые вопросы</div>
                    <div className="grid grid-cols-2 gap-2">
                        {QUICK_PROMPTS.map((prompt) => (
                            <button
                                key={prompt.id}
                                onClick={() => handleQuickPrompt(prompt)}
                                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-left text-sm transition flex items-center gap-2"
                            >
                                <span>{prompt.emoji}</span>
                                <span className="truncate">{prompt.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                        <div className="text-4xl mb-3">💬</div>
                        <p>Задайте вопрос AI или выберите быстрый вопрос выше</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[85%] rounded-xl px-4 py-3 ${msg.role === 'user'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-800 text-slate-100'
                                }`}
                        >
                            {msg.role === 'assistant' ? (
                                <div className="prose prose-invert prose-sm max-w-none">
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => (
                                                <p className="mb-2 last:mb-0 text-sm">{children}</p>
                                            ),
                                            ul: ({ children }) => (
                                                <ul className="list-disc list-inside space-y-1 text-sm">{children}</ul>
                                            ),
                                            strong: ({ children }) => (
                                                <strong className="text-white font-semibold">{children}</strong>
                                            ),
                                            h2: ({ children }) => (
                                                <h2 className="text-base font-bold mt-3 mb-2 first:mt-0">{children}</h2>
                                            ),
                                            h3: ({ children }) => (
                                                <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            ) : (
                                <p className="text-sm">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 text-slate-400">
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Задайте вопрос про категорию..."
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm font-medium"
                    >
                        {loading ? '...' : '🚀'}
                    </button>
                </div>
                {messages.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setMessages([])}
                        className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition"
                    >
                        🗑️ Очистить историю
                    </button>
                )}
            </form>
        </div>
    );
}
