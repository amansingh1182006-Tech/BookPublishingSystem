import React, { useEffect, useState } from 'react';

export default function Profile() {
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Backend se user profile fetch kar rahe hain
        fetch('/api/account/profile')
            .then(res => res.json())
            .then(data => {
                setProfileData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Profile fetch error:", err);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="p-8 text-center text-slate-300">Loading Profile...</div>;
    }

    // Role verification logic
    const roles = profileData?.roles || profileData?.rolesList || [];
    const isAdmin = roles.includes("Admin") || profileData?.primaryRole === "Admin";

    // ==========================================
    // 1. AGAR USER ADMIN HAI TOH YE DASHBOARD DIKHEGA
    // ==========================================
    if (isAdmin) {
        const adminDetails = profileData?.details || {};
        const users = adminDetails.users || [];
        const purchases = adminDetails.purchases || [];

        return (
            <div className="p-6 bg-slate-900 text-slate-100 min-h-screen space-y-6">
                {/* Admin Header Card */}
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-center shadow-lg">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-white text-2xl font-bold shadow-md">
                            {profileData?.fullName?.charAt(0) || 'S'}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-bold text-white">{profileData?.fullName || "System Administrator"}</h2>
                                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1 rounded-full font-mono font-bold">
                                    ADMINISTRATOR ACCOUNT
                                </span>
                            </div>
                            <p className="text-slate-400 text-sm mt-1">{profileData?.email}</p>
                        </div>
                    </div>
                </div>

                {/* System Metrics Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users Registered</p>
                        <h3 className="text-3xl font-extrabold text-white mt-2">{adminDetails.totalUsersCount || users.length || 0}</h3>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Book Purchases</p>
                        <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">{adminDetails.totalPurchasesCount || purchases.length || 0}</h3>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-sm">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total System Revenue</p>
                        <h3 className="text-3xl font-extrabold text-indigo-400 mt-2">₹{adminDetails.totalRevenue || 0}</h3>
                    </div>
                </div>

                {/* Table 1: Registered User Profiles */}
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-md">
                    <h3 className="text-lg font-bold text-white mb-4">All User Profiles</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-slate-300 text-sm">
                            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase border-b border-slate-700">
                                <tr>
                                    <th className="p-3">User ID</th>
                                    <th className="p-3">Full Name</th>
                                    <th className="p-3">Email</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {users.length > 0 ? (
                                    users.map((u) => (
                                        <tr key={u.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-3 font-mono text-xs">{u.id}</td>
                                            <td className="p-3 font-medium text-white">{u.fullName || 'N/A'}</td>
                                            <td className="p-3 text-slate-300">{u.email}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="3" className="p-4 text-center text-slate-500">No user records found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Table 2: Purchases Audit Log */}
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-md">
                    <h3 className="text-lg font-bold text-white mb-4">Customer Purchases & Subscriptions Audit Log</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-slate-300 text-sm">
                            <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase border-b border-slate-700">
                                <tr>
                                    <th className="p-3">Transaction ID</th>
                                    <th className="p-3">Buyer Email</th>
                                    <th className="p-3">Book (Item No / Title / ISBN)</th>
                                    <th className="p-3">Amount Paid</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {purchases.length > 0 ? (
                                    purchases.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-700/30 transition">
                                            <td className="p-3 font-mono text-xs text-indigo-400">{p.transactionId || 'N/A'}</td>
                                            <td className="p-3">{p.userEmail}</td>
                                            <td className="p-3">
                                                <div className="font-semibold text-white">{p.bookDetails?.itemName || p.bookDetails?.title || 'Book Title'}</div>
                                                <div className="text-xs text-slate-400">
                                                    Item No: {p.bookDetails?.itemNo || 'N/A'} | ISBN: {p.bookDetails?.isbn || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-3 text-emerald-400 font-bold">₹{p.amountPaid}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="p-4 text-center text-slate-500">No purchase transactions recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // 2. DEFAULT READER PROFILE UI (AGAR ADMIN NA HO)
    // ==========================================
    return (
        <div className="p-6">
            <h2>Reader Profile</h2>
            {/* Aapka Purana Reader View Code */}
        </div>
    );
}