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

            // Query langsung ke tabel users via Supabase — tidak butuh API endpoint
            const { data, error } = await supabase
                .from('users')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            console.log('=== ADMIN DEBUG ===');
            console.log('User ID:', session.user.id);
            console.log('User Email:', session.user.email);
            console.log('Data dari DB:', JSON.stringify(data));
            console.log('Error dari DB:', JSON.stringify(error));
            console.log('isAdmin result:', !error && data?.is_admin === true);
            console.log('==================');

            setIsAdmin(!error && data?.is_admin === true);
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
