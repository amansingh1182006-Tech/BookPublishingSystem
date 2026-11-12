// wwwroot/js/BundleMaster.js

function BundleMaster({ triggerToast }) {
    const [bundles, setBundles] = React.useState([]);
    const [availableBooks, setAvailableBooks] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [loadingBooks, setLoadingBooks] = React.useState(false);

    // Page Modes: 'list' (Grid View) | 'form' (Add/Edit Full Page Form)
    const [viewMode, setViewMode] = React.useState('list');
    const [editingBundle, setEditingBundle] = React.useState(null);

    // Form States
    const [bundleName, setBundleName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [selectedBookIds, setSelectedBookIds] = React.useState([]);
    const [discountPercentage, setDiscountPercentage] = React.useState(20);
    const [finalPrice, setFinalPrice] = React.useState(0);
    const [isActive, setIsActive] = React.useState(true);

    const fetchBundles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/bundle/get-all');
            if (res.ok) setBundles(await res.json());
        } catch (e) {
            console.error("Error fetching bundles:", e);
        } finally {
            setLoading(false);
        }
    };

    // FIX: Using exact endpoint `/api/author/book/my-books` from your BookController
    const fetchBooks = async () => {
        setLoadingBooks(true);
        try {
            let res = await fetch('/api/author/book/my-books');
            let data = [];

            if (!res.ok) {
                // Fallback route if route prefix differs
                res = await fetch('/api/reader/catalog/all-books');
            }

            if (res.ok) {
                data = await res.json();
            }

            if (Array.isArray(data)) {
                setAvailableBooks(data.map(b => ({
                    id: b.id || b.Id || b.itemNo || b.ItemNo,
                    itemName: b.itemName || b.ItemName || b.title || 'Untitled Book',
                    isbn: b.isbn || b.ISBN || 'N/A',
                    authorName: b.authorName || b.AuthorName || b.author || 'N/A',
                    price: parseFloat(b.price !== undefined ? b.price : (b.Price !== undefined ? b.Price : 0)) || 0
                })));
            }
        } catch (e) {
            console.error("Error fetching books for bundle:", e);
        } finally {
            setLoadingBooks(false);
        }
    };

    React.useEffect(() => {
        fetchBundles();
        fetchBooks();
    }, []);

    // Calculate Total Original MRP & Auto Final Price based on Selected Books
    const calculatedMRP = React.useMemo(() => {
        return availableBooks
            .filter(b => selectedBookIds.includes(b.id))
            .reduce((sum, b) => sum + (b.price || 0), 0);
    }, [selectedBookIds, availableBooks]);

    // Auto update Final Price when Discount or Selected Books change
    React.useEffect(() => {
        const discountAmount = (calculatedMRP * (parseFloat(discountPercentage) || 0)) / 100;
        const netPrice = Math.max(0, calculatedMRP - discountAmount);
        setFinalPrice(netPrice.toFixed(2));
    }, [calculatedMRP, discountPercentage]);

    const openBundleForm = (bundle = null) => {
        if (bundle) {
            setEditingBundle(bundle);
            setBundleName(bundle.bundleName || bundle.BundleName || '');
            setDescription(bundle.description || bundle.Description || '');
            setDiscountPercentage(bundle.discountPercentage || bundle.DiscountPercentage || 0);
            setFinalPrice(bundle.finalPrice || bundle.FinalPrice || 0);
            setIsActive(bundle.isActive ?? bundle.IsActive ?? true);

            const bookTitles = bundle.bookTitles || bundle.BookTitles || [];
            setSelectedBookIds(bookTitles.map(b => b.bookId || b.BookId));
        } else {
            setEditingBundle(null);
            setBundleName('');
            setDescription('');
            setSelectedBookIds([]);
            setDiscountPercentage(20);
            setFinalPrice(0);
            setIsActive(true);
        }
        setViewMode('form');
    };

    const toggleBookSelection = (bookId) => {
        if (selectedBookIds.includes(bookId)) {
            setSelectedBookIds(selectedBookIds.filter(id => id !== bookId));
        } else {
            setSelectedBookIds([...selectedBookIds, bookId]);
        }
    };

    const handleSaveBundle = async (e) => {
        e.preventDefault();
        if (!bundleName.trim()) {
            alert("Bundle Name is required.");
            return;
        }
        if (selectedBookIds.length === 0) {
            alert("Please select at least 1 book title to create a bundle.");
            return;
        }

        const payload = {
            id: editingBundle ? (editingBundle.id || editingBundle.Id) : null,
            bundleName: bundleName.trim(),
            description: description ? description.trim() : "",
            discountPercentage: parseFloat(discountPercentage) || 0,
            finalPrice: parseFloat(finalPrice) || 0,
            isActive: isActive,
            selectedBookIds: selectedBookIds
        };

        try {
            const res = await fetch('/api/bundle/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast("Book Bundle Master Saved Successfully!");
                setViewMode('list');
                fetchBundles();
            } else {
                alert(data.message || "Failed to save bundle.");
            }
        } catch (err) {
            alert("Error saving bundle: " + err.message);
        }
    };

    const handleDeleteBundle = async (id, name) => {
        if (confirm(`Are you sure you want to delete bundle "${name}"?`)) {
            try {
                const res = await fetch(`/api/bundle/delete/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    if (triggerToast) triggerToast("Bundle Deleted!");
                    fetchBundles();
                }
            } catch (err) {
                alert("Delete error: " + err.message);
            }
        }
    };

    // PAGE VIEW MODE 1: FULL PAGE FORM
    if (viewMode === 'form') {
        return (
            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-6 text-xs">
                {/* PAGE HEADER */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center shadow-sm">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                <i className="fa-solid fa-layer-group text-amber-500"></i>
                                {editingBundle ? 'Edit Book Bundle Page' : 'Create New Book Bundle Master Page'}
                            </h3>
                            <p className="text-xs text-slate-500">Combine multiple books (Basic & Royalty) into a single discounted offer bundle.</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded text-xs cursor-pointer">
                        Cancel Page
                    </button>
                </div>

                <form onSubmit={handleSaveBundle} className="space-y-6">
                    {/* SECTION 1: BUNDLE DETAILS */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-pen-to-square text-indigo-600"></i> 1. Basic Bundle Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Bundle Name / Offer Title *</label>
                                <input
                                    type="text"
                                    required
                                    value={bundleName}
                                    onChange={e => setBundleName(e.target.value)}
                                    placeholder="e.g. B.Jain Best-Seller Medical 5-Book Combo"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-indigo-900 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Short Description</label>
                                <input
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="e.g. Get 40% OFF on buying this 5-book combo set"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-semibold text-slate-800 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: BOOK SELECTION LIST */}
                    <div className="bg-indigo-50/40 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                                <i className="fa-solid fa-book-bookmark text-indigo-600"></i> 2. Select Books for Bundle ({selectedBookIds.length} Selected)
                            </h4>
                            <span className="font-bold text-slate-700">Total Selected Books Count: <strong className="text-indigo-700 text-sm">{selectedBookIds.length}</strong></span>
                        </div>

                        {loadingBooks ? (
                            <div className="text-center py-6 text-slate-500 font-bold">Loading System Books...</div>
                        ) : availableBooks.length === 0 ? (
                            <div className="text-center py-6 text-red-500 font-bold bg-white rounded border border-red-200">
                                No books found in system catalog. Please add books from Book Master first.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 bg-white rounded border border-slate-300">
                                {availableBooks.map(book => {
                                    const isChecked = selectedBookIds.includes(book.id);
                                    return (
                                        <div
                                            key={book.id}
                                            onClick={() => toggleBookSelection(book.id)}
                                            className={`p-3 rounded border cursor-pointer flex items-center justify-between transition ${isChecked ? 'bg-indigo-50 border-indigo-500 font-bold' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}>
                                            <div className="flex items-center gap-2.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => { }}
                                                    className="w-4 h-4 accent-indigo-600 cursor-pointer"
                                                />
                                                <div className="truncate max-w-[180px]">
                                                    <span className="block text-slate-900 truncate font-bold">{book.itemName}</span>
                                                    <span className="text-[10px] text-slate-500">{book.authorName} | ISBN: {book.isbn}</span>
                                                </div>
                                            </div>
                                            <span className="font-extrabold text-emerald-700">₹{book.price}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: PRICING & DISCOUNT CALCULATOR */}
                    <div className="bg-emerald-50/60 p-5 rounded-lg border border-emerald-200 space-y-4">
                        <h4 className="font-bold text-emerald-900 text-sm border-b border-emerald-200 pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-calculator text-emerald-600"></i> 3. Pricing, Discount & Final Offer Price
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Original Total Price (MRP Sum)</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={`₹${calculatedMRP.toFixed(2)}`}
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-extrabold text-slate-700 bg-slate-100"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Discount Percentage (%)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={discountPercentage}
                                    onChange={e => setDiscountPercentage(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-indigo-700 bg-white outline-none focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Final Selling Offer Price (₹) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={finalPrice}
                                    onChange={e => setFinalPrice(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-black text-emerald-800 text-base bg-white outline-none focus:border-emerald-600"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Savings for Customer</label>
                                <input
                                    type="text"
                                    readOnly
                                    value={`₹${Math.max(0, calculatedMRP - finalPrice).toFixed(2)} (${discountPercentage}%)`}
                                    className="w-full border border-emerald-300 rounded px-3 py-2.5 font-bold text-emerald-700 bg-emerald-100/60"
                                />
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM SAVE BAR */}
                    <div className="flex justify-between items-center pt-4 border-t">
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="w-5 h-5 accent-emerald-600 cursor-pointer"
                            /> Live / Published Bundle
                        </label>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded cursor-pointer">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-2.5 rounded shadow cursor-pointer flex items-center gap-2">
                                <i className="fa-solid fa-check"></i> Save Bundle Master
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // PAGE VIEW MODE 2: DIRECTORY LIST GRID
    return (
        <div className="w-full space-y-6 text-xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow border border-slate-200 gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                        <i className="fa-solid fa-layer-group text-amber-500"></i> Book Bundle Master Page
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Create and manage multi-book offers (5, 10, 15 titles) with bundle discount pricing.</p>
                </div>
                <button
                    onClick={() => openBundleForm()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded text-xs shadow flex items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-plus"></i> Create New Bundle Page
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 bg-white rounded-lg border text-slate-400 font-bold">Loading Book Bundles...</div>
            ) : bundles.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed text-slate-500 space-y-3">
                    <i className="fa-solid fa-boxes-stacked text-3xl text-slate-300"></i>
                    <p className="font-semibold">No book bundles created yet.</p>
                    <button onClick={() => openBundleForm()} className="text-indigo-600 font-bold text-xs hover:underline cursor-pointer">
                        + Click here to create your first book bundle offer
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {bundles.map(b => {
                        const bId = b.id || b.Id;
                        const booksList = b.bookTitles || b.BookTitles || [];

                        return (
                            <div key={bId} className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col justify-between relative">
                                <div className="p-5 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <span className="bg-amber-100 text-amber-900 font-bold text-[10px] px-2 py-0.5 rounded border border-amber-200">
                                            {b.numberOfTitles || b.NumberOfTitles} Books Combo
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${b.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                            {b.isActive ? 'Live' : 'Draft'}
                                        </span>
                                    </div>

                                    <h3 className="text-base font-extrabold text-slate-900">{b.bundleName || b.BundleName}</h3>
                                    <p className="text-slate-500 text-[11px] line-clamp-2">{b.description || b.Description || 'Special book collection bundle'}</p>

                                    <div className="bg-slate-50 p-3 rounded-lg border space-y-1">
                                        <div className="flex justify-between font-semibold text-slate-500">
                                            <span>Original MRP:</span>
                                            <span className="line-through">₹{b.totalPrice || b.TotalPrice}</span>
                                        </div>
                                        <div className="flex justify-between items-baseline font-bold text-slate-800">
                                            <span>Offer Price:</span>
                                            <span className="text-xl font-black text-emerald-700">₹{b.finalPrice || b.FinalPrice}</span>
                                        </div>
                                        <div className="text-[10px] text-indigo-600 font-bold text-right">
                                            Save {b.discountPercentage || b.DiscountPercentage}% OFF
                                        </div>
                                    </div>

                                    <div className="space-y-1 pt-1">
                                        <span className="font-bold text-slate-700 block">Included Titles ({booksList.length}):</span>
                                        <div className="space-y-1 max-h-24 overflow-y-auto">
                                            {booksList.map((bk, i) => (
                                                <div key={i} className="flex justify-between text-[11px] text-slate-600 border-b border-dashed pb-0.5">
                                                    <span className="truncate max-w-[180px]">{bk.bookName || bk.BookName}</span>
                                                    <span className="font-semibold">₹{bk.price || bk.Price}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-50 border-t flex justify-between items-center">
                                    <button onClick={() => openBundleForm(b)} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                                        <i className="fa-solid fa-pen"></i> Edit Bundle
                                    </button>
                                    <button onClick={() => handleDeleteBundle(bId, b.bundleName || b.BundleName)} className="text-red-600 font-bold hover:underline cursor-pointer">
                                        <i className="fa-solid fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

window.BundleMaster = BundleMaster;