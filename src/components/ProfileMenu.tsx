import React, { useState, useRef, useEffect } from 'react';
import { AppUser } from '../../types.js';
import { supabase } from '../lib/supabaseClient.js';
import { useNavigate } from 'react-router-dom';

interface ProfileMenuProps {
    user: AppUser;
    credits: number;
    onTopUp: () => void;
    plan?: string;
}

export const ProfileMenu: React.FC<ProfileMenuProps> = ({ user, credits, onTopUp, plan }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const initials = (user.displayName || user.email || '?').charAt(0).toUpperCase();

    return (
        <div ref={ref} className="relative pointer-events-auto">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full pl-3 pr-1.5 py-1.5 transition-all"
            >
                <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v12M6 12h12" />
                    </svg>
                    <span className="text-xs font-bold text-white tabular-nums">{credits}</span>
                </div>
                {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover border border-white/10" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                        {initials}
                    </div>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-56 bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                    style={{ animation: 'fadeInDown 0.15s ease-out' }}>
                    <div className="p-4 border-b border-white/5 relative">
                        {plan && (
                            <div className="absolute top-3 right-4">
                                <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full font-bold ${plan === 'pro' ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 text-purple-300 border border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                                    {plan}
                                </span>
                            </div>
                        )}
                        <div className="text-sm font-semibold text-white truncate max-w-[130px]">{user.displayName || 'User'}</div>
                        <div className="text-xs text-gray-500 truncate mt-0.5 max-w-[130px]">{user.email}</div>
                    </div>

                    <div className="p-2">
                        <button
                            onClick={() => { setOpen(false); onTopUp(); }}
                            className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M12 6v12M6 12h12" />
                            </svg>
                            Top Up Credits
                        </button>
                        <button
                            onClick={() => { setOpen(false); navigate('/billing'); }}
                            className="w-full text-left px-3 py-2.5 text-sm text-white hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
                            </svg>
                            Billing & History
                        </button>
                    </div>

                    <div className="p-2 border-t border-white/5">
                        <button
                            onClick={() => { supabase.auth.signOut(); setOpen(false); }}
                            className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
            <style>{`@keyframes fadeInDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>
    );
};
