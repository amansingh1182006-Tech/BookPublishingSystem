
function SingleBookMaster({ triggerToast }) {
    const [salesList, setSalesList] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [booksList, setBooksList] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showAssignForm, setShowAssignForm] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedBookId, setSelectedBookId] = useState('');
    const [customPrice, setCustomPrice] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [salesRes, usersRes, booksRes] = await Promise.all([
                fetch('/api/single-book/admin/all-sales'),
                fetch('/api/admin/admin/all-users'),
                fetch('/api/author/book/my-books')
            ]);

            if (salesRes.ok) setSalesList(await salesRes.json());
            if (usersRes.ok) setUsersList(await usersRes.json());
            if (booksRes.ok) {
                const bks = await booksRes.json();
                setBooksList(Array.isArray(bks) ? bks : []);
            }
        } catch (err) {
            console.error("SingleBookMaster fetch error:", err);
        } finally {
            setLoading(false);
        }
    };
    const journalsRes = await fetch('/api/journal/all');
    if (journalsRes.ok) {
        const jrns = await journalsRes.json();
        const mappedJournals = (Array.isArray(jrns) ? jrns : [])
            .filter(j => j.isActive !== false)
            .map(j => ({
                id: j.id,
                itemName: `[Journal] ${j.name}`,
                price: j.price ?? 0,
                itemType: 'Journal'
            }));
        setBooksList(prev => [...prev, ...mappedJournals]);
    }

    useEffect(() => {
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
        if (!selectedUserId || !selectedBookId) {
            triggerToast("Kripya User aur Book dono select karein.", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/single-book/admin/manual-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUserId,
                    bookId: selectedBookId,
                    itemType: (booksList.find(b => String(b.id) === String(selectedBookId))?.itemType) || 'Book',
                    customPrice: customPrice !== '' ? parseFloat(customPrice) : null
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                triggerToast(data.message);
                setShowAssignForm(false);
                setSelectedUserId('');
                setSelectedBookId('');
                setCustomPrice('');
                await fetchAllData();
            } else {
                triggerToast(data.message || "Assignment failed.", "error");
            }
        } catch (err) {
            triggerToast("Error: " + err.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSale = async (id, bookName) => {
        if (!confirm(`Kya aap '${bookName}' ka yeh purchase record delete karna chahte hain?`)) return;

        try {
            const res = await fetch(`/api/single-book/admin/delete-sale/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                triggerToast("Purchase record deleted!");
                await fetchAllData();
            } else {
                triggerToast(data.message || "Delete failed.", "error");
            }
        } catch (err) {
            triggerToast("Error: " + err.message, "error");
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
                            <label className="font-bold text-slate-700 block mb-1">Select Book (Exact Price Auto-Loads) *</label>
                            <select
                                required
                                value={selectedBookId}
                                onChange={e => handleBookSelect(e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 font-bold outline-none focus:border-emerald-600 bg-slate-50">
                                <option value="">-- Choose Book --</option>
                                {booksList.map(b => (
                                    <option key={b.id} value={b.id}>
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-lg shadow cursor-pointer flex items-center gap-2">
                            <i className="fa-solid fa-check"></i>
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
                    <div className="text-center py-8 text-xs font-bold text-slate-500">Loading single book sales...</div>
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