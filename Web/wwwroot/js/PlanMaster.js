// wwwroot/js/PlanMaster.js

function PlanMaster({ booksList = [], triggerToast }) {
    const [plansList, setPlansList] = React.useState([]);
    const [availableBooks, setAvailableBooks] = React.useState([]);
    const [royaltyRulesMap, setRoyaltyRulesMap] = React.useState({});
    const [loading, setLoading] = React.useState(false);

    // Page Mode State: 'list' (Grid View) OR 'form' (Add/Edit Master Page)
    const [viewMode, setViewMode] = React.useState('list');
    const [editingPlan, setEditingPlan] = React.useState(null);

    // Form Field States
    const [planNameInput, setPlanNameInput] = React.useState('Basic Plan');
    const [description, setDescription] = React.useState('');
    const [priceIncludingTax, setPriceIncludingTax] = React.useState(199);
    const [taxPercentage, setTaxPercentage] = React.useState(18.0);
    const [billingPeriodInput, setBillingPeriodInput] = React.useState('Monthly');
    const [validityInDays, setValidityInDays] = React.useState(30);

    const [targetUser, setTargetUser] = React.useState('Reader');
    const [basicBookLimit, setBasicBookLimit] = React.useState(5);
    const [royaltyBookLimit, setRoyaltyBookLimit] = React.useState(1);
    const [selectedPlanBookIds, setSelectedPlanBookIds] = React.useState([]);
    const [bookSearchQuery, setBookSearchQuery] = React.useState('');
    const [isActive, setIsActive] = React.useState(true);

    // Dynamic Features List State
    const [features, setFeatures] = React.useState([
        { featureName: 'Standard E-Book Reading Mode', limitation: 'Available on Web & Mobile', isEnabled: true },
        { featureName: 'Offline Book Downloads', limitation: 'Up to 2 Devices', isEnabled: true }
    ]);

    const featureDropdownOptions = [
        "Standard E-Book Reading Mode",
        "HD Reader & Audio Book Support",
        "Offline Book Downloads",
        "Ad-Free Reading Experience",
        "Royalty Book Allowance",
        "Author Analytics & Dashboard",
        "Priority Customer Support",
        "Multi-Device Sync"
    ];

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/plan/get-all');
            if (res.ok) {
                const data = await res.json();
                setPlansList(data);
            }
        } catch (e) {
            console.error("Fetch plans error:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchBooksAndRoyaltyRules = async () => {
        try {
            if (booksList && booksList.length > 0) {
                setAvailableBooks(booksList);
            } else {
                const resBooks = await fetch('/api/author/book/my-books');
                if (resBooks.ok) {
                    const bData = await resBooks.json();
                    setAvailableBooks(Array.isArray(bData) ? bData : []);
                }
            }

            const resVendors = await fetch('/api/vendor/get-all');
            if (resVendors.ok) {
                const vData = await resVendors.json();
                const rulesObj = {};
                (vData || []).forEach(v => {
                    const vName = v.name || v.Name || v.vendorName || v.VendorName || 'Vendor';
                    const rules = v.royaltyRules || v.RoyaltyRules || [];
                    rules.forEach(r => {
                        const bId = String(r.bookId || r.BookId).toLowerCase();
                        const status = r.liveStatus || r.LiveStatus || 'Live';
                        if (status === 'Live') {
                            rulesObj[bId] = {
                                vendorName: vName,
                                isRoyalty: r.isRoyaltyApplicable ?? r.IsRoyaltyApplicable ?? false,
                                percentage: r.royaltyPercentage ?? r.RoyaltyPercentage ?? 30,
                                threshold: r.royaltyPageThreshold ?? r.RoyaltyPageThreshold ?? 100
                            };
                        }
                    });
                });
                setRoyaltyRulesMap(rulesObj);
            }
        } catch (e) {
            console.error("Fetch books/royalty rules error:", e);
        }
    };

    React.useEffect(() => {
        if (booksList && booksList.length > 0) {
            setAvailableBooks(booksList);
        }
    }, [booksList]);

    const togglePlanBookSelection = (bookId) => {
        const strId = String(bookId);
        setSelectedPlanBookIds(prev =>
            prev.includes(strId) ? prev.filter(id => id !== strId) : [...prev, strId]
        );
    };

    const resetAndOpenForm = (plan = null) => {
        setBookSearchQuery('');
        if (plan) {
            setEditingPlan(plan);
            setPlanNameInput(plan.planName || plan.PlanName || '');
            setDescription(plan.description || plan.Description || '');
            setPriceIncludingTax(plan.priceIncludingTax || plan.PriceIncludingTax || 0);
            setTaxPercentage(plan.taxPercentage || plan.TaxPercentage || 18.0);
            setBillingPeriodInput(plan.billingPeriod || plan.BillingPeriod || 'Monthly');
            setValidityInDays(plan.validityInDays || plan.ValidityInDays || 30);
            setTargetUser(plan.targetUser || plan.TargetUser || 'Reader');
            setBasicBookLimit(plan.basicBookLimit ?? plan.BasicBookLimit ?? 5);
            setRoyaltyBookLimit(plan.royaltyBookLimit ?? plan.RoyaltyBookLimit ?? 1);
            setIsActive(plan.isActive ?? plan.IsActive ?? true);

            const rawBookIds = plan.bookIds || plan.BookIds ||
                (plan.planBooks || plan.PlanBooks || []).map(pb => pb.bookId || pb.BookId || pb.id) || [];
            setSelectedPlanBookIds(rawBookIds.map(id => String(id)));

            const fetchedFeatures = plan.features || plan.Features || [];
            if (fetchedFeatures.length > 0) {
                setFeatures(fetchedFeatures.map(f => ({
                    featureName: f.featureName || f.FeatureName,
                    limitation: f.limitation || f.Limitation || 'Included',
                    isEnabled: f.isEnabled ?? f.IsEnabled ?? true
                })));
            } else {
                setFeatures([]);
            }
        } else {
            setEditingPlan(null);
            setPlanNameInput('Basic Plan');
            setDescription('');
            setPriceIncludingTax(199);
            setTaxPercentage(18.0);
            setBillingPeriodInput('Monthly');
            setValidityInDays(30);
            setTargetUser('Reader');
            setBasicBookLimit(5);
            setRoyaltyBookLimit(1);
            setSelectedPlanBookIds([]);
            setIsActive(true);
            setFeatures([
                { featureName: 'Standard E-Book Reading Mode', limitation: 'Available on Web & Mobile', isEnabled: true },
                { featureName: 'Offline Book Downloads', limitation: 'Up to 2 Devices', isEnabled: true }
            ]);
        }
        setViewMode('form');
    };

    React.useEffect(() => {
        fetchPlans();
        fetchBooksAndRoyaltyRules();

        const handleGlobalOpenForm = () => {
            resetAndOpenForm(null);
        };

        window.addEventListener('open-plan-create-page', handleGlobalOpenForm);

        const attachOuterBtnClick = () => {
            const buttons = document.querySelectorAll('button');
            buttons.forEach(btn => {
                if (btn.innerText.includes('Add New Plan') || btn.innerText.includes('Create New Plan')) {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        resetAndOpenForm(null);
                    };
                }
            });
        };

        const timer = setTimeout(attachOuterBtnClick, 300);

        return () => {
            window.removeEventListener('open-plan-create-page', handleGlobalOpenForm);
            clearTimeout(timer);
        };
    }, []);

    const handleAddFeatureRow = () => {
        setFeatures([...features, { featureName: featureDropdownOptions[0], limitation: 'Included', isEnabled: true }]);
    };

    const handleFeatureChange = (index, field, value) => {
        const updated = [...features];
        updated[index][field] = value;
        setFeatures(updated);
    };

    const handleRemoveFeatureRow = (index) => {
        setFeatures(features.filter((_, i) => i !== index));
    };

    const handleSavePlan = async (e) => {
        e.preventDefault();

        if (!planNameInput || !planNameInput.trim()) {
            alert("Please type a valid Plan Name.");
            return;
        }

        let calculatedValidityDays = parseInt(validityInDays, 10) || 30;
        const periodLower = billingPeriodInput.trim().toLowerCase();
        if (periodLower.includes('month')) calculatedValidityDays = 30;
        else if (periodLower === '1 year' || periodLower === 'yearly' || periodLower === 'annual') calculatedValidityDays = 365;
        else if (periodLower.includes('2 year')) calculatedValidityDays = 730;
        else if (periodLower.includes('3 year')) calculatedValidityDays = 1095;
        else if (periodLower.includes('5 year')) calculatedValidityDays = 1825;

        const payload = {
            id: editingPlan ? (editingPlan.id || editingPlan.Id) : null,
            planName: planNameInput.trim(),
            description: description ? description.trim() : "",
            priceIncludingTax: parseFloat(priceIncludingTax) || 0,
            taxPercentage: parseFloat(taxPercentage) || 0,
            billingPeriod: billingPeriodInput.trim(),
            validityInDays: calculatedValidityDays,
            targetUser: targetUser,
            basicBookLimit: parseInt(basicBookLimit, 10) || 0,
            royaltyBookLimit: parseInt(royaltyBookLimit, 10) || 0,
            bookIds: selectedPlanBookIds,
            isActive: isActive,
            features: features.map(f => ({
                featureName: f.featureName,
                limitation: f.limitation || "Included",
                isEnabled: f.isEnabled
            }))
        };

        try {
            const res = await fetch('/api/plan/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && (data.success !== false)) {
                if (triggerToast) triggerToast(data.message || "Subscription Plan Saved Successfully!");
                setViewMode('list');
                fetchPlans();
            } else {
                alert(data.message || "Failed to save plan.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        }
    };

    const handleDeletePlan = async (planId, planName) => {
        if (confirm(`Are you sure you want to delete "${planName}"?`)) {
            try {
                const res = await fetch(`/api/plan/delete/${planId}`, { method: 'DELETE' });
                if (res.ok) {
                    if (triggerToast) triggerToast("Plan Deleted!");
                    fetchPlans();
                }
            } catch (err) {
                alert("Delete error: " + err.message);
            }
        }
    };

    // FULL PAGE FORM VIEW MODE
    if (viewMode === 'form') {
        const planPriceNum = parseFloat(priceIncludingTax) || 0;
        const pool30 = planPriceNum * 0.30;

        let selectedBasicCount = 0;
        const selectedRoyaltyDetails = [];

        selectedPlanBookIds.forEach(id => {
            const item = availableBooks.find(x => String((x.raw || x).id || (x.raw || x).Id) === String(id));
            if (!item) return;
            const b = item.raw || item;
            const rule = royaltyRulesMap[String(id).toLowerCase()];
            if (rule && rule.isRoyalty && rule.threshold > 0) {
                const pages = b.noOfPages || b.NoOfPages || 0;
                selectedRoyaltyDetails.push({
                    bookName: b.itemName || b.ItemName,
                    vendorName: rule.vendorName,
                    percentage: rule.percentage,
                    points: pages / rule.threshold
                });
            } else {
                selectedBasicCount++;
            }
        });

        const totalPoolPoints = selectedRoyaltyDetails.reduce((s, x) => s + x.points, 0);

        const filteredBooks = availableBooks.filter(item => {
            const b = item.raw || item;
            if (!bookSearchQuery.trim()) return true;
            const q = bookSearchQuery.toLowerCase();
            const title = (b.itemName || b.ItemName || '').toLowerCase();
            const author = (b.authorName || b.AuthorName || '').toLowerCase();
            const vendor = (b.vendorName || b.VendorName || '').toLowerCase();
            return title.includes(q) || author.includes(q) || vendor.includes(q);
        });

        return (
            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-6">

                {/* PAGE HEADER WITH BACK BUTTON */}
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm"
                            title="Back to Subscription List">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                <i className="fa-solid fa-crown text-amber-500"></i>
                                {editingPlan ? 'Edit Subscription Plan Page' : 'Configure New Subscription Plan Page'}
                            </h3>
                            <p className="text-xs text-slate-500">Configure plan pricing, limits, and select exact books included in this plan.</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded text-xs cursor-pointer">
                        Cancel Page
                    </button>
                </div>

                {/* MASTER PAGE FORM BODY */}
                <form onSubmit={handleSavePlan} className="space-y-6 text-xs">

                    {/* SECTION 1: PLAN NAME, BILLING CYCLE & PRICE */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-pen text-indigo-600"></i> 1. Manual Plan Name, Billing Cycle & Pricing Configuration
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Plan Tier / Name (Manual Type) *</label>
                                <input
                                    type="text"
                                    required
                                    list="plan-name-suggestions"
                                    value={planNameInput}
                                    onChange={e => setPlanNameInput(e.target.value)}
                                    placeholder="e.g. Basic Plan, Advance, Gold, VIP"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-indigo-900 bg-white outline-none focus:border-indigo-600"
                                />
                                <datalist id="plan-name-suggestions">
                                    <option value="Basic Plan" />
                                    <option value="Advance Plan" />
                                    <option value="Premium Plan" />
                                    <option value="Gold Pass" />
                                    <option value="Enterprise VIP" />
                                </datalist>
                            </div>

                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Billing Cycle (Manual Type) *</label>
                                <input
                                    type="text"
                                    required
                                    list="billing-period-suggestions"
                                    value={billingPeriodInput}
                                    onChange={e => setBillingPeriodInput(e.target.value)}
                                    placeholder="e.g. Monthly, Yearly, 2 Years, 5 Years"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-900 bg-white outline-none focus:border-indigo-600"
                                />
                                <datalist id="billing-period-suggestions">
                                    <option value="Monthly" />
                                    <option value="Yearly" />
                                    <option value="2 Years" />
                                    <option value="3 Years" />
                                    <option value="5 Years" />
                                    <option value="Custom Days" />
                                </datalist>
                            </div>

                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Validity in Days *</label>
                                <input
                                    type="number"
                                    required
                                    value={validityInDays}
                                    onChange={e => setValidityInDays(e.target.value)}
                                    placeholder="30"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold text-slate-800 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>

                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Price Incl. Tax (₹) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={priceIncludingTax}
                                    onChange={e => setPriceIncludingTax(e.target.value)}
                                    placeholder="1999"
                                    className="w-full border border-gray-300 rounded px-3 py-2.5 font-extrabold text-emerald-700 text-sm bg-white outline-none focus:border-emerald-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: BOOK LIMITS */}
                    <div className="bg-amber-50/60 p-5 rounded-lg border border-amber-200 space-y-4">
                        <h4 className="font-bold text-amber-900 text-sm border-b border-amber-200 pb-2 flex items-center gap-2">
                            <i className="fa-solid fa-book text-amber-600"></i> 2. Book Access & Royalty Limits
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Basic Books Allowance (-1 for Unlimited)</label>
                                <input
                                    type="number"
                                    value={basicBookLimit}
                                    onChange={e => setBasicBookLimit(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 font-bold bg-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Royalty Books Allowance (-1 for Unlimited)</label>
                                <input
                                    type="number"
                                    value={royaltyBookLimit}
                                    onChange={e => setRoyaltyBookLimit(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 font-bold text-indigo-700 bg-white outline-none focus:border-amber-500"
                                />
                            </div>

                            <div>
                                <label className="font-bold block mb-1 text-slate-700">Total Max Combined Limit</label>
                                <input
                                    type="number"
                                    readOnly
                                    value={(parseInt(basicBookLimit, 10) || 0) + (parseInt(royaltyBookLimit, 10) || 0)}
                                    className="w-full border border-slate-300 rounded px-3 py-2 font-bold bg-slate-100 text-slate-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: SELECT BOOKS INCLUDED IN THIS PLAN WITH ROYALTY % BADGE */}
                    <div className="bg-blue-50/50 p-5 rounded-lg border border-blue-200 space-y-4">
                        <div className="flex flex-wrap justify-between items-center border-b border-blue-200 pb-2 gap-2">
                            <div>
                                <h4 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                                    <i className="fa-solid fa-layer-group text-blue-600"></i>
                                    3. Select Books Included in Plan ({selectedPlanBookIds.length} Selected)
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                    Selected: <strong className="text-emerald-700">{selectedRoyaltyDetails.length} Royalty Books</strong> (30% Pool Share) &bull; <strong className="text-slate-700">{selectedBasicCount} Basic Books</strong>
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <input
                                    type="text"
                                    value={bookSearchQuery}
                                    onChange={e => setBookSearchQuery(e.target.value)}
                                    placeholder="Search book or vendor..."
                                    className="border border-slate-300 rounded px-3 py-1.5 text-xs bg-white outline-none focus:border-blue-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlanBookIds(availableBooks.map(item => String((item.raw || item).id || (item.raw || item).Id)))}
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded text-[11px] cursor-pointer">
                                    Select All ({availableBooks.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlanBookIds([])}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded text-[11px] cursor-pointer">
                                    Clear
                                </button>
                            </div>
                        </div>

                        {filteredBooks.length === 0 ? (
                            <div className="text-center py-6 bg-white rounded border border-dashed text-slate-400">
                                No books available to select.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                                {filteredBooks.map(item => {
                                    const b = item.raw || item;
                                    const bId = String(b.id || b.Id);
                                    const isChecked = selectedPlanBookIds.includes(bId);
                                    const rule = royaltyRulesMap[bId.toLowerCase()];
                                    const pages = b.noOfPages || b.NoOfPages || 0;
                                    const pts = (rule && rule.isRoyalty && rule.threshold > 0)
                                        ? (pages / rule.threshold).toFixed(2)
                                        : '0.00';
                                    const vName = b.vendorName || b.VendorName || 'In-House';

                                    return (
                                        <label
                                            key={bId}
                                            className={`flex items-start justify-between p-3 rounded border cursor-pointer transition ${isChecked
                                                    ? 'bg-blue-100/70 border-blue-500 shadow-sm'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                                }`}>
                                            <div className="flex items-start gap-2.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => togglePlanBookSelection(bId)}
                                                    className="mt-1 w-4 h-4 accent-blue-600 cursor-pointer"
                                                />
                                                <div>
                                                    <div className="font-bold text-slate-900 text-xs line-clamp-1">
                                                        {b.itemName || b.ItemName}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500">
                                                        {b.authorName || b.AuthorName} | {pages} Pages
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                                        {rule && rule.isRoyalty ? (
                                                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                                                Royalty: Yes ({rule.percentage}% | {pts} Pts &bull; {rule.vendorName})
                                                            </span>
                                                        ) : (
                                                            <span className="bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.5 rounded text-[9px]">
                                                                Royalty: No (Basic &bull; {vName})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="font-extrabold text-emerald-700 text-xs">
                                                ₹{b.price !== undefined ? b.price : b.Price}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {/* LIVE 30% ROYALTY POOL SPLIT PREVIEW */}
                        {selectedPlanBookIds.length > 0 && (
                            <div className="bg-white p-4 rounded-lg border border-blue-300 space-y-2 mt-2">
                                <div className="flex flex-wrap justify-between items-center">
                                    <span className="font-bold text-blue-900 text-xs">
                                        <i className="fa-solid fa-chart-pie text-blue-600 mr-1"></i>
                                        Live 30% Vendor Royalty Pool Split (On ₹{planPriceNum.toFixed(2)} Plan Price = ₹{pool30.toFixed(2)} Pool)
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-600">
                                        Total Pool Points: {totalPoolPoints.toFixed(2)} Pts
                                    </span>
                                </div>

                                {selectedRoyaltyDetails.length === 0 ? (
                                    <p className="text-[11px] text-slate-500">
                                        No <strong>Royalty: Yes</strong> books selected in this plan. 100% revenue (₹{planPriceNum.toFixed(2)}) goes to Publisher.
                                    </p>
                                ) : (
                                    <table className="w-full text-left text-[11px] border">
                                        <thead>
                                            <tr className="bg-blue-50 text-blue-900 font-bold border-b">
                                                <th className="p-2">Vendor Name</th>
                                                <th className="p-2">Royalty Book</th>
                                                <th className="p-2">Rule % / Points</th>
                                                <th className="p-2">Pool Share %</th>
                                                <th className="p-2 text-right">Vendor Payout (₹)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRoyaltyDetails.map((rd, idx) => {
                                                const ratio = totalPoolPoints > 0 ? (rd.points / totalPoolPoints) : 0;
                                                const payout = pool30 * ratio;
                                                return (
                                                    <tr key={idx} className="border-b last:border-0">
                                                        <td className="p-2 font-bold text-indigo-900">{rd.vendorName}</td>
                                                        <td className="p-2">{rd.bookName}</td>
                                                        <td className="p-2">{rd.percentage}% ({rd.points.toFixed(2)} Pts)</td>
                                                        <td className="p-2 font-bold text-blue-700">{(ratio * 100).toFixed(1)}%</td>
                                                        <td className="p-2 text-right font-extrabold text-emerald-700">₹{payout.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    {/* SECTION 4: FEATURES & LIMITATIONS */}
                    <div className="bg-indigo-50/40 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <div className="flex justify-between items-center border-b border-indigo-200 pb-2">
                            <h4 className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                                <i className="fa-solid fa-list-check text-indigo-600"></i> 4. Features Dropdown & Limitation Rules
                            </h4>
                            <button
                                type="button"
                                onClick={handleAddFeatureRow}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-1.5">
                                <i className="fa-solid fa-plus"></i> Add Feature Line
                            </button>
                        </div>

                        {features.length === 0 ? (
                            <div className="text-center py-6 bg-white rounded border border-dashed text-slate-400 italic">
                                Click "+ Add Feature Line" to add plan benefits.
                            </div>
                        ) : (
                            features.map((feat, idx) => (
                                <div key={idx} className="bg-white p-4 rounded-lg border border-slate-300 grid grid-cols-1 md:grid-cols-12 gap-3 items-center shadow-sm">
                                    <div className="md:col-span-6">
                                        <label className="font-semibold block mb-1 text-slate-700">Select / Type Feature Name</label>
                                        <input
                                            type="text"
                                            list={`feature-options-${idx}`}
                                            value={feat.featureName}
                                            onChange={e => handleFeatureChange(idx, 'featureName', e.target.value)}
                                            placeholder="Select or enter feature name..."
                                            className="w-full border rounded px-3 py-2 font-bold text-slate-800 outline-none focus:border-indigo-500"
                                        />
                                        <datalist id={`feature-options-${idx}`}>
                                            {featureDropdownOptions.map((opt, i) => <option key={i} value={opt} />)}
                                        </datalist>
                                    </div>

                                    <div className="md:col-span-4">
                                        <label className="font-semibold block mb-1 text-slate-700">Limitation / Detail</label>
                                        <input
                                            type="text"
                                            value={feat.limitation}
                                            onChange={e => handleFeatureChange(idx, 'limitation', e.target.value)}
                                            placeholder="e.g. Available on Web & Mobile / Included"
                                            className="w-full border rounded px-3 py-2 text-slate-800 outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="md:col-span-2 flex items-center justify-between pt-5">
                                        <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={feat.isEnabled}
                                                onChange={e => handleFeatureChange(idx, 'isEnabled', e.target.checked)}
                                                className="w-4 h-4 accent-indigo-600"
                                            /> Enabled
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFeatureRow(idx)}
                                            className="text-red-500 hover:text-red-700 font-bold text-base p-1 cursor-pointer">
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* BOTTOM SAVE & CANCEL ACTION BAR */}
                    <div className="flex justify-between items-center pt-4 border-t">
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={e => setIsActive(e.target.checked)}
                                className="w-5 h-5 accent-emerald-600"
                            /> Active Plan
                        </label>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded text-xs cursor-pointer">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-2.5 rounded shadow text-xs cursor-pointer flex items-center gap-2">
                                <i className="fa-solid fa-check"></i> Save Subscription Plan
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }

    // GRID LIST VIEW MODE
    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow border border-slate-200 gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                        <i className="fa-solid fa-crown text-amber-500"></i> Subscription Plans Master Page
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Manage custom plans with manual text names, billing cycles, book limits & included books.</p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-10 bg-white rounded-lg border text-slate-400 font-bold">Loading Subscription Plans...</div>
            ) : plansList.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed text-slate-500 space-y-3">
                    <i className="fa-solid fa-box-open text-3xl text-slate-300"></i>
                    <p className="font-semibold">No subscription plans created yet.</p>
                    <button onClick={() => resetAndOpenForm()} className="text-indigo-600 font-bold text-xs hover:underline">
                        + Click here to create a new custom subscription plan
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plansList.map(plan => {
                        const pName = plan.planName || plan.PlanName;
                        const pFeatures = plan.features || plan.Features || [];
                        const mappedCount = (plan.bookIds || plan.BookIds || plan.planBooks || plan.PlanBooks || []).length;
                        const isPopular = pName.toLowerCase().includes('advance') || pName.toLowerCase().includes('gold') || pName.toLowerCase().includes('vip');

                        return (
                            <div key={plan.id || plan.Id} className={`bg-white rounded-xl shadow-md border overflow-hidden flex flex-col justify-between relative ${isPopular ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'}`}>
                                {isPopular && (
                                    <div className="bg-indigo-600 text-white text-[10px] font-extrabold uppercase px-3 py-1 absolute top-0 right-0 rounded-bl-lg">
                                        Popular Choice
                                    </div>
                                )}
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                {plan.targetUser || plan.TargetUser || 'Reader'} Tier
                                            </span>
                                            <h3 className="text-xl font-extrabold text-slate-900 mt-1">{pName}</h3>
                                        </div>
                                    </div>

                                    <div className="flex items-baseline gap-1 border-b pb-3">
                                        <span className="text-3xl font-black text-slate-900">₹{plan.priceIncludingTax || plan.PriceIncludingTax}</span>
                                        <span className="text-xs font-bold text-slate-500">/ {plan.billingPeriod || plan.BillingPeriod || 'Monthly'}</span>
                                    </div>

                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                                        <div className="flex justify-between font-bold text-slate-700">
                                            <span>Basic Books Access:</span>
                                            <span className="text-emerald-700">{(plan.basicBookLimit ?? plan.BasicBookLimit) === -1 ? 'Unlimited' : `${plan.basicBookLimit ?? plan.BasicBookLimit} Books`}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-slate-700">
                                            <span>Royalty Books Access:</span>
                                            <span className="text-indigo-700">{(plan.royaltyBookLimit ?? plan.RoyaltyBookLimit) === -1 ? 'Unlimited' : `${plan.royaltyBookLimit ?? plan.RoyaltyBookLimit} Books`}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-blue-700 border-t pt-1">
                                            <span>Mapped Specific Books:</span>
                                            <span>{mappedCount} Books Selected</span>
                                        </div>
                                        <div className="flex justify-between text-[11px] text-slate-500 font-semibold border-t pt-1">
                                            <span>Validity:</span>
                                            <span>{plan.validityInDays || plan.ValidityInDays} Days</span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-xs">
                                        <span className="font-bold text-slate-700 block">Included Features & Limits:</span>
                                        {pFeatures.length === 0 ? (
                                            <p className="text-slate-400 italic">No features specified.</p>
                                        ) : (
                                            pFeatures.map((f, i) => (
                                                <div key={i} className="flex items-start gap-2 text-slate-700">
                                                    <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                                                    <div>
                                                        <span className="font-semibold">{f.featureName || f.FeatureName}</span>
                                                        <span className="text-[10px] text-slate-400 block">{(f.limitation || f.Limitation) ? `Limit: ${f.limitation || f.Limitation}` : ''}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-xs">
                                    <button
                                        onClick={() => resetAndOpenForm(plan)}
                                        className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer">
                                        <i className="fa-solid fa-pen-to-square"></i> Edit Plan
                                    </button>
                                    <button
                                        onClick={() => handleDeletePlan(plan.id || plan.Id, pName)}
                                        className="text-red-600 font-bold hover:underline flex items-center gap-1 cursor-pointer">
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

window.PlanMaster = PlanMaster;