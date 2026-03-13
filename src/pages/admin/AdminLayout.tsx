import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { LayoutDashboard, Users, Key, CreditCard, LogOut, ArrowLeft } from 'lucide-react';

export const AdminLayout: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const navItems = [
        { label: 'Overview', path: '/admin', icon: <LayoutDashboard size={20} /> },
        { label: 'Users', path: '/admin/users', icon: <Users size={20} /> },
        { label: 'API Keys', path: '/admin/api-keys', icon: <Key size={20} /> },
        { label: 'Payment Config', path: '/admin/payment-gateway', icon: <CreditCard size={20} /> },
    ];

    return (
        <div className="min-h-screen bg-black text-white flex select-none">
            {/* Sidebar */}
            <aside className="w-64 border-r border-[#1a1a1a] bg-[#0A0A0A] flex flex-col justify-between hidden md:flex">
                <div className="p-6">
                    <h1 className="text-xl font-bold tracking-tight mb-8 bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">Visora Admin</h1>
                    
                    <nav className="space-y-2">
                        {navItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/admin'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                                        isActive
                                            ? 'bg-white/10 text-white shadow-sm'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`
                                }
                            >
                                {item.icon}
                                {item.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                <div className="p-6 space-y-2">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-200"
                    >
                        <ArrowLeft size={20} />
                        Back to App
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 bg-black overflow-y-auto">
                {/* Mobile Header */}
                <header className="md:hidden border-b border-[#1a1a1a] bg-[#0A0A0A] p-4 flex items-center justify-between sticky top-0 z-10">
                    <h1 className="text-lg font-bold">Visora Admin</h1>
                    <button onClick={() => navigate('/dashboard')} className="text-sm font-medium text-gray-400">Exit Admin</button>
                </header>

                <div className="p-6 md:p-12 max-w-6xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
