function PlatformRevenueMaster({ triggerToast }) {
    const [loading, setLoading] = React.useState(false);
    const [kpis, setKpis] = React.useState({
        totalTransactions: 0,
        totalGrossRevenue: 0,
        totalVendorRoyalty30: 0,
        totalPlatformRevenue70: 0,
        planPlatformRevenue: 0,
        bundlePlatformRevenue: 0,
        singleBookPlatformRevenue: 0
    });
    const [transactions, setTransactions] = React.useState([]);

    const [typeFilter, setTypeFilter] = React.useState('ALL');
    const [searchQuery, setSearchQuery] = React.useState('');
    const [fromDate, setFromDate] = React.useState('');
    const [toDate, setToDate] = React.useState('');

    const fetchRevenueData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (typeFilter && typeFilter !== 'ALL') params.append('type', typeFilter);
            if (fromDate) params.append('fromDate', fromDate);
            if (toDate) params.append('toDate', toDate);

            const res = await fetch(`/PlatformRevenue/Summary?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.kpis) setKpis(data.kpis);
                setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
            } else {
                if (triggerToast) triggerToast("Failed to load platform revenue ledger.", "error");
            }
        } catch (err) {
            console.error("Platform revenue fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchRevenueData();
    }, [typeFilter, fromDate, toDate]);

    const filteredTransactions = transactions.filter(t => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (t.userName || '').toLowerCase().includes(q) ||
            (t.userEmail || '').toLowerCase().includes(q) ||
            (t.itemTitle || '').toLowerCase().includes(q) ||
            (t.vendorNames || '').toLowerCase().includes(q) ||
            (t.transactionId || '').toLowerCase().includes(q);
    });

    const handleExportCsv = () => {
        if (filteredTransactions.length === 0) {
            alert("No records available to export.");
            return;
        }
        const headers = [
            "Transaction ID", "Date", "Source Type", "Plan / Bundle / Book",
            "Purchased By (User)", "User Email", "Vendor (30% Recipient)",
            "Gross Paid (100%)", "Vendor Royalty (30%)", "Platform Revenue (70%)", "Status"
        ];
        const rows = filteredTransactions.map(t => [
            t.transactionId,
            new Date(t.transactionDate).toLocaleDateString('en-IN'),
            t.purchaseType,
            `"${(t.itemTitle || '').replace(/"/g, '""')}"`,
            `"${(t.userName || '').replace(/"/g, '""')}"`,
            t.userEmail,
            `"${(t.vendorNames || '').replace(/"/g, '""')}"`,
            Number(t.grossAmount || 0).toFixed(2),
            Number(t.vendorRoyalty30 || 0).toFixed(2),
            Number(t.platformShare70 || 0).toFixed(2),
            t.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Platform_Revenue_70_Report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (triggerToast) triggerToast("Platform Revenue (70%) CSV exported!");
    };

    const formatINR = (val) => {
        return Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <div className="w-full space-y-6 text-xs">
            {/* TOP ENTERPRISE TREASURY HEADER */}
            <div className="bg-gradient-to-r from-[#0d233a] via-[#133150] to-[#1a436e] text-white p-6 rounded-xl shadow-md border-l-8 border-emerald-500 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                        70% Net Platform Share • 30% Vendor Royalty Split
                    </span>
                    <h2 className="text-2xl font-black mt-1.5 flex items-center gap-2.5">
                        <i className="fa-solid fa-vault text-amber-400"></i> Platform Revenue & Treasury Ledger
                    </h2>
                    <p className="text-slate-300 mt-1">
                        Complete audit trail showing user-wise & product-wise 70% platform earnings from Subscription Plans, Book Bundles, and Single Books.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={fetchRevenueData}
                        className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition">
                        <i className="fa-solid fa-rotate"></i> Refresh
                    </button>
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-lg shadow flex items-center gap-2 cursor-pointer transition">
                        <i className="fa-solid fa-file-csv"></i> Export CSV Ledger
                    </button>
                </div>
            </div>

            {/* KPI REVENUE CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-500 font-bold uppercase text-[10px]">
                        <span>Total Gross Revenue (100%)</span>
                        <i className="fa-solid fa-indian-rupee-sign text-slate-400 text-sm"></i>
                    </div>
                    <div className="text-2xl font-black text-slate-900">₹{formatINR(kpis.totalGrossRevenue)}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">Across {kpis.totalTransactions} settled transactions</div>
                </div>

                <div className="bg-emerald-50/80 p-5 rounded-xl border-2 border-emerald-500 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-emerald-800 font-black uppercase text-[10px]">
                        <span>Platform Net Revenue (70%)</span>
                        <i className="fa-solid fa-building-columns text-emerald-600 text-base"></i>
                    </div>
                    <div className="text-2xl font-black text-emerald-700">₹{formatINR(kpis.totalPlatformRevenue70)}</div>
                    <div className="text-[11px] text-emerald-800 font-bold">Retained in Platform Account</div>
                </div>

                <div className="bg-amber-50/70 p-5 rounded-xl border border-amber-200 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-amber-800 font-bold uppercase text-[10px]">
                        <span>Vendor Royalty Share (30%)</span>
                        <i className="fa-solid fa-hand-holding-dollar text-amber-600 text-sm"></i>
                    </div>
                    <div className="text-2xl font-black text-amber-700">₹{formatINR(kpis.totalVendorRoyalty30)}</div>
                    <div className="text-[11px] text-amber-800 font-semibold">Distributed to Vendors</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500 border-b pb-1">Platform 70% Share by Source</span>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-indigo-700"><i className="fa-solid fa-crown me-1"></i> Plans:</span>
                        <span className="font-black text-slate-900">₹{formatINR(kpis.planPlatformRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-purple-700"><i className="fa-solid fa-layer-group me-1"></i> Bundles:</span>
                        <span className="font-black text-slate-900">₹{formatINR(kpis.bundlePlatformRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-sky-700"><i className="fa-solid fa-book me-1"></i> Single Books:</span>
                        <span className="font-black text-slate-900">₹{formatINR(kpis.singleBookPlatformRevenue)}</span>
                    </div>
                </div>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                    <label className="font-bold text-slate-600 block mb-1">Search User, Plan / Bundle / Book, or Txn ID</label>
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400"></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by user name, email, plan, bundle, book, vendor..."
                            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 font-semibold outline-none focus:border-emerald-600"
                        />
                    </div>
                </div>

                <div>
                    <label className="font-bold text-slate-600 block mb-1">Source Filter</label>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold bg-slate-50 outline-none">
                        <option value="ALL">All Sources (Plan, Bundle, Book)</option>
                        <option value="Subscription Plan">Subscription Plans Only</option>
                        <option value="Book Bundle">Book Bundles Only</option>
                        <option value="Single Book">Single Books Only</option>
                    </select>
                </div>

                <div>
                    <label className="font-bold text-slate-600 block mb-1">From Date</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold bg-white"
                    />
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="font-bold text-slate-600 block mb-1">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold bg-white"
                        />
                    </div>
                    {(fromDate || toDate || typeFilter !== 'ALL' || searchQuery) && (
                        <button
                            type="button"
                            onClick={() => { setFromDate(''); setToDate(''); setTypeFilter('ALL'); setSearchQuery(''); }}
                            title="Clear Filters"
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-2 rounded-lg self-end cursor-pointer">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* DETAILED AUDIT TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-receipt text-emerald-600"></i>
                        User & Product Revenue Ledger ({filteredTransactions.length} Transactions)
                    </h3>
                    <span className="text-[11px] font-bold text-slate-600">
                        Filtered Platform 70% Share:{' '}
                        <strong className="text-emerald-700 text-sm">
                            ₹{formatINR(filteredTransactions.reduce((acc, x) => acc + (x.platformShare70 || 0), 0))}
                        </strong>
                    </span>
                </div>

                {loading ? (
                    <div className="p-12 text-center font-bold text-slate-400">
                        <i className="fa-solid fa-spinner fa-spin text-2xl text-emerald-600 mb-2 block"></i>
                        Loading 70% Platform Revenue Breakdown...
                    </div>
                ) : filteredTransactions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 space-y-1">
                        <i className="fa-solid fa-coins text-3xl text-slate-300 mb-1"></i>
                        <p className="font-bold">No platform revenue transactions found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[560px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">Txn ID & Date</th>
                                    <th className="p-3">Purchase Type</th>
                                    <th className="p-3">Plan / Bundle / Book Name</th>
                                    <th className="p-3">Purchased By (User)</th>
                                    <th className="p-3">Vendor (30% Split)</th>
                                    <th className="p-3 text-right">Gross (100%)</th>
                                    <th className="p-3 text-right">Vendor (30%)</th>
                                    <th className="p-3 text-right bg-emerald-50/90 text-emerald-900">Platform (70%)</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {filteredTransactions.map((t, idx) => {
                                    const badgeStyle =
                                        t.purchaseType === 'Subscription Plan'
                                            ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                            : t.purchaseType === 'Book Bundle'
                                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                                : 'bg-sky-100 text-sky-800 border-sky-200';

                                    return (
                                        <tr key={t.transactionId + idx} className="hover:bg-slate-50 transition">
                                            <td className="p-3">
                                                <span className="font-mono font-bold text-slate-800 block">{t.transactionId}</span>
                                                <span className="text-[10px] text-slate-500">
                                                    {new Date(t.transactionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeStyle}`}>
                                                    {t.purchaseType}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-slate-900 max-w-xs truncate" title={t.itemTitle}>
                                                {t.itemTitle}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-bold text-slate-800 block">{t.userName}</span>
                                                <span className="text-[10px] text-slate-500">{t.userEmail}</span>
                                            </td>
                                            <td className="p-3 font-semibold text-slate-600">
                                                {t.vendorNames}
                                            </td>
                                            <td className="p-3 text-right font-bold text-slate-700">
                                                ₹{formatINR(t.grossAmount)}
                                            </td>
                                            <td className="p-3 text-right font-bold text-amber-700">
                                                - ₹{formatINR(t.vendorRoyalty30)}
                                            </td>
                                            <td className="p-3 text-right font-black text-emerald-700 bg-emerald-50/40 text-sm">
                                                + ₹{formatINR(t.platformShare70)}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

window.PlatformRevenueMaster = PlatformRevenueMaster;