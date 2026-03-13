import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { Search, Edit2, Shield, Trash2, Check, X, CreditCard, UserPlus, Save } from 'lucide-react';

export const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    // Form States
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', plan: 'basic', credits: 0
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (action === 'delete') {
            if (!window.confirm("Peringatan: Menghapus user ini akan menghapusnya secara permanen. Lanjutkan?")) return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin?action=users-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                // For create, we trick the endpoint by sending a dummy userId "new"
                body: JSON.stringify({ userId: userId || 'new', action, value })
            });

            const data = await res.json();
            
            if (res.ok) {
                setShowCreateModal(false);
                setShowEditModal(false);
                fetchUsers();
            } else {
                alert(data.error || "Aksi Gagal");
            }
        } catch (e) {
            console.error(e);
            alert("Terjadi Kesalahan Server");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openCreateModal = () => {
        setFormData({ name: '', email: '', password: '', plan: 'basic', credits: 0 });
        setShowCreateModal(true);
    };

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        setFormData({
            name: user.name || '',
            email: user.email || '',
            password: '', // Kept blank for security, we don't update password here
            plan: user.plan || 'basic',
            credits: user.credits || 0
        });
        setShowEditModal(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Manajemen User</h2>
                    <p className="text-gray-400 text-sm mt-1">Tambah, edit, dan awasi semua pengguna secara manual.</p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search size={16} className="text-gray-500" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari nama atau email..."
                            className="w-full bg-[#111111] border border-[#222] text-white rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-white/20 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={openCreateModal}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-medium transition-colors whitespace-nowrap"
                    >
                        <UserPlus size={16} /> Tambah User
                    </button>
                </div>
            </div>

            <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="bg-[#1a1a1a]/50 text-gray-400 font-medium">
                            <tr>
                                <th className="px-6 py-4">Nama / Email</th>
                                <th className="px-6 py-4">Paket</th>
                                <th className="px-6 py-4">Kredit</th>
                                <th className="px-6 py-4">Infinite Mode</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#222222]">
                            {loading && users.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Memuat data user...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Tidak ada user ditemukan.</td></tr>
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
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => openEditModal(user)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Edit User">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleAction(user.id, 'delete', null)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors" title="Hapus User">
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

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111111] border border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Tambah User Baru</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Nama Lengkap</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Email</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Password</label>
                                <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Paket</label>
                                    <select value={formData.plan} onChange={(e) => setFormData({...formData, plan: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none">
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro (Infinite)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Bonus Credits</label>
                                    <input type="number" value={formData.credits} onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white font-medium">Batal</button>
                            <button 
                                onClick={() => handleAction('', 'create_user', formData)}
                                disabled={isSubmitting || !formData.email || !formData.password || !formData.name}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-medium"
                            >
                                {isSubmitting ? 'Menyimpan...' : 'Buat User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#111111] border border-[#333] rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Edit User</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Nama Lengkap</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Email</label>
                                <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Paket</label>
                                    <select value={formData.plan} onChange={(e) => setFormData({...formData, plan: e.target.value})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none">
                                        <option value="basic">Basic</option>
                                        <option value="pro">Pro (Infinite)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Credits</label>
                                    <input type="number" value={formData.credits} onChange={(e) => setFormData({...formData, credits: parseInt(e.target.value) || 0})} className="w-full bg-black border border-[#333] rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white font-medium">Batal</button>
                            <button 
                                onClick={() => handleAction(selectedUser.id, 'update_user', formData)}
                                disabled={isSubmitting || !formData.email || !formData.name}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-medium"
                            >
                                {isSubmitting ? 'Menyimpan...' : <><Save size={16}/> Simpan</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
