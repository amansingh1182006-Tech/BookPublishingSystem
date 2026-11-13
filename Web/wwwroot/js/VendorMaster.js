// wwwroot/js/VendorMaster.js

function VendorMaster({ booksList = [], triggerToast }) {
    const [vendors, setVendors] = React.useState([]);
    const [vendorBooks, setVendorBooks] = React.useState([]);
    const [earningsData, setEarningsData] = React.useState({
        totalEarned: 0,
        singleSalesEarned: 0,
        bundleSalesEarned: 0,
        planSalesEarned: 0,
        transactions: []
    });
    const [loading, setLoading] = React.useState(false);

    // Page Modes: 'list' (Directory Table), 'vendorForm' (Add/Edit Vendor), 'profile' (Vendor Detail), 'royaltyForm' (Configure Per-Book Royalty)
    const [viewMode, setViewMode] = React.useState('list');
    const [selectedVendor, setSelectedVendor] = React.useState(null);
    const [editingVendor, setEditingVendor] = React.useState(null);

    // Vendor Form Fields State
    const [vendorCode, setVendorCode] = React.useState('');
    const [vendorName, setVendorName] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [postalCode, setPostalCode] = React.useState('');
    const [gstin, setGstin] = React.useState('');
    const [bankAccountNo, setBankAccountNo] = React.useState('');
    const [ifscCode, setIfscCode] = React.useState('');
    const [address, setAddress] = React.useState('');

    // Per-Book Royalty Rule Form Fields State
    const [selectedBookId, setSelectedBookId] = React.useState('');
    const [isRoyaltyApplicable, setIsRoyaltyApplicable] = React.useState(true);
    const [thresholdPages, setThresholdPages] = React.useState(100);
    const [royaltyPercentage, setRoyaltyPercentage] = React.useState(30);
    const [flatAmount, setFlatAmount] = React.useState(0);
    const [publishingStartDate, setPublishingStartDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [liveStatus, setLiveStatus] = React.useState('Live');

    const fetchVendors = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/vendor/get-all');
            if (res.ok) {
                const data = await res.json();
                setVendors(data);
                if (selectedVendor) {
                    const updated = data.find(v => (v.id || v.Id) === (selectedVendor.id || selectedVendor.Id));
                    if (updated) setSelectedVendor(updated);
                }
            }
        } catch (e) {
            console.error("Fetch vendors error:", e);
        } finally {
            setLoading(false);
        }
    };

    // Is Vendor ke naam (VendorName) ya VendorId se upload hui sabhi books fetch karein
    const fetchBooksForVendor = async (vendorObj) => {
        if (!vendorObj) return [];
        const vId = vendorObj.id || vendorObj.Id;
        const vName = (vendorObj.name || vendorObj.Name || vendorObj.vendorName || vendorObj.VendorName || '').trim().toLowerCase();

        try {
            const res = await fetch(`/api/vendor/vendor-books/${vId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.books)) {
                    setVendorBooks(data.books);
                    return data.books;
                }
            }
        } catch (e) {
            console.warn("Vendor books API fallback:", e);
        }

        // Fallback: booksList prop ya /api/author/book/my-books se match karein
        let sourceBooks = booksList;
        if (!sourceBooks || sourceBooks.length === 0) {
            try {
                const resAll = await fetch('/api/author/book/my-books');
                if (resAll.ok) sourceBooks = await resAll.json();
            } catch (e) { }
        }

        const matched = (sourceBooks || []).filter(b => {
            const raw = b.raw || b;
            const bVid = raw.vendorId || raw.VendorId;
            const bVname = (raw.vendorName || raw.VendorName || '').trim().toLowerCase();
            return (vId && String(bVid) === String(vId)) || (vName && bVname === vName);
        }).map(b => {
            const raw = b.raw || b;
            return {
                id: raw.id || raw.Id || b.id,
                itemNo: raw.itemNo || raw.ItemNo || b.itemNo,
                itemName: raw.itemName || raw.ItemName || b.itemName,
                noOfPages: raw.noOfPages || raw.NoOfPages || b.noOfPages || 0,
                price: raw.price !== undefined ? raw.price : (b.price || 0)
            };
        });

        setVendorBooks(matched);
        return matched;
    };

    // Vendor ki 30% Pool Royalty Earnings (Single, Bundle & Plan) fetch karein
    const fetchVendorEarnings = async (vendorId) => {
        if (!vendorId) return;
        try {
            const res = await fetch(`/api/vendor/earnings/${vendorId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setEarningsData({
                        totalEarned: data.totalEarned || 0,
                        singleSalesEarned: data.singleSalesEarned || 0,
                        bundleSalesEarned: data.bundleSalesEarned || 0,
                        planSalesEarned: data.planSalesEarned || 0,
                        transactions: data.transactions || []
                    });
                    return;
                }
            }
        } catch (e) {
            console.warn("Earnings fetch skipped:", e);
        }
        setEarningsData({
            totalEarned: 0,
            singleSalesEarned: 0,
            bundleSalesEarned: 0,
            planSalesEarned: 0,
            transactions: []
        });
    };

    const handleOpenVendorProfile = async (vendor) => {
        setSelectedVendor(vendor);
        setViewMode('profile');
        const vId = vendor.id || vendor.Id;
        await Promise.all([
            fetchBooksForVendor(vendor),
            fetchVendorEarnings(vId)
        ]);
    };

    const openVendorFormPage = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setVendorCode(vendor.vendorCode || vendor.VendorCode || '');
            setVendorName(vendor.name || vendor.Name || vendor.vendorName || vendor.VendorName || '');
            setPhone(vendor.phone || vendor.Phone || '');
            setEmail(vendor.email || vendor.Email || '');
            setPostalCode(vendor.postalCode || vendor.PostalCode || '');
            setGstin(vendor.gstin || vendor.Gstin || '');
            setBankAccountNo(vendor.bankAccountNo || vendor.BankAccountNo || '');
            setIfscCode(vendor.ifsc || vendor.IFSC || vendor.ifscCode || vendor.IfscCode || '');
            setAddress(vendor.address || vendor.Address || '');
        } else {
            setEditingVendor(null);
            setVendorCode('VND-' + Math.floor(1000 + Math.random() * 9000));
            setVendorName('');
            setPhone('');
            setEmail('');
            setPostalCode('');
            setGstin('');
            setBankAccountNo('');
            setIfscCode('');
            setAddress('');
        }
        setViewMode('vendorForm');
    };

    const openRoyaltyFormPage = async (preselectedBook = null) => {
        let currentBooks = vendorBooks;
        if ((!currentBooks || currentBooks.length === 0) && selectedVendor) {
            currentBooks = await fetchBooksForVendor(selectedVendor);
        }

        const targetBook = preselectedBook || (currentBooks && currentBooks.length > 0 ? currentBooks[0] : null);
        const targetBookId = targetBook ? (targetBook.id || targetBook.Id) : '';
        setSelectedBookId(targetBookId);

        // Agar is book ka rule pehle se bana hai toh values pre-fill karein
        const existingRules = selectedVendor?.royaltyRules || selectedVendor?.RoyaltyRules || [];
        const existingRule = existingRules.find(r => String(r.bookId || r.BookId) === String(targetBookId));

        if (existingRule) {
            setIsRoyaltyApplicable(existingRule.isRoyaltyApplicable ?? existingRule.IsRoyaltyApplicable ?? true);
            setThresholdPages(existingRule.royaltyPageThreshold || existingRule.RoyaltyPageThreshold || 100);
            setRoyaltyPercentage(existingRule.royaltyPercentage ?? existingRule.RoyaltyPercentage ?? 30);
            setFlatAmount(existingRule.royaltyFlatAmount ?? existingRule.RoyaltyFlatAmount ?? 0);
            const dt = existingRule.publishingStartDate || existingRule.PublishingStartDate;
            setPublishingStartDate(dt ? new Date(dt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
            setLiveStatus(existingRule.liveStatus || existingRule.LiveStatus || 'Live');
        } else {
            setIsRoyaltyApplicable(true);
            setThresholdPages(100);
            setRoyaltyPercentage(30);
            setFlatAmount(0);
            setPublishingStartDate(new Date().toISOString().split('T')[0]);
            setLiveStatus('Live');
        }

        setViewMode('royaltyForm');
    };

    // Jab dropdown mein book change ho, toh uska existing rule check karke auto-fill karein
    const handleBookDropdownChange = (newBookId) => {
        setSelectedBookId(newBookId);
        const existingRules = selectedVendor?.royaltyRules || selectedVendor?.RoyaltyRules || [];
        const existingRule = existingRules.find(r => String(r.bookId || r.BookId) === String(newBookId));

        if (existingRule) {
            setIsRoyaltyApplicable(existingRule.isRoyaltyApplicable ?? existingRule.IsRoyaltyApplicable ?? true);
            setThresholdPages(existingRule.royaltyPageThreshold || existingRule.RoyaltyPageThreshold || 100);
            setRoyaltyPercentage(existingRule.royaltyPercentage ?? existingRule.RoyaltyPercentage ?? 30);
            setFlatAmount(existingRule.royaltyFlatAmount ?? existingRule.RoyaltyFlatAmount ?? 0);
            setLiveStatus(existingRule.liveStatus || existingRule.LiveStatus || 'Live');
        } else {
            setIsRoyaltyApplicable(true);
            setThresholdPages(100);
            setRoyaltyPercentage(30);
            setFlatAmount(0);
            setLiveStatus('Live');
        }
    };

    React.useEffect(() => {
        fetchVendors();

        const handleGlobalOpenVendor = () => openVendorFormPage(null);
        window.addEventListener('open-vendor-create-modal', handleGlobalOpenVendor);

        const attachOuterBtnClick = () => {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                if (btn.innerText.includes('Add Vendor') || btn.innerText.includes('Create Vendor')) {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        openVendorFormPage(null);
                    };
                }
            });
        };

        const timer = setTimeout(attachOuterBtnClick, 300);
        return () => {
            window.removeEventListener('open-vendor-create-modal', handleGlobalOpenVendor);
            clearTimeout(timer);
        };
    }, []);

    const handleSaveVendor = async (e) => {
        e.preventDefault();
        if (!vendorName.trim()) {
            alert("Vendor Name is required.");
            return;
        }

        const payload = {
            id: editingVendor ? (editingVendor.id || editingVendor.Id) : null,
            vendorCode: vendorCode,
            name: vendorName.trim(),
            phone: phone,
            email: email,
            postalCode: postalCode,
            gstin: gstin,
            bankAccountNo: bankAccountNo,
            ifsc: ifscCode,
            address: address
        };

        try {
            const res = await fetch('/api/vendor/save-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const rawText = await res.text();
            let data = {};
            if (rawText && rawText.trim().length > 0) {
                try { data = JSON.parse(rawText); } catch (err) { }
            }

            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast(data.message || "Vendor Profile Saved Successfully!");
                await fetchVendors();
                setViewMode(selectedVendor ? 'profile' : 'list');
            } else {
                if (data.errors) {
                    const errorList = Object.values(data.errors).flat().join('\n');
                    alert("Validation Error:\n" + errorList);
                } else {
                    alert(data.message || `Failed to save vendor profile (Status: ${res.status}).`);
                }
            }
        } catch (err) {
            alert("Save vendor error: " + err.message);
        }
    };

    const handleSaveRoyaltyRule = async (e) => {
        e.preventDefault();
        if (!selectedVendor || !selectedBookId) {
            alert("Vendor and Book selection are required.");
            return;
        }

        const matchedBookObj = vendorBooks.find(b => String(b.id || b.Id) === String(selectedBookId));
        const resolvedBookName = matchedBookObj ? (matchedBookObj.itemName || matchedBookObj.ItemName || '') : '';

        const payload = {
            vendorId: selectedVendor.id || selectedVendor.Id,
            bookId: selectedBookId,
            bookName: resolvedBookName,
            isRoyaltyApplicable: isRoyaltyApplicable,
            royaltyPageThreshold: isRoyaltyApplicable ? (parseInt(thresholdPages, 10) || 0) : 0,
            royaltyPercentage: isRoyaltyApplicable ? (parseFloat(royaltyPercentage) || 0) : 0,
            royaltyFlatAmount: isRoyaltyApplicable ? (parseFloat(flatAmount) || 0) : 0,
            publishingStartDate: publishingStartDate,
            liveStatus: liveStatus,
            status: 'Active'
        };

        try {
            const res = await fetch('/api/vendor/add-royalty-rule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast("Per-Book Royalty Rule Saved Successfully!");
                await fetchVendors();
                setViewMode('profile');
            } else {
                alert(data.message || "Failed to save royalty rule.");
            }
        } catch (err) {
            alert("Save royalty error: " + err.message);
        }
    };

    const handleDeleteRoyaltyRule = async (ruleId) => {
        if (!confirm("Are you sure you want to remove this book's royalty rule?")) return;
        try {
            const res = await fetch(`/api/vendor/delete-royalty-rule/${ruleId}`, { method: 'DELETE' });
            if (res.ok) {
                if (triggerToast) triggerToast("Royalty Rule Removed!");
                await fetchVendors();
            }
        } catch (err) {
            alert("Error deleting rule: " + err.message);
        }
    };

    const handleDeleteVendor = async (vendorId, name) => {
        if (confirm(`Are you sure you want to delete vendor "${name}"?`)) {
            try {
                const res = await fetch(`/api/vendor/delete/${vendorId}`, { method: 'DELETE' });
                if (res.ok) {
                    if (triggerToast) triggerToast("Vendor Profile Deleted!");
                    if (selectedVendor && (selectedVendor.id || selectedVendor.Id) === vendorId) {
                        setSelectedVendor(null);
                        setViewMode('list');
                    }
                    fetchVendors();
                }
            } catch (err) {
                alert("Delete error: " + err.message);
            }
        }
    };

    // -------------------------------------------------------------
    // PAGE VIEW 1: VENDOR PROFILE & BANK FORM PAGE
    // -------------------------------------------------------------
    if (viewMode === 'vendorForm') {
        return (
            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setViewMode(selectedVendor ? 'profile' : 'list')}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                <i className="fa-solid fa-address-book text-indigo-600"></i>
                                {editingVendor ? 'Edit Vendor Profile Page' : 'Create New Vendor Profile Page'}
                            </h3>
                            <p className="text-xs text-slate-500">Fill in complete contact and banking details in the responsive page form below.</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewMode(selectedVendor ? 'profile' : 'list')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded text-xs cursor-pointer">
                        Cancel Page
                    </button>
                </div>

                <form onSubmit={handleSaveVendor} className="space-y-6 text-xs">
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-user-gear text-indigo-600"></i> 1. Vendor Identity & Contact Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Vendor Code *</label>
                                <input type="text" required value={vendorCode} onChange={e => setVendorCode(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold bg-slate-100 text-indigo-900" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Vendor Name *</label>
                                <input type="text" required value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="e.g. Aman Singh" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-900 outline-none focus:border-indigo-600" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Phone Number *</label>
                                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 9876543210" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-800 outline-none focus:border-indigo-600" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Email Address *</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-800 outline-none focus:border-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50/40 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <h4 className="font-bold text-indigo-900 text-sm border-b border-indigo-200 pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-building-columns text-indigo-600"></i> 2. Banking & Tax Identification
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">GSTIN Number</label>
                                <input type="text" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="22AAAAA0000A1Z5" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold uppercase text-slate-800 bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Postal Code</label>
                                <input type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="110001" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-800 bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Bank Account No.</label>
                                <input type="text" value={bankAccountNo} onChange={e => setBankAccountNo(e.target.value)} placeholder="Account Number" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-800 bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">IFSC Code</label>
                                <input type="text" value={ifscCode} onChange={e => setIfscCode(e.target.value)} placeholder="SBIN000123" className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold uppercase text-slate-800 bg-white" />
                            </div>
                        </div>
                        <div>
                            <label className="font-bold block mb-1.5 text-slate-700">Full Business Address</label>
                            <textarea rows="3" value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter street address, city, state..." className="w-full border border-gray-300 rounded px-3 py-2 font-semibold text-slate-800 bg-white"></textarea>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setViewMode(selectedVendor ? 'profile' : 'list')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded">Cancel</button>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-2.5 rounded shadow flex items-center gap-2 cursor-pointer">
                            <i className="fa-solid fa-check"></i> Save Vendor Profile
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // -------------------------------------------------------------
    // PAGE VIEW 2: CONFIGURE PER-BOOK ROYALTY RULE PAGE
    // -------------------------------------------------------------
    if (viewMode === 'royaltyForm') {
        const displayVendorName = selectedVendor?.name || selectedVendor?.Name || selectedVendor?.vendorName || selectedVendor?.VendorName || '';
        const selectedBk = vendorBooks.find(b => String(b.id || b.Id) === String(selectedBookId));
        const totalPg = selectedBk ? (selectedBk.noOfPages || selectedBk.NoOfPages || 0) : 0;
        const thresh = parseInt(thresholdPages, 10) || 0;
        const calculatedPts = (isRoyaltyApplicable && thresh > 0) ? (totalPg / thresh).toFixed(2) : "0.00";

        return (
            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setViewMode('profile')}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                <i className="fa-solid fa-book-bookmark text-indigo-600"></i>
                                Configure Per-Book Royalty & 30% Revenue Pool Weight
                            </h3>
                            <p className="text-xs text-slate-500">
                                Vendor: <span className="font-bold text-indigo-900">{displayVendorName}</span> | Applies automatically to Single Book, Bundle, and Plan purchases.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewMode('profile')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded text-xs cursor-pointer">
                        Cancel Page
                    </button>
                </div>

                <form onSubmit={handleSaveRoyaltyRule} className="space-y-6 text-xs">
                    {/* 1. SELECT TARGET BOOK */}
                    <div className="bg-indigo-50/50 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <h4 className="font-bold text-indigo-900 text-sm border-b border-indigo-200 pb-2">
                            1. Select Target Book (Uploaded under {displayVendorName})
                        </h4>
                        <div>
                            <label className="font-bold block mb-1 text-slate-700">Select Book *</label>
                            <select
                                required
                                value={selectedBookId}
                                onChange={e => handleBookDropdownChange(e.target.value)}
                                className="w-full border rounded px-3 py-2.5 font-bold text-indigo-900 bg-white">
                                <option value="">
                                    {vendorBooks.length > 0
                                        ? `-- Select Book (${vendorBooks.length} Available) --`
                                        : `-- No books uploaded under '${displayVendorName}' yet --`}
                                </option>
                                {vendorBooks.map(b => (
                                    <option key={b.id || b.Id} value={b.id || b.Id}>
                                        {b.itemName || b.ItemName} ({b.noOfPages || b.NoOfPages} Pages | MRP: ₹{b.price !== undefined ? b.price : b.Price})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 2. ROYALTY & 30% POOL WEIGHT PARAMETERS */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <div className="flex flex-wrap justify-between items-center border-b pb-2 gap-2">
                            <h4 className="font-bold text-slate-800 text-sm">2. Royalty Calculations & 30% Pool Weight Parameters</h4>
                            <span className={`px-3 py-1 rounded-full font-extrabold text-xs ${isRoyaltyApplicable ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-200 text-slate-700'}`}>
                                {isRoyaltyApplicable
                                    ? `Calculated Book Weight: ${calculatedPts} Points (${totalPg} Pages ÷ ${thresh || 1})`
                                    : 'Basic Book (0 Points — No Royalty Share)'}
                            </span>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-[11px] text-amber-900">
                            <strong>Revenue Split Rule:</strong> Jab bhi user koi <strong>Single Book</strong>, <strong>Bundle</strong>, ya <strong>Subscription Plan</strong> kharidega, total revenue ka <strong>30% Royalty Pool</strong> us order mein shamil sabhi <strong>Royalty Books</strong> ke Points ke ratio mein unke vendors ko turant credit ho jayega.
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Is Royalty Applicable? *</label>
                                <select
                                    value={isRoyaltyApplicable ? "Yes" : "No"}
                                    onChange={e => setIsRoyaltyApplicable(e.target.value === "Yes")}
                                    className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="Yes">Yes (Royalty Book — Gets 30% Pool Share)</option>
                                    <option value="No">No (Basic Book — 0% Royalty)</option>
                                </select>
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Pages Per 1 Point (Threshold) *</label>
                                <input
                                    type="number"
                                    min="1"
                                    disabled={!isRoyaltyApplicable}
                                    value={thresholdPages}
                                    onChange={e => setThresholdPages(e.target.value)}
                                    className="w-full border rounded px-3 py-2.5 font-bold bg-white disabled:bg-slate-100"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Royalty Pool Share (%) *</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    disabled={!isRoyaltyApplicable}
                                    value={royaltyPercentage}
                                    onChange={e => setRoyaltyPercentage(e.target.value)}
                                    className="w-full border rounded px-3 py-2.5 font-extrabold text-emerald-700 bg-white disabled:bg-slate-100"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Flat Amount (₹ - Optional)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    disabled={!isRoyaltyApplicable}
                                    value={flatAmount}
                                    onChange={e => setFlatAmount(e.target.value)}
                                    className="w-full border rounded px-3 py-2.5 font-bold bg-white disabled:bg-slate-100"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Publishing Start Date</label>
                                <input
                                    type="date"
                                    value={publishingStartDate}
                                    onChange={e => setPublishingStartDate(e.target.value)}
                                    className="w-full border rounded px-3 py-2.5 font-bold bg-white"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Live Status</label>
                                <select
                                    value={liveStatus}
                                    onChange={e => setLiveStatus(e.target.value)}
                                    className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="Live">Live</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setViewMode('profile')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded cursor-pointer">Cancel</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded shadow flex items-center gap-2 cursor-pointer">
                            <i className="fa-solid fa-check"></i> Save Per-Book Royalty Rule
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // -------------------------------------------------------------
    // PAGE VIEW 3: DETAILED VENDOR PROFILE & ROYALTY LEDGER PAGE
    // -------------------------------------------------------------
    if (viewMode === 'profile' && selectedVendor) {
        const rules = selectedVendor.royaltyRules || selectedVendor.RoyaltyRules || [];
        const displayIfsc = selectedVendor.ifsc || selectedVendor.IFSC || selectedVendor.ifscCode || selectedVendor.IfscCode;
        const displayVendorName = selectedVendor.name || selectedVendor.Name || selectedVendor.vendorName || selectedVendor.VendorName || 'Vendor Profile';

        return (
            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-6 text-xs">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setSelectedVendor(null); setViewMode('list'); }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded cursor-pointer flex items-center gap-1.5">
                            <i className="fa-solid fa-arrow-left"></i> Back to Directory Page
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                {displayVendorName}
                                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded font-bold border border-indigo-200">
                                    {selectedVendor.vendorCode || selectedVendor.VendorCode}
                                </span>
                            </h2>
                            <p className="text-slate-500 text-[11px]">Vendor Master Profile, Per-Book Royalty Config & 30% Pool Revenue Ledger</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => openVendorFormPage(selectedVendor)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded cursor-pointer">
                            <i className="fa-solid fa-pen"></i> Edit Profile Page
                        </button>
                        <button
                            onClick={() => openRoyaltyFormPage()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded shadow cursor-pointer flex items-center gap-1.5">
                            <i className="fa-solid fa-plus"></i> Configure Book Royalty
                        </button>
                    </div>
                </div>

                {/* 30% ROYALTY POOL EARNINGS SUMMARY CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase block">Total Royalty Earned (30% Pool)</span>
                        <span className="text-2xl font-black text-emerald-900 mt-1 block">₹{Number(earningsData.totalEarned).toFixed(2)}</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                        <span className="text-[11px] font-bold text-blue-700 uppercase block">From Single Book Sales</span>
                        <span className="text-xl font-extrabold text-blue-900 mt-1 block">₹{Number(earningsData.singleSalesEarned).toFixed(2)}</span>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                        <span className="text-[11px] font-bold text-amber-700 uppercase block">From Bundle Sales</span>
                        <span className="text-xl font-extrabold text-amber-900 mt-1 block">₹{Number(earningsData.bundleSalesEarned).toFixed(2)}</span>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                        <span className="text-[11px] font-bold text-purple-700 uppercase block">From Plan Subscriptions</span>
                        <span className="text-xl font-extrabold text-purple-900 mt-1 block">₹{Number(earningsData.planSalesEarned).toFixed(2)}</span>
                    </div>
                </div>

                {/* CONTACT & BANKING INFO */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-address-card text-indigo-600"></i> Vendor Contact & Banking Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded border border-slate-200">
                        <div>
                            <span className="text-slate-400 block font-semibold">Phone Number</span>
                            <span className="font-bold text-slate-800">{selectedVendor.phone || selectedVendor.Phone || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-semibold">Email Address</span>
                            <span className="font-bold text-slate-800">{selectedVendor.email || selectedVendor.Email || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-semibold">GSTIN / Tax ID</span>
                            <span className="font-bold text-slate-800">{selectedVendor.gstin || selectedVendor.Gstin || 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-slate-400 block font-semibold">Postal Code</span>
                            <span className="font-bold text-slate-800">{selectedVendor.postalCode || selectedVendor.PostalCode || 'N/A'}</span>
                        </div>
                        <div className="md:col-span-2 border-t pt-2">
                            <span className="text-slate-400 block font-semibold">Bank Account & IFSC</span>
                            <span className="font-bold text-slate-800">
                                {selectedVendor.bankAccountNo || selectedVendor.BankAccountNo || 'N/A'}
                                {displayIfsc ? ` (${displayIfsc})` : ''}
                            </span>
                        </div>
                        <div className="md:col-span-2 border-t pt-2">
                            <span className="text-slate-400 block font-semibold">Address</span>
                            <span className="font-bold text-slate-800">{selectedVendor.address || selectedVendor.Address || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                {/* UPLOADED BOOKS BY THIS VENDOR (WITH QUICK ROYALTY STATUS & ACTION) */}
                <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-book-open text-blue-600"></i> Books Uploaded Under {displayVendorName} ({vendorBooks.length})
                    </h4>
                    {vendorBooks.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded border border-dashed text-slate-400">
                            No books uploaded with Vendor Name "{displayVendorName}" yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-blue-50 text-blue-900 font-bold border-b">
                                        <th className="p-3">Book Code</th>
                                        <th className="p-3">Book Title</th>
                                        <th className="p-3">Pages</th>
                                        <th className="p-3">MRP</th>
                                        <th className="p-3">Royalty Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vendorBooks.map(b => {
                                        const mappedRule = rules.find(r => String(r.bookId || r.BookId) === String(b.id));
                                        const isRoy = mappedRule ? (mappedRule.isRoyaltyApplicable ?? mappedRule.IsRoyaltyApplicable) : null;
                                        const thresh = mappedRule ? (mappedRule.royaltyPageThreshold ?? mappedRule.RoyaltyPageThreshold ?? 0) : 0;
                                        const pts = (mappedRule && isRoy && thresh > 0) ? ((b.noOfPages || 0) / thresh).toFixed(2) : 0;

                                        return (
                                            <tr key={b.id} className="border-b hover:bg-slate-50">
                                                <td className="p-3 font-mono font-bold text-slate-600">{b.itemNo}</td>
                                                <td className="p-3 font-bold text-slate-900">{b.itemName}</td>
                                                <td className="p-3">{b.noOfPages} Pages</td>
                                                <td className="p-3 font-bold text-emerald-700">₹{b.price}</td>
                                                <td className="p-3">
                                                    {!mappedRule ? (
                                                        <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">Pending Setup</span>
                                                    ) : isRoy ? (
                                                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                            Royalty ({pts} Pts)
                                                        </span>
                                                    ) : (
                                                        <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">
                                                            Basic (0 Pts)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => openRoyaltyFormPage(b)}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded text-[11px] cursor-pointer">
                                                        {mappedRule ? 'Edit Royalty' : 'Set Royalty'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* MAPPED ROYALTY RULES TABLE */}
                <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-book-bookmark text-emerald-600"></i> Configured Per-Book Royalty Rules ({rules.length})
                    </h4>
                    {rules.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded border border-dashed text-slate-400 space-y-2">
                            <p className="font-semibold">No royalty rules configured for this vendor yet.</p>
                            <button onClick={() => openRoyaltyFormPage()} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                                + Click here to map a book and set royalty parameters
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                                        <th className="p-3">Book Title</th>
                                        <th className="p-3">Book Type</th>
                                        <th className="p-3">Threshold (Pages/Pt)</th>
                                        <th className="p-3">Book Points</th>
                                        <th className="p-3">Pool Share %</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map((r, i) => {
                                        const isRoy = r.isRoyaltyApplicable ?? r.IsRoyaltyApplicable ?? true;
                                        const thresh = r.royaltyPageThreshold ?? r.RoyaltyPageThreshold ?? 0;
                                        const matchedBk = vendorBooks.find(b => String(b.id) === String(r.bookId || r.BookId));
                                        const pages = matchedBk ? (matchedBk.noOfPages || 0) : 0;
                                        const pts = (isRoy && thresh > 0 && pages > 0) ? (pages / thresh).toFixed(2) : '0.00';

                                        return (
                                            <tr key={r.id || r.Id || i} className="border-b hover:bg-slate-50">
                                                <td className="p-3 font-bold text-indigo-900">
                                                    {r.bookName || r.BookName || 'Mapped Book'}
                                                </td>
                                                <td className="p-3">
                                                    {isRoy ? (
                                                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px]">Royalty Book</span>
                                                    ) : (
                                                        <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px]">Basic (No Royalty)</span>
                                                    )}
                                                </td>
                                                <td className="p-3 font-semibold">{thresh} Pages</td>
                                                <td className="p-3 font-extrabold text-blue-700">{pts} Pts</td>
                                                <td className="p-3 font-bold text-emerald-700">
                                                    {r.royaltyPercentage ?? r.RoyaltyPercentage ?? 30}%
                                                </td>
                                                <td className="p-3">
                                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                        {r.liveStatus || r.LiveStatus || 'Live'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <button
                                                        onClick={() => handleDeleteRoyaltyRule(r.id || r.Id)}
                                                        className="text-red-600 font-bold hover:underline cursor-pointer">
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* RECENT 30% POOL ROYALTY TRANSACTIONS LEDGER */}
                <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-coins text-amber-500"></i> 30% Pool Royalty Credit Ledger ({earningsData.transactions.length})
                    </h4>
                    {earningsData.transactions.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded border border-dashed text-slate-400">
                            No sales transactions credited yet. Credits appear automatically when users buy Single Books, Bundles, or Plans.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-emerald-50 text-emerald-900 font-bold border-b">
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Order Type</th>
                                        <th className="p-3">Book Name</th>
                                        <th className="p-3">Order Amount</th>
                                        <th className="p-3">30% Pool</th>
                                        <th className="p-3">Points Share</th>
                                        <th className="p-3 text-right">Vendor Earned</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {earningsData.transactions.map((t, idx) => (
                                        <tr key={t.id || idx} className="border-b hover:bg-slate-50">
                                            <td className="p-3 text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                                            <td className="p-3">
                                                <span className="bg-indigo-50 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px] border border-indigo-200">
                                                    {t.purchaseType}
                                                </span>
                                            </td>
                                            <td className="p-3 font-bold text-slate-800">{t.bookName}</td>
                                            <td className="p-3">₹{Number(t.totalOrderAmount).toFixed(2)}</td>
                                            <td className="p-3 text-slate-600">₹{Number(t.royaltyPoolAmount).toFixed(2)}</td>
                                            <td className="p-3 font-mono text-blue-700">{t.bookPoints} / {t.totalOrderPoints} Pts</td>
                                            <td className="p-3 text-right font-black text-emerald-700">+₹{Number(t.earnedRoyaltyAmount).toFixed(2)}</td>
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

    // -------------------------------------------------------------
    // PAGE VIEW 4: DIRECTORY MASTER LIST PAGE (DEFAULT)
    // -------------------------------------------------------------
    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow border border-slate-200 gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                        <i className="fa-solid fa-users-gear text-indigo-600"></i> Vendor & Royalty Directory Master Page
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Click on any vendor row to open full profile, configure per-book royalty rules, and view 30% pool earnings.</p>
                </div>
                <button
                    onClick={() => openVendorFormPage()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded text-xs shadow flex items-center gap-2 cursor-pointer">
                    <i className="fa-solid fa-user-plus"></i> Create Vendor Profile Page
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 bg-white rounded-lg border text-slate-400 font-bold">Loading Vendors Directory...</div>
            ) : vendors.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed text-slate-500 space-y-3">
                    <i className="fa-solid fa-address-book text-3xl text-slate-300"></i>
                    <p className="font-semibold">No vendor profiles registered yet.</p>
                    <button onClick={() => openVendorFormPage()} className="text-indigo-600 font-bold text-xs hover:underline">
                        + Click here to add your first vendor profile page
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow border overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                                <th className="p-3">Vendor Code</th>
                                <th className="p-3">Vendor Name</th>
                                <th className="p-3">Phone</th>
                                <th className="p-3">Email</th>
                                <th className="p-3">Mapped Rules</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vendors.map(v => {
                                const vId = v.id || v.Id;
                                const vName = v.name || v.Name || v.vendorName || v.VendorName || 'N/A';
                                const vCode = v.vendorCode || v.VendorCode;
                                const rulesCount = (v.royaltyRules || v.RoyaltyRules || []).length;

                                return (
                                    <tr key={vId} className="border-b hover:bg-indigo-50/50 transition">
                                        <td className="p-3 font-bold text-indigo-700">
                                            <button onClick={() => handleOpenVendorProfile(v)} className="hover:underline cursor-pointer">
                                                {vCode}
                                            </button>
                                        </td>
                                        <td className="p-3 font-bold text-slate-800">{vName}</td>
                                        <td className="p-3 text-slate-600">{v.phone || v.Phone || 'N/A'}</td>
                                        <td className="p-3 text-slate-600">{v.email || v.Email || 'N/A'}</td>
                                        <td className="p-3">
                                            <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] border">
                                                {rulesCount} Book Rules Mapped
                                            </span>
                                        </td>
                                        <td className="p-3 text-right space-x-3">
                                            <button onClick={() => handleOpenVendorProfile(v)} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                                                View Profile
                                            </button>
                                            <button onClick={() => handleDeleteVendor(vId, vName)} className="text-red-600 font-bold hover:underline cursor-pointer">
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

window.VendorMaster = VendorMaster;