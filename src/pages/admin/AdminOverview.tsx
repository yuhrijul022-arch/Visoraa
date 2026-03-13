import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Users, CreditCard, Activity, DollarSign } from 'lucide-react';

export const AdminOverview: React.FC = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalRevenue: 0,
        totalCredits: 0,
        activeGenerates: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            try {
                const response = await fetch('/api/admin?action=stats', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                }
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        fetchStats();
    }, []);

    const formatRupiah = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);

    if (loading) return <div className="animate-pulse flex space-x-4"><div className="h-4 bg-[#222] rounded w-1/4"></div></div>;

    const cards = [
        { title: 'Total Revenue', value: formatRupiah(stats.totalRevenue), icon: <DollarSign size={24} className="text-emerald-500" /> },
        { title: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: <Users size={24} className="text-blue-500" /> },
        { title: 'Credits Dispensed', value: stats.totalCredits.toLocaleString(), icon: <CreditCard size={24} className="text-purple-500" /> },
        { title: 'Generations (24h)', value: stats.activeGenerates.toLocaleString(), icon: <Activity size={24} className="text-orange-500" /> },
    ];

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h2>
                <p className="text-gray-400 mt-2">Welcome back. Here is what's happening today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card, i) => (
                    <div key={i} className="bg-[#111111] border border-[#222222] rounded-2xl p-6 transition-transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-gray-400 text-sm font-medium">{card.title}</h3>
                            <div className="p-2 bg-[#1a1a1a] rounded-lg">
                                {card.icon}
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-white tracking-tight">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Placeholder for future charts */}
            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 h-96 flex flex-col justify-center items-center text-gray-500">
                <Activity size={48} className="mb-4 opacity-50" />
                <p>Activity Chart (Coming Soon)</p>
            </div>
        </div>
    );
};
