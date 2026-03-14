import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient.js';

const AdminGate: React.FC = () => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAdmin = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            try {
                // Use the admin API check endpoint (Drizzle — bypasses RLS)
                const res = await fetch('/api/admin?action=check', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                const data = await res.json();
                setIsAdmin(res.ok && data.isAdmin === true);
            } catch (err) {
                console.error('Admin check failed:', err);
                setIsAdmin(false);
            }
            setLoading(false);
        };

        checkAdmin();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#333333] border-t-white animate-spin"></div>
            </div>
        );
    }

    if (!isAdmin) {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
};

export default AdminGate;
