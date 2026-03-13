import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { Search, Edit2, Shield, Trash2, Check, X, CreditCard } from 'lucide-react';

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchUsers = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        try {
            const response = await fetch(`/api/admin?action=users&search=${encodeURIComponent(searchTerm)}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        const t = setTimeout(() => {
            fetchUsers();
        }, 300);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const handleAction = async (userId: string, action: string, value: any) => {
        if (!window.confirm("Are you sure you want to perform this action?")) return;
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('/api/admin?action=users-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ userId, action, value })
            });

            if (res.ok) {
                fetchUsers();
            } else {
                alert("Action failed");
            }
        } catch (e) {
            console.error(e);
            alert("An error occurred");
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">User Management</h2>
                    <p className="text-gray-400 text-sm mt-1">Manage users, credits, and plans.</p>
                </div>
                
                <div className="relative w-full md:w-64">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={16} className="text-gray-500" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        className="w-full bg-[#111111] border border-[#222] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-white/20 transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-[#1a1a1a]/50 text-gray-400 font-medium">
                            <tr>
                                <th className="px-6 py-4">Name / Email</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Credits</th>
                                <th className="px-6 py-4">Infinite</th>
                                <th className="px-6 py-4">Joined</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222222]">
                            {loading && users.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Loading users...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No users found.</td></tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.email}</div>
                                            {user.isAdmin && <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"><Shield size={10} className="mr-1"/> Admin</span>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${user.plan === 'pro' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-gray-500/10 text-gray-300 border-gray-500/20'}`}>
                                                {user.plan.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-mono">{user.credits}</td>
                                        <td className="px-6 py-4">{user.infiniteEnabled ? <Check size={16} className="text-emerald-500" /> : <X size={16} className="text-red-500" />}</td>
                                        <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => handleAction(user.id, 'add_credits', 50)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors" title="Add 50 Credits">
                                                <CreditCard size={16} />
                                            </button>
                                            <button onClick={() => handleAction(user.id, 'toggle_plan', user.plan === 'basic' ? 'pro' : 'basic')} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors" title="Toggle Plan">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleAction(user.id, 'delete', null)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors" title="Delete User">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
