import React, { useState, useEffect } from 'react';

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('admin');
    const [adminDetails, setAdminDetails] = useState(null);

    // Initial session load
    useEffect(() => {
        fetch('/api/account/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.email) {
                    setCurrentUser(data);
                    const roles = data.roles || [];
                    if (roles.includes("Admin")) {
                        setActiveTab('admin');
                    } else if (roles.includes("Author") || roles.includes("Publisher")) {
                        setActiveTab('studio');
                    } else {
                        setActiveTab('store');
                    }
                } else {
                    // Fallback Demo Admin User
                    setCurrentUser({
                        fullName: "System Administrator",
                        email: "admin@booksystem.com",
                        roles: ["Admin"]
                    });
                    setActiveTab('admin');
                }
                setLoading(false);
            })
            .catch(() => {
                setCurrentUser({
                    fullName: "System Administrator",
                    email: "admin@booksystem.com",
                    roles: ["Admin"]
                });
                setActiveTab('admin');
                setLoading(false);
            });
    }, []);

    // Fetch Admin Profile Data when Admin Tab active
    useEffect(() => {
        if (currentUser?.roles?.includes("Admin") && activeTab === 'admin') {
            fetch('/api/account/profile')
                .then(res => res.json())
                .then(data => setAdminDetails(data.details || {}))
                .catch(err => console.error(err));
        }
    }, [currentUser, activeTab]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center font-sans">
                <div className="text-center space-y-3">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-slate-400 text-sm font-medium">Initializing Security Session...</p>
                </div>
            </div>
        );
    }

    const isAdmin = currentUser?.roles?.includes("Admin");
    const isAuthor = currentUser?.roles?.includes("Author") || currentUser?.roles?.includes("Publisher");

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none">
            {/* TOP HEADER */}
            <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="bg-red-600 text-white px-3 py-1.5 rounded-xl font-bold text-lg shadow-lg">
                        BJ
                    </div>
                    <div>
                        <div className="text-white font-extrabold text-sm uppercase">B. Jain Group</div>
                        <div className="text-[9px] text-red-400 font-bold uppercase tracking-widest">Publishers</div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700">
                        {isAdmin && (
                            <button
                                onClick={() => setActiveTab('admin')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeTab === 'admin' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Admin Control Panel
                            </button>
                        )}
                        {isAuthor && (
                            <button
                                onClick={() => setActiveTab('studio')}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeTab === 'studio' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Author Studio
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('store')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${activeTab === 'store' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            Store Catalogue
                        </button>
                    </div>

                    <div className="flex items-center gap-3 border-l border-slate-700 pl-6">
                        <div className="text-right">
                            <div className="text-sm font-bold text-slate-200">{currentUser?.fullName}</div>
                            <div className={`text-xs font-bold ${isAdmin ? 'text-red-400' : 'text-indigo-400'}`}>
                                {isAdmin ? 'SYSTEM ADMINISTRATOR' : currentUser?.roles?.join(', ')}
                            </div>
                        </div>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow ${isAdmin ? 'bg-red-600' : 'bg-indigo-600'}`}>
                            {currentUser?.fullName?.split(' ').map(n => n[0]).join('')}
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN APP BODY VIEWS */}
            <main className="flex-1 p-8 bg-slate-900/90 overflow-y-auto">

                {/* 1. ADMIN DASHBOARD VIEW */}
                {activeTab === 'admin' && isAdmin && (
                    <div className="space-y-6">
                        {/* Admin Info Banner */}
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-center shadow-lg">
                            <div>
                                <h1 className="text-2xl font-bold text-white">{currentUser?.fullName}</h1>
                                <p className="text-slate-400 text-sm mt-1">{currentUser?.email}</p>
                            </div>
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1 rounded-full font-mono font-bold">
                                SYSTEM ADMIN ACCESS
                            </span>
                        </div>

                        {/* Metric Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users Registered</p>
                                <h2 className="text-3xl font-extrabold text-white mt-2">{adminDetails?.totalUsersCount || 0}</h2>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Book Purchases</p>
                                <h2 className="text-3xl font-extrabold text-emerald-400 mt-2">{adminDetails?.totalPurchasesCount || 0}</h2>
                            </div>
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Revenue</p>
                                <h2 className="text-3xl font-extrabold text-indigo-400 mt-2">₹{adminDetails?.totalRevenue || 0}</h2>
                            </div>
                        </div>

                        {/* Registered User Profiles Table */}
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-lg font-bold text-white mb-4">All User Profiles</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-slate-300 text-sm">
                                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="p-3">User ID</th>
                                            <th className="p-3">Full Name</th>
                                            <th className="p-3">Email Address</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {adminDetails?.users?.map((u) => (
                                            <tr key={u.id}>
                                                <td className="p-3 font-mono text-xs">{u.id}</td>
                                                <td className="p-3 font-medium text-white">{u.fullName || 'N/A'}</td>
                                                <td className="p-3">{u.email}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Purchases & Subscriptions Log */}
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <h3 className="text-lg font-bold text-white mb-4">Customer Purchases & Subscription Audit Log</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-slate-300 text-sm">
                                    <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                                        <tr>
                                            <th className="p-3">Transaction ID</th>
                                            <th className="p-3">Customer Email</th>
                                            <th className="p-3">Book Details (Item No / Title / ISBN)</th>
                                            <th className="p-3">Amount Paid</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {adminDetails?.purchases?.map((p) => (
                                            <tr key={p.id}>
                                                <td className="p-3 font-mono text-xs text-indigo-400">{p.transactionId || 'N/A'}</td>
                                                <td className="p-3">{p.userEmail}</td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-white">{p.bookDetails?.itemName || p.bookDetails?.title}</div>
                                                    <div className="text-xs text-slate-400">Item No: {p.bookDetails?.itemNo} | ISBN: {p.bookDetails?.isbn}</div>
                                                </td>
                                                <td className="p-3 text-emerald-400 font-bold">₹{p.amountPaid}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. STORE CATALOGUE VIEW */}
                {activeTab === 'store' && (
                    <div className="text-slate-200">
                        <h2 className="text-xl font-bold mb-4">Store Catalogue</h2>
                        <p className="text-slate-400 text-sm">Explore all published DRM-protected books.</p>
                    </div>
                )}
            </main>
        </div>
    );
}