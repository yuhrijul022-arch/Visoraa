import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { Key, Plus, Trash2, CheckCircle2 } from 'lucide-react';

export const AdminApiKeys: React.FC = () => {
    const [keys, setKeys] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [name, setName] = useState('');
    const [provider, setProvider] = useState('openrouter');
    const [keyValue, setKeyValue] = useState('');

    const fetchKeys = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        try {
            const response = await fetch('/api/admin?action=apikeys', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) setKeys(await response.json());
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchKeys();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('/api/admin?action=apikeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'add', name, provider, keyValue })
            });

            if (res.ok) {
                setName('');
                setKeyValue('');
                fetchKeys();
            } else {
                alert("Failed to add key");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Delete this API key?")) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('/api/admin?action=apikeys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'delete', id })
            });
            if (res.ok) fetchKeys();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">API Keys Configuration</h2>
                <p className="text-gray-400 text-sm mt-1">Manage external API keys (OpenRouter, Fal.ai).</p>
            </div>

            <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Add New Key</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
                        <select 
                            value={provider} 
                            onChange={(e) => setProvider(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                        >
                            <option value="openrouter">OpenRouter</option>
                            <option value="fal">Fal.ai</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Key Name</label>
                        <input 
                            type="text" 
                            required 
                            placeholder="e.g. Primary Fal Key"
                            value={name} 
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                        <input 
                            type="password" 
                            required 
                            placeholder="sk-..."
                            value={keyValue} 
                            onChange={(e) => setKeyValue(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-white font-mono text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>
                    <button 
                        type="submit"
                        className="flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-200 transition-colors"
                    >
                        <Plus size={18} /> Add Key
                    </button>
                </form>
            </div>

            <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm text-gray-300">
                    <thead className="bg-[#1a1a1a]/50 text-gray-400 font-medium">
                        <tr>
                            <th className="px-6 py-4">Provider</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Added</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222222]">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                        ) : keys.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No API keys configured.</td></tr>
                        ) : (
                            keys.map((k) => (
                                <tr key={k.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-medium text-white uppercase">{k.provider}</td>
                                    <td className="px-6 py-4">{k.name}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-emerald-500">
                                            <CheckCircle2 size={16} /> Active
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{new Date(k.createdAt).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => handleDelete(k.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors">
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
    );
};
