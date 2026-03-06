import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
    id: number;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    description?: string;
}

interface ToastContextType {
    toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => { } });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((t: Omit<Toast, 'id'>) => {
        const id = Date.now();
        setToasts(prev => [...prev, { ...t, id }]);
        setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 4000);
    }, []);

    const colors: Record<string, string> = {
        success: 'bg-green-500/10 border-green-500/20 text-green-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    };

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '360px' }}>
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl ${colors[t.type]} animate-in fade-in slide-in-from-top-2`}
                        style={{ animation: 'fadeInDown 0.3s ease-out' }}
                    >
                        <div className="font-semibold text-sm">{t.title}</div>
                        {t.description && <div className="text-xs mt-1 opacity-80">{t.description}</div>}
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </ToastContext.Provider>
    );
};
