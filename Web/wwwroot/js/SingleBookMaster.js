function SingleBookMaster({ triggerToast }) {
    const [salesList, setSalesList] = React.useState([]);
    const [usersList, setUsersList] = React.useState([]);
    const [booksList, setBooksList] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const [showAssignForm, setShowAssignForm] = React.useState(false);
    const [selectedUserId, setSelectedUserId] = React.useState('');
    const [selectedBookId, setSelectedBookId] = React.useState('');
    const [customPrice, setCustomPrice] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const submitLockRef = React.useRef(false);

    const safeParse = async (res) => {
        if (!res) return null;
        if (typeof window.safeJsonParse === 'function') return await window.safeJsonParse(res);
        try {
            const txt = await res.text();
            return txt && txt.trim() ? JSON.parse(txt) : null;
        } catch {
            return null;
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [salesRes, usersRes, booksRes, journalsRes] = await Promise.all([
                fetch('/api/single-book/admin/all-sales').catch(() => null),
                fetch('/api/admin/admin/all-users').catch(() => null),
                fetch('/api/author/book/my-books').catch(() => null),
                fetch('/api/journal/all').catch(() => null)
            ]);

            if (salesRes && salesRes.ok) {
                const salesData = await safeParse(salesRes);
                setSalesList(Array.isArray(salesData) ? salesData : []);
            }

            if (usersRes && usersRes.ok) {
                const usersData = await safeParse(usersRes);
                setUsersList(Array.isArray(usersData) ? usersData : []);
            }

            let combinedBooks = [];
            if (booksRes && booksRes.ok) {
                const bks = await safeParse(booksRes);
                if (Array.isArray(bks)) {
                    combinedBooks = bks.map(b => ({
                        ...b,
                        id: b.id || b.Id,
                        itemName: b.itemName || b.ItemName || 'Untitled Book',
                        price: b.price !== undefined ? b.price : (b.Price ?? 0),
                        itemType: b.itemType || 'Book'
                    }));
                }
            }

            if (journalsRes && journalsRes.ok) {
                const jrns = await safeParse(journalsRes);
                const mappedJournals = (Array.isArray(jrns) ? jrns : [])
                    .filter(j => (j.isActive ?? j.IsActive) !== false)
                    .map(j => ({
                        id: j.id || j.Id,
                        itemName: `[Journal] ${j.name || j.Name}`,
                        price: j.price ?? j.Price ?? 0,
                        itemType: 'Journal'
                    }));
                combinedBooks = [...combinedBooks, ...mappedJournals];
            }

            setBooksList(combinedBooks);
        } catch (err) {
            console.error("SingleBookMaster fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchAllData();
    }, []);

    const handleBookSelect = (bId) => {
        setSelectedBookId(bId);
        const found = booksList.find(b => String(b.id) === String(bId));
        if (found) {
            setCustomPrice(found.price !== undefined ? found.price : 0);
        } else {
            setCustomPrice('');
        }
    };

    const handleManualAssignSubmit = async (e) => {
        e.preventDefault();
        if (submitLockRef.current) return;

        if (!selectedUserId || !selectedBookId) {
            if (triggerToast) triggerToast("Kripya User aur Book dono select karein.", "error");
            return;
        }

        submitLockRef.current = true;
        setIsSubmitting(true);
        try {
            const matchedItem = booksList.find(b => String(b.id) === String(selectedBookId));
            const res = await fetch('/api/single-book/admin/manual-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUserId,
                    bookId: selectedBookId,
                    itemType: matchedItem?.itemType || 'Book',
                    customPrice: customPrice !== '' ? parseFloat(customPrice) : null
                })
            });

            const data = (await safeParse(res)) || {};
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast(data.message || "Book assigned successfully!");
                setShowAssignForm(false);
                setSelectedUserId('');
                setSelectedBookId('');
                setCustomPrice('');
                await fetchAllData();
            } else {
                if (triggerToast) triggerToast(data.message || `Assignment failed (${res.status}).`, "error");
            }
        } catch (err) {
            if (triggerToast) triggerToast("Error: " + err.message, "error");
        } finally {
            setIsSubmitting(false);
            submitLockRef.current = false;
        }
    };

    const handleDeleteSale = async (id, bookName) => {
        if (!confirm(`Kya aap '${bookName}' ka yeh purchase record delete karna chahte hain?`)) return;

        try {
            const encodedId = encodeURIComponent(String(id).trim());
            let res = await fetch(`/api/single-book/admin/delete-sale/${encodedId}`, { method: 'DELETE' });
            if (res.status === 405) {
                res = await fetch(`/api/single-book/admin/delete-sale/${encodedId}`, { method: 'POST' });
            }

            const data = (await safeParse(res)) || {};
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast("Purchase record deleted!");
                await fetchAllData();
            } else {
                if (triggerToast) triggerToast(data.message || `Delete failed (${res.status}).`, "error");
            }
        } catch (err) {
            if (triggerToast) triggerToast("Error: " + err.message, "error");
        }
    };

    const totalRevenue = salesList.reduce((acc, item) => acc + (Number(item.amountPaid) || 0), 0);

    return (
        <div className="w-full space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-black text-[#0d233a] flex items-center gap-2">
                        <i className="fa-solid fa-book-open-reader text-[#e31b23]"></i>
                        Single Book Purchase Master & Manual Allocation
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Individual book sales dekhein ya kisi customer ko manual single book assign/sell karein.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-xs">
                        <span className="text-slate-500 font-bold block">Total Single Book Revenue</span>
                        <span className="text-emerald-700 font-black text-base">₹{totalRevenue.toLocaleString('en-IN')}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowAssignForm(!showAssignForm)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-lg text-xs shadow transition cursor-pointer flex items-center gap-2">
                        <i className={`fa-solid ${showAssignForm ? 'fa-xmark' : 'fa-plus'}`}></i>
                        {showAssignForm ? 'Close Manual Form' : 'Manual Assign / Sell Single Book'}
                    </button>
                </div>
            </div>

            {showAssignForm && (
                <form onSubmit={handleManualAssignSubmit} className="bg-white p-6 rounded-xl border-t-4 border-emerald-600 shadow-md space-y-4 text-xs">
                    <h4 className="font-black text-sm text-[#0d233a] border-b pb-2">
                        <i className="fa-solid fa-hand-holding-dollar text-emerald-600 me-1.5"></i>
                        Manual Single Book Purchase / Allocation Entry
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Select Registered Customer / User *</label>
                            <select
                                required
                                value={selectedUserId}
                                onChange={e => setSelectedUserId(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 font-bold outline-none focus:border-emerald-600 bg-slate-50">
                                <option value="">-- Choose User --</option>
                                {usersList.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.fullName || u.email} ({u.email})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Select Book / Journal (Exact Price Auto-Loads) *</label>
                            <select
                                required
                                value={selectedBookId}
                                onChange={e => handleBookSelect(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 font-bold outline-none focus:border-emerald-600 bg-slate-50">
                                <option value="">-- Choose Book / Journal --</option>
                                {booksList.map(b => (
                                    <option key={`${b.itemType || 'Book'}_${b.id}`} value={b.id}>
                                        {b.itemName} (₹{b.price})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="font-bold text-slate-700 block mb-1">Book Selling Price (₹) *</label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={customPrice}
                                onChange={e => setCustomPrice(e.target.value)}
                                placeholder="Book Price in ₹"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 font-black text-emerald-700 outline-none focus:border-emerald-600"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowAssignForm(false)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-5 py-2 rounded-lg cursor-pointer">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-6 py-2 rounded-lg shadow cursor-pointer flex items-center gap-2">
                            <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                            {isSubmitting ? 'Processing...' : 'Confirm Single Book Sale'}
                        </button>
                    </div>
                </form>
            )}

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-sm text-[#0d233a] border-b pb-2 flex items-center justify-between">
                    <span><i className="fa-solid fa-receipt text-[#e31b23] me-2"></i>Single Book Purchases List ({salesList.length})</span>
                </h4>

                {loading ? (
                    <div className="text-center py-8 text-xs font-bold text-slate-500">
                        <i className="fa-solid fa-spinner fa-spin text-emerald-600 me-2"></i>Loading single book sales...
                    </div>
                ) : salesList.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 bg-slate-50 rounded-lg border border-dashed">
                        Abhi tak koi single book purchase record nahi hai.
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-100 text-slate-600 uppercase font-bold border-b">
                                <tr>
                                    <th className="p-3">Order / Txn ID</th>
                                    <th className="p-3">Customer Name</th>
                                    <th className="p-3">Email</th>
                                    <th className="p-3">Book Code</th>
                                    <th className="p-3">Book Title</th>
                                    <th className="p-3">Amount Paid</th>
                                    <th className="p-3">Purchase Date</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {salesList.map(sale => (
                                    <tr key={sale.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono font-bold text-indigo-700">{sale.transactionId}</td>
                                        <td className="p-3 font-bold text-slate-900">{sale.custName}</td>
                                        <td className="p-3 text-slate-600">{sale.emailId}</td>
                                        <td className="p-3 font-mono text-slate-600">{sale.itemNo}</td>
                                        <td className="p-3 font-bold text-[#0d233a]">{sale.bookName}</td>
                                        <td className="p-3 font-black text-emerald-700">₹{sale.amountPaid}</td>
                                        <td className="p-3 text-slate-500">{new Date(sale.purchasedAt).toLocaleDateString('en-IN')}</td>
                                        <td className="p-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSale(sale.id, sale.bookName)}
                                                className="text-red-600 hover:underline font-bold cursor-pointer">
                                                <i className="fa-solid fa-trash me-1"></i>Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

window.SingleBookMaster = SingleBookMaster;