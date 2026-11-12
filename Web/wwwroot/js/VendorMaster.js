// wwwroot/js/VendorMaster.js

function VendorMaster({ triggerToast }) {
    const [vendors, setVendors] = React.useState([]);
    const [books, setBooks] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    // Page Modes: 'list' (Directory Table), 'vendorForm' (Add/Edit Vendor Page), 'profile' (Vendor Detail), 'royaltyForm' (Add Royalty Page)
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

    // Royalty Rule Form Fields State
    const [selectedBookId, setSelectedBookId] = React.useState('');
    const [isRoyaltyApplicable, setIsRoyaltyApplicable] = React.useState(true);
    const [thresholdPages, setThresholdPages] = React.useState(50);
    const [royaltyPercentage, setRoyaltyPercentage] = React.useState(10);
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

    const fetchBooks = async () => {
        try {
            const res = await fetch('/api/book/get-all');
            if (res.ok) {
                const data = await res.json();
                setBooks(data);
                if (data.length > 0) setSelectedBookId(data[0].id || data[0].Id);
            }
        } catch (e) {
            console.error("Fetch books error:", e);
        }
    };

    const openVendorFormPage = (vendor = null) => {
        if (vendor) {
            setEditingVendor(vendor);
            setVendorCode(vendor.vendorCode || vendor.VendorCode || '');
            setVendorName(vendor.vendorName || vendor.VendorName || '');
            setPhone(vendor.phone || vendor.Phone || '');
            setEmail(vendor.email || vendor.Email || '');
            setPostalCode(vendor.postalCode || vendor.PostalCode || '');
            setGstin(vendor.gstin || vendor.Gstin || '');
            setBankAccountNo(vendor.bankAccountNo || vendor.BankAccountNo || '');
            setIfscCode(vendor.ifscCode || vendor.IfscCode || '');
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

    const openRoyaltyFormPage = () => {
        if (books.length > 0 && !selectedBookId) {
            setSelectedBookId(books[0].id || books[0].Id);
        }
        setIsRoyaltyApplicable(true);
        setThresholdPages(50);
        setRoyaltyPercentage(10);
        setFlatAmount(0);
        setPublishingStartDate(new Date().toISOString().split('T')[0]);
        setLiveStatus('Live');
        setViewMode('royaltyForm');
    };

    React.useEffect(() => {
        fetchVendors();
        fetchBooks();

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
            name: vendorName.trim(),       // Backend DTO expects 'Name'
            phone: phone,
            email: email,
            postalCode: postalCode,
            gstin: gstin,
            bankAccountNo: bankAccountNo,
            ifsc: ifscCode,                // Backend DTO expects 'IFSC'
            address: address
        };

        try {
            const res = await fetch('/api/vendor/save-profile', { // Exact Controller Route
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Safe JSON Parsing
            const rawText = await res.text();
            let data = {};
            if (rawText && rawText.trim().length > 0) {
                try {
                    data = JSON.parse(rawText);
                } catch (err) {
                    console.warn("Non-JSON response:", rawText);
                }
            }

            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast(data.message || "Vendor Profile Saved Successfully!");
                fetchVendors();
                setViewMode(selectedVendor ? 'profile' : 'list');
            } else {
                // Validation errors handling if ModelState fails
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

        const payload = {
            vendorId: selectedVendor.id || selectedVendor.Id,
            bookId: selectedBookId,
            isRoyaltyApplicable,
            thresholdPages: parseInt(thresholdPages, 10) || 0,
            royaltyPercentage: parseFloat(royaltyPercentage) || 0,
            flatAmount: parseFloat(flatAmount) || 0,
            publishingStartDate,
            liveStatus
        };

        try {
            const res = await fetch('/api/vendor/save-royalty-rule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast("Book Royalty Rule Mapped Successfully!");
                fetchVendors();
                setViewMode('profile');
            } else {
                alert(data.message || "Failed to save royalty rule.");
            }
        } catch (err) {
            alert("Save royalty error: " + err.message);
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
    // PAGE VIEW 1: VENDOR PROFILE & BANK FORM PAGE (NOT POP-UP)
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
                    {/* SECTION 1: BASIC & CONTACT INFO */}
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

                    {/* SECTION 2: TAXATION & BANKING DETAILS */}
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
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-2.5 rounded shadow flex items-center gap-2">
                            <i className="fa-solid fa-check"></i> Save Vendor Profile
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // -------------------------------------------------------------
    // PAGE VIEW 2: ADD BOOK ROYALTY RULE PAGE (NOT POP-UP)
    // -------------------------------------------------------------
    if (viewMode === 'royaltyForm') {
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
                                Map Book & Configure Royalty Rule Page
                            </h3>
                            <p className="text-xs text-slate-500">Mapping rule for Vendor: <span className="font-bold text-indigo-900">{selectedVendor?.vendorName || selectedVendor?.VendorName}</span></p>
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
                    <div className="bg-indigo-50/50 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <h4 className="font-bold text-indigo-900 text-sm border-b border-indigo-200 pb-2">1. Select Target Book</h4>
                        <div>
                            <label className="font-bold block mb-1 text-slate-700">Select Book *</label>
                            <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold text-indigo-900 bg-white">
                                {books.map(b => (
                                    <option key={b.id || b.Id} value={b.id || b.Id}>
                                        {b.title || b.Title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2">2. Royalty Calculations & Threshold Parameters</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Is Royalty Applicable?</label>
                                <select value={isRoyaltyApplicable ? "Yes" : "No"} onChange={e => setIsRoyaltyApplicable(e.target.value === "Yes")} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="Yes">Yes</option>
                                    <option value="No">No</option>
                                </select>
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Threshold (Pages Minimum)</label>
                                <input type="number" value={thresholdPages} onChange={e => setThresholdPages(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Royalty Percentage (%) *</label>
                                <input type="number" step="0.1" value={royaltyPercentage} onChange={e => setRoyaltyPercentage(e.target.value)} className="w-full border rounded px-3 py-2.5 font-extrabold text-emerald-700 bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Flat Amount (₹)</label>
                                <input type="number" step="0.1" value={flatAmount} onChange={e => setFlatAmount(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Publishing Start Date</label>
                                <input type="date" value={publishingStartDate} onChange={e => setPublishingStartDate(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white" />
                            </div>
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Live Status</label>
                                <select value={liveStatus} onChange={e => setLiveStatus(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="Live">Live</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setViewMode('profile')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded">Cancel</button>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-2.5 rounded shadow flex items-center gap-2">
                            <i className="fa-solid fa-check"></i> Save Royalty Rule
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    // -------------------------------------------------------------
    // PAGE VIEW 3: DETAILED VENDOR PROFILE PAGE
    // -------------------------------------------------------------
    // -------------------------------------------------------------
    if (viewMode === 'profile' && selectedVendor) {
        const rules = selectedVendor.royaltyRules || selectedVendor.RoyaltyRules || [];
        const displayIfsc = selectedVendor.ifsc || selectedVendor.IFSC || selectedVendor.ifscCode || selectedVendor.IfscCode;

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
                                {selectedVendor.name || selectedVendor.Name || selectedVendor.vendorName || selectedVendor.VendorName || 'Vendor Profile'}
                                <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded font-bold border border-indigo-200">
                                    {selectedVendor.vendorCode || selectedVendor.VendorCode}
                                </span>
                            </h2>
                            <p className="text-slate-500 text-[11px]">Vendor Master Profile & Royalty Rules Overview</p>
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
                            <i className="fa-solid fa-plus"></i> Add Book Royalty Rule Page
                        </button>
                    </div>
                </div>

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

                <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <i className="fa-solid fa-book-bookmark text-emerald-600"></i> Mapped Book Royalty Rules ({rules.length})
                    </h4>
                    {rules.length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 rounded border border-dashed text-slate-400 space-y-2">
                            <i className="fa-solid fa-book text-3xl text-slate-300"></i>
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
                                        <th className="p-3">Threshold Pages</th>
                                        <th className="p-3">Royalty %</th>
                                        <th className="p-3">Flat Amount</th>
                                        <th className="p-3">Start Date</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rules.map((r, i) => {
                                        const startDateVal = r.publishingStartDate || r.PublishingStartDate;
                                        return (
                                            <tr key={r.id || r.Id || i} className="border-b hover:bg-slate-50">
                                                <td className="p-3 font-bold text-indigo-900">
                                                    {r.bookName || r.BookName || r.bookTitle || r.BookTitle || 'Mapped Book'}
                                                </td>
                                                <td className="p-3 font-semibold">
                                                    {r.royaltyPageThreshold ?? r.RoyaltyPageThreshold ?? r.thresholdPages ?? r.ThresholdPages ?? 0} Pages
                                                </td>
                                                <td className="p-3 font-bold text-emerald-700">
                                                    {r.royaltyPercentage ?? r.RoyaltyPercentage ?? 0}%
                                                </td>
                                                <td className="p-3 font-semibold">
                                                    ₹{r.royaltyFlatAmount ?? r.RoyaltyFlatAmount ?? r.flatAmount ?? r.FlatAmount ?? 0}
                                                </td>
                                                <td className="p-3 text-slate-500">
                                                    {startDateVal ? new Date(startDateVal).toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="p-3">
                                                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">
                                                        {r.liveStatus || r.LiveStatus || 'Live'}
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
                    <p className="text-xs text-slate-500 mt-0.5">Click on any vendor row to open full profile and manage book royalty rules.</p>
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
                                // 👇 YAHAN FIX KIYA GAYA HAI (v.name aur v.Name add kiya hai)
                                const vName = v.name || v.Name || v.vendorName || v.VendorName || 'N/A';
                                const vCode = v.vendorCode || v.VendorCode;
                                const rulesCount = (v.royaltyRules || v.RoyaltyRules || []).length;

                                return (
                                    <tr key={vId} className="border-b hover:bg-indigo-50/50 transition">
                                        <td className="p-3 font-bold text-indigo-700">
                                            <button onClick={() => { setSelectedVendor(v); setViewMode('profile'); }} className="hover:underline cursor-pointer">
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
                                            <button onClick={() => { setSelectedVendor(v); setViewMode('profile'); }} className="text-indigo-600 font-bold hover:underline cursor-pointer">
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