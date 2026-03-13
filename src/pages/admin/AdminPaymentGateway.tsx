import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { CreditCard, Save } from 'lucide-react';

export const AdminPaymentGateway: React.FC = () => {
    const [gateways, setGateways] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchGateways = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        try {
            const response = await fetch('/api/admin-gateways', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) setGateways(await response.json());
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGateways();
    }, []);

    const toggleGateway = async (gatewayName: string) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('/api/admin-gateways', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'toggle', gateway: gatewayName })
            });

            if (res.ok) fetchGateways();
            else alert("Failed to change active gateway");
        } catch (e) {
            console.error(e);
        }
    };

    const saveKeys = async (gatewayName: string, keys: any) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        try {
            const res = await fetch('/api/admin-gateways', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ action: 'update_keys', gateway: gatewayName, keys })
            });

            if (res.ok) {
                alert("Keys saved successfully!");
                fetchGateways();
            } else {
                alert("Failed to save keys");
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Payment Gateways</h2>
                <p className="text-gray-400 text-sm mt-1">Configure active payment provider and credentials.</p>
            </div>

            {loading ? (
                <div className="text-gray-500">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Midtrans Card */}
                    {(() => {
                        const mt = gateways.find(g => g.gateway === 'midtrans') || { gateway: 'midtrans', isActive: false };
                        return (
                            <GatewayCard 
                                name="Midtrans" 
                                id="midtrans" 
                                data={mt} 
                                onToggle={() => toggleGateway('midtrans')} 
                                onSave={(keys: any) => saveKeys('midtrans', keys)} 
                            />
                        );
                    })()}

                    {/* Mayar Card */}
                    {(() => {
                        const myr = gateways.find(g => g.gateway === 'mayar') || { gateway: 'mayar', isActive: false };
                        return (
                            <GatewayCard 
                                name="Mayar.id" 
                                id="mayar" 
                                data={myr} 
                                onToggle={() => toggleGateway('mayar')} 
                                onSave={(keys: any) => saveKeys('mayar', keys)} 
                                needsWebhookSecret
                            />
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

const GatewayCard = ({ name, id, data, onToggle, onSave, needsWebhookSecret = false }: any) => {
    const [serverKey, setServerKey] = useState('');
    const [webhookSecret, setWebhookSecret] = useState('');

    return (
        <div className={`bg-[#111111] border rounded-2xl p-6 transition-colors ${data.isActive ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'border-[#222222]'}`}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1a1a1a] rounded-xl text-white">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{name}</h3>
                        <p className="text-sm text-gray-500">{data.isActive ? 'Currently Active' : 'Inactive'}</p>
                    </div>
                </div>
                
                <button
                    onClick={onToggle}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${data.isActive ? 'bg-emerald-500' : 'bg-gray-700'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${data.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Server Key</label>
                    <input 
                        type="password" 
                        placeholder={data.hasServerKey ? "•••••••••••••••• Saved securely" : "Enter Server Key..."}
                        value={serverKey}
                        onChange={(e) => setServerKey(e.target.value)}
                        className="w-full bg-[#0A0A0A] border border-[#333] text-white font-mono text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                    />
                </div>
                
                {needsWebhookSecret && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Webhook Secret</label>
                        <input 
                            type="password" 
                            placeholder={data.hasWebhookSecret ? "•••••••••••••••• Saved securely" : "Enter Webhook Secret..."}
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-[#333] text-white font-mono text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                        />
                    </div>
                )}

                <button 
                    onClick={() => onSave({ serverKey, webhookSecret })}
                    className="w-full mt-2 flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-4 py-2.5 hover:bg-gray-200 transition-colors"
                >
                    <Save size={18} /> Update Configurations
                </button>
            </div>
        </div>
    );
};
