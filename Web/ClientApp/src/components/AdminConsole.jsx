import React, { useEffect, useState } from 'react';

export default function AdminConsole() {
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/account/profile')
            .then(res => res.json())
            .then(data => {
                setProfileData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Admin profile fetch failed", err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-6 text-slate-300">Loading Admin Dashboard...</div>;

    const details = profileData?.details || {};

    return (
        <div className="space-y-6">
            {/* Admin Header Info Card */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex justify-between items-center shadow-lg">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-white">{profileData?.fullName || "System Administrator"}</h1>
                        <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1 rounded-full font-mono font-bold">
                            ADMINISTRATOR ACCOUNT
                        </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{profileData?.email}</p>
                </div>
            </div>

            {/* Metric Summary Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Users Registered</p>
                    <h2 className="text-3xl font-extrabold text-white mt-2">{details.totalUsersCount || 0}</h2>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total Book Purchases</p>
                    <h2 className="text-3xl font-extrabold text-emerald-400 mt-2">{details.totalPurchasesCount || 0}</h2>
                </div>
                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Total System Revenue</p>
                    <h2 className="text-3xl font-extrabold text-indigo-400 mt-2">₹{details.totalRevenue || 0}</h2>
                </div>
            </div>

            {/* Registered Users Table */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">All User Profiles</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-300 text-sm">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase">
                            <tr>
                                <th className="p-3">User ID</th>
                                <th className="p-3">Full Name</th>
                                <th className="p-3">Email</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {details.users && details.users.map((u) => (
                                <tr key={u.id}>
                                    <td className="p-3 font-mono text-xs">{u.id}</td>
                                    <td className="p-3">{u.fullName || 'N/A'}</td>
                                    <td className="p-3">{u.email}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* All Purchases & Transactions Audit Log */}
            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                <h3 className="text-lg font-bold text-white mb-4">Customer Purchases & Subscription History</h3>
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
                            {details.purchases && details.purchases.map((p) => (
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
    );
}