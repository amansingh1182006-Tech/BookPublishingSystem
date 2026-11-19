

function EmbeddedReaderProfile({ user, triggerToast, onOpenBook }) {
    const [profile, setProfile] = useState({
        custId: '',
        custName: user?.fullName || '',
        mobileNo: '',
        emailId: user?.email || '',
        address1: '',
        address2: '',
        country: 'India',
        state: '',
        postalCode: '',
        landmark: ''
    });

    const [isEditMode, setIsEditMode] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [libraryBooks, setLibraryBooks] = useState([]);
    const [membershipPlans, setMembershipPlans] = useState([]);
    const [purchasedBundles, setPurchasedBundles] = useState([]);
    const [purchasedSingleBooks, setPurchasedSingleBooks] = useState([]);

    const loadAllData = async () => {
        try {
            const [profRes, libRes, planRes, purRes] = await Promise.all([
                fetch('/Reader/profile-status'),
                fetch('/Reader/api/my-library'),
                fetch('/api/plan/my-profile-membership'),
                fetch('/Reader/api/my-purchases')
            ]);

            if (profRes.ok) {
                const d = await profRes.json();
                if (d.profile) {
                    setProfile({
                        custId: d.profile.custId || 'CUST-READER',
                        custName: d.profile.custName || '',
                        mobileNo: d.profile.mobileNo || '',
                        emailId: d.profile.emailId || d.email || '',
                        address1: d.profile.address1 || '',
                        address2: d.profile.address2 || '',
                        country: d.profile.country || 'India',
                        state: d.profile.state || '',
                        postalCode: d.profile.postalCode || '',
                        landmark: d.profile.landmark || ''
                    });
                }
                if (!d.hasProfile) {
                    setIsEditMode(true);
                }
            }

            if (libRes.ok) {
                const l = await libRes.json();
                setLibraryBooks(Array.isArray(l) ? l : []);
            }

            if (planRes.ok) {
                const m = await planRes.json();
                setMembershipPlans(Array.isArray(m.plans) ? m.plans : []);
            }

            if (purRes.ok) {
                const p = await purRes.json();
                setPurchasedBundles(Array.isArray(p.bundles) ? p.bundles : []);
                setPurchasedSingleBooks(Array.isArray(p.singleBooks) ? p.singleBooks : []);
            }
        } catch (err) {
            console.error("Profile load error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, []);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await fetch('/Reader/upsert-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            const data = await res.json();
            if (res.ok) {
                triggerToast('Profile details successfully saved!');
                setIsEditMode(false);
            } else {
                triggerToast(data.message || 'Profile save failed.', 'error');
            }
        } catch (err) {
            triggerToast('Error: ' + err.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full py-20 flex flex-col items-center justify-center text-slate-600 font-bold text-xs gap-3">
                <i className="fa-solid fa-spinner fa-spin text-3xl text-[#be1e2d]"></i>
                <span>Loading Your Profile...</span>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* PROFILE BANNER & PERSONAL / ADDRESS DETAILS */}
            <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0d233a] to-[#163554] p-6 md:p-8 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-[#be1e2d] border-4 border-white/20 flex items-center justify-center font-black text-3xl text-white shadow-xl">
                            {profile.custName ? profile.custName[0].toUpperCase() : 'U'}
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-black">{profile.custName || 'Reader Account'}</h1>
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
                                    Reader Account
                                </span>
                            </div>
                            <p className="text-xs text-gray-300 flex items-center gap-2">
                                <i className="fa-solid fa-envelope text-red-400"></i> {profile.emailId}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono">
                                Customer ID: {profile.custId || 'Pending Setup'}
                            </p>
                        </div>
                    </div>

                    {!isEditMode ? (
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="bg-[#be1e2d] hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-2">
                            <i className="fa-solid fa-pen-to-square"></i> Edit Profile
                        </button>
                    ) : (
                        profile.mobileNo && profile.address1 && (
                            <button
                                onClick={() => setIsEditMode(false)}
                                className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-5 py-2.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-2">
                                <i className="fa-solid fa-eye"></i> View Profile
                            </button>
                        )
                    )}
                </div>

                <div className="p-6 md:p-8">
                    {!isEditMode ? (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2 border-b pb-2">
                                    <i className="fa-solid fa-user-gear text-[#be1e2d]"></i> Personal Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 font-bold block mb-1">Full Name</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{profile.custName || 'N/A'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 font-bold block mb-1">Mobile Number</span>
                                        <span className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                            <i className="fa-solid fa-phone text-emerald-600"></i> {profile.mobileNo || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 font-bold block mb-1">Email Address</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{profile.emailId || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2 border-b pb-2">
                                    <i className="fa-solid fa-location-dot text-[#be1e2d]"></i> Address Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 md:col-span-2">
                                        <span className="text-slate-400 font-bold block mb-1">Address Details</span>
                                        <span className="font-bold text-slate-800 block text-sm">{profile.address1 || 'N/A'}</span>
                                        {profile.address2 && <span className="text-slate-600 block mt-0.5">{profile.address2}</span>}
                                        {profile.landmark && (
                                            <span className="text-slate-500 text-[11px] block mt-1">
                                                <i className="fa-solid fa-map-pin me-1 text-red-500"></i>Landmark: {profile.landmark}
                                            </span>
                                        )}
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 font-bold block mb-1">State & Country</span>
                                        <span className="font-extrabold text-slate-800 text-sm">{profile.state || 'N/A'}, {profile.country || 'India'}</span>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        <span className="text-slate-400 font-bold block mb-1">Postal / Pincode</span>
                                        <span className="font-mono font-extrabold text-indigo-700 text-sm">{profile.postalCode || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSaveProfile} className="space-y-6 text-xs">
                            <div className="flex items-center justify-between border-b pb-3">
                                <h3 className="text-base font-extrabold text-[#0d233a] flex items-center gap-2">
                                    <i className="fa-solid fa-pen-to-square text-[#be1e2d]"></i>
                                    {profile.mobileNo && profile.address1 ? 'Edit Customer Profile' : 'Complete Your Profile Setup'}
                                </h3>
                                <span className="text-[11px] text-slate-400 font-semibold">* Required fields</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.custName}
                                        onChange={e => setProfile({ ...profile, custName: e.target.value })}
                                        placeholder="Enter Full Name"
                                        className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 font-bold outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Mobile Number *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.mobileNo}
                                        onChange={e => setProfile({ ...profile, mobileNo: e.target.value })}
                                        placeholder="Enter 10-digit Mobile No."
                                        className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 font-bold outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Address Line 1 *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.address1}
                                        onChange={e => setProfile({ ...profile, address1: e.target.value })}
                                        placeholder="House / Flat No., Building, Street"
                                        className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Address Line 2 (Optional)</label>
                                    <input
                                        type="text"
                                        value={profile.address2 || ''}
                                        onChange={e => setProfile({ ...profile, address2: e.target.value })}
                                        placeholder="Area, Locality, Sector"
                                        className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Country *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.country}
                                        onChange={e => setProfile({ ...profile, country: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold outline-none bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">State *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.state}
                                        onChange={e => setProfile({ ...profile, state: e.target.value })}
                                        placeholder="State"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Postal Code *</label>
                                    <input
                                        type="text"
                                        required
                                        value={profile.postalCode}
                                        onChange={e => setProfile({ ...profile, postalCode: e.target.value })}
                                        placeholder="Pincode"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Landmark (Optional)</label>
                                    <input
                                        type="text"
                                        value={profile.landmark || ''}
                                        onChange={e => setProfile({ ...profile, landmark: e.target.value })}
                                        placeholder="Nearby Landmark"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 border-t flex items-center justify-end gap-3">
                                {profile.mobileNo && profile.address1 && (
                                    <button
                                        type="button"
                                        onClick={() => setIsEditMode(false)}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded-lg text-xs cursor-pointer">
                                        Cancel
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-[#be1e2d] hover:bg-red-700 text-white font-bold px-8 py-2.5 rounded-lg text-xs shadow-md transition cursor-pointer flex items-center gap-2">
                                    <i className="fa-solid fa-floppy-disk"></i>
                                    {isSaving ? 'Saving Profile...' : 'Save Profile Details'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            {/* 1. MY ACTIVE SUBSCRIPTION PLANS & INCLUDED BOOKS */}
            {!isEditMode && (
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-3">
                        <div>
                            <h3 className="text-lg font-black text-[#0d233a] flex items-center gap-2.5">
                                <i className="fa-solid fa-crown text-amber-500"></i>
                                My Active Subscription Plans & Included Books ({membershipPlans.length})
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Plan validity timeline aur plan ke andar included sabhi books
                            </p>
                        </div>
                        <button
                            onClick={loadAllData}
                            title="Refresh All Data"
                            className="text-xs text-slate-500 hover:text-[#0d233a] px-3 py-1.5 rounded-lg border hover:bg-slate-50 transition cursor-pointer font-bold">
                            <i className="fa-solid fa-rotate-right me-1"></i> Refresh
                        </button>
                    </div>

                    {membershipPlans.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-xs font-bold text-slate-600">Abhi tak koi Subscription Plan active nahi hai.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {membershipPlans.map((planItem, pIdx) => {
                                const startStr = new Date(planItem.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                                const endStr = new Date(planItem.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                                return (
                                    <div key={pIdx} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/60 shadow-sm">
                                        <div className="bg-gradient-to-r from-[#0d233a] to-[#1b3b5c] text-white p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-base md:text-lg font-black text-amber-400">
                                                        <i className="fa-solid fa-gem me-1.5"></i>{planItem.planName}
                                                    </span>
                                                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${planItem.isActive
                                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                                            : 'bg-red-500/20 text-red-300 border border-red-400/40'
                                                        }`}>
                                                        {planItem.isActive ? `Active • ${planItem.remainingDays} Days Left` : 'Expired'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-300 font-mono">
                                                    Order ID: {planItem.transactionId || 'N/A'} • Paid: ₹{planItem.amountPaid} ({planItem.billingPeriod})
                                                </p>
                                            </div>

                                            <div className="bg-slate-900/60 border border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-4 text-xs shrink-0">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Active From</span>
                                                    <span className="font-extrabold text-emerald-400">{startStr}</span>
                                                </div>
                                                <i className="fa-solid fa-arrow-right text-slate-500"></i>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Valid Till</span>
                                                    <span className="font-extrabold text-amber-300">{endStr}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 md:p-5 space-y-3">
                                            <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide block">
                                                <i className="fa-solid fa-book-open text-[#be1e2d] me-1.5"></i>
                                                Books Included in "{planItem.planName}" ({planItem.books?.length || 0})
                                            </span>

                                            {(!planItem.books || planItem.books.length === 0) ? (
                                                <p className="text-xs text-slate-500 italic">Is plan ke liye books list abhi empty hai.</p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                    {planItem.books.map((bk, bIdx) => (
                                                        <div key={bIdx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:shadow-md transition">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <img
                                                                    src={bk.coverImage || '/images/default-cover.png'}
                                                                    alt={bk.itemName}
                                                                    className="w-11 h-14 object-cover rounded border bg-slate-100 shrink-0"
                                                                />
                                                                <div className="min-w-0">
                                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 inline-block mb-0.5">
                                                                        Plan: {planItem.planName}
                                                                    </span>
                                                                    <h4 className="font-bold text-xs text-slate-900 truncate" title={bk.itemName}>
                                                                        {bk.itemName}
                                                                    </h4>
                                                                    <p className="text-[10px] text-slate-500 truncate">
                                                                        {bk.authorName}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onOpenBook({ ...bk, id: bk.bookId || bk.id, initialPage: 1 })}
                                                                className="bg-[#0d233a] hover:bg-[#be1e2d] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 transition cursor-pointer">
                                                                Read
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* 2. MY PURCHASED BOOK BUNDLES (SEPARATE SECTION) */}
            {!isEditMode && purchasedBundles.length > 0 && (
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
                    <div className="border-b pb-4">
                        <h3 className="text-lg font-black text-[#0d233a] flex items-center gap-2.5">
                            <i className="fa-solid fa-layer-group text-indigo-600"></i>
                            My Purchased Book Bundles ({purchasedBundles.length})
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Kharide gaye bundles, unki validity dates, aur unke andar maujood sabhi books
                        </p>
                    </div>

                    <div className="space-y-5">
                        {purchasedBundles.map((bnd, idx) => {
                            const fromStr = new Date(bnd.validFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            const tillStr = new Date(bnd.validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                            return (
                                <div key={idx} className="border border-indigo-200 rounded-2xl overflow-hidden bg-indigo-50/30 shadow-sm">
                                    <div className="bg-indigo-950 text-white px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <i className="fa-solid fa-box-open text-amber-400"></i>
                                                <span className="font-black text-base text-amber-300">{bnd.bundleName}</span>
                                                <span className="text-[10px] bg-indigo-500/30 border border-indigo-400/40 px-2.5 py-0.5 rounded-full font-bold">
                                                    {bnd.books?.length || 0} Books Included
                                                </span>
                                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${!bnd.isExpired
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                                                        : 'bg-red-500/20 text-red-300 border border-red-400/40'
                                                    }`}>
                                                    {!bnd.isExpired ? `Active • ${bnd.remainingDays} Days Left` : 'Expired'}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-indigo-200 font-mono">
                                                Order ID: {bnd.transactionId || 'N/A'} • Paid: ₹{bnd.amountPaid}
                                            </p>
                                        </div>

                                        <div className="bg-slate-900/70 border border-indigo-400/30 rounded-xl px-4 py-2.5 flex items-center gap-4 text-xs shrink-0">
                                            <div>
                                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Active From</span>
                                                <span className="font-extrabold text-emerald-400">{fromStr}</span>
                                            </div>
                                            <i className="fa-solid fa-arrow-right text-slate-400"></i>
                                            <div>
                                                <span className="text-[10px] text-slate-400 block uppercase font-bold">Valid Till</span>
                                                <span className="font-extrabold text-amber-300">{tillStr}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {(bnd.books || []).map((bk, bIdx) => (
                                            <div key={bIdx} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3 hover:shadow-md transition">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={bk.coverImage || '/images/default-cover.png'}
                                                        alt={bk.itemName}
                                                        className="w-11 h-14 object-cover rounded border bg-slate-100 shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-block mb-0.5">
                                                            Bundle: {bnd.bundleName}
                                                        </span>
                                                        <h4 className="font-bold text-xs text-slate-900 truncate" title={bk.itemName}>
                                                            {bk.itemName}
                                                        </h4>
                                                        <p className="text-[10px] text-slate-500 truncate">{bk.authorName}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => onOpenBook({ ...bk, id: bk.bookId, initialPage: 1 })}
                                                    className="bg-indigo-700 hover:bg-[#be1e2d] text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shrink-0 transition cursor-pointer">
                                                    Read
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. MY PURCHASED SINGLE BOOKS (SEPARATE SECTION) */}
            {!isEditMode && purchasedSingleBooks.length > 0 && (
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6">
                    <div className="border-b pb-4">
                        <h3 className="text-lg font-black text-[#0d233a] flex items-center gap-2.5">
                            <i className="fa-solid fa-book text-emerald-600"></i>
                            My Purchased Single Books ({purchasedSingleBooks.length})
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Kharidi hui individual books aur unki reading validity timing
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {purchasedSingleBooks.map((sb, sIdx) => {
                            const fromStr = new Date(sb.validFrom).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                            const tillStr = new Date(sb.validTill).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                            return (
                                <div key={sIdx} className="border border-emerald-200 bg-emerald-50/30 rounded-2xl p-4 flex flex-col justify-between gap-3 hover:shadow-md transition">
                                    <div className="flex items-start gap-3.5">
                                        <img
                                            src={sb.coverImage || '/images/default-cover.png'}
                                            alt={sb.itemName}
                                            className="w-16 h-22 object-cover rounded-lg border bg-white shadow-sm shrink-0"
                                        />
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                                                    Single Book
                                                </span>
                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${!sb.isExpired
                                                        ? 'bg-[#0d233a] text-amber-300'
                                                        : 'bg-red-100 text-red-700'
                                                    }`}>
                                                    {!sb.isExpired ? `${sb.remainingDays} Days Left` : 'Expired'}
                                                </span>
                                            </div>

                                            <h4 className="font-black text-sm text-slate-900 truncate" title={sb.itemName}>
                                                {sb.itemName}
                                            </h4>
                                            <p className="text-[11px] text-slate-500">
                                                by {sb.authorName} • Paid: <strong className="text-slate-800">₹{sb.amountPaid}</strong>
                                            </p>
                                            <p className="text-[10px] text-slate-400 font-mono">
                                                Order ID: {sb.transactionId || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-emerald-200/70 flex flex-wrap items-center justify-between gap-2">
                                        <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-2">
                                            <span className="text-emerald-700">From: {fromStr}</span>
                                            <span className="text-slate-400">→</span>
                                            <span className="text-amber-700">Till: {tillStr}</span>
                                        </div>

                                        <button
                                            onClick={() => onOpenBook({ ...sb, id: sb.bookId, initialPage: 1 })}
                                            className="bg-emerald-600 hover:bg-[#be1e2d] text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow transition cursor-pointer">
                                            Read Book
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 4. MY LIBRARY & CONTINUE READING */}
            {!isEditMode && (
                <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b pb-4 gap-2">
                        <div>
                            <h3 className="text-lg font-black text-[#0d233a] flex items-center gap-2.5">
                                <i className="fa-solid fa-book-bookmark text-[#be1e2d]"></i>
                                My Library & Continue Reading ({libraryBooks.length})
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">Reading progress shelf</p>
                        </div>
                        <span className="text-xs bg-red-50 text-[#be1e2d] border border-red-200 px-3 py-1 rounded-full font-bold">
                            {libraryBooks.length} Books in Shelf
                        </span>
                    </div>

                    {libraryBooks.length === 0 ? (
                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-xs font-bold text-slate-600">Abhi tak koi book padhna shuru nahi kiya gaya hai.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {libraryBooks.map((item, idx) => {
                                const totalPg = item.totalPages || 1;
                                const lastPg = item.lastReadPage || 1;
                                const progressPct = Math.min(Math.round((lastPg / totalPg) * 100), 100);

                                return (
                                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between hover:shadow-md transition">
                                        <div className="flex gap-3">
                                            <img src={item.coverImage || '/images/default-cover.png'} alt={item.itemName} className="w-16 h-22 object-cover rounded border shrink-0" />
                                            <div className="flex-1 min-w-0 space-y-1">
                                                <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded inline-block">
                                                    {item.categoryCode || 'HOMEO'}
                                                </span>
                                                <h4 className="font-bold text-xs text-slate-900 truncate" title={item.itemName}>
                                                    {item.itemName}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 truncate">by {item.authorName}</p>
                                                <div className="text-[10px] text-slate-600 font-bold pt-1">
                                                    Page <span className="text-[#be1e2d]">{lastPg}</span> of {totalPg}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mt-4 pt-3 border-t border-slate-200">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                                <span>Progress</span>
                                                <span className="text-emerald-600 font-extrabold">{progressPct}%</span>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPct}%` }}></div>
                                            </div>
                                            <button
                                                onClick={() => onOpenBook({ ...item, id: item.bookId, initialPage: lastPg })}
                                                className="w-full bg-[#0d233a] hover:bg-[#be1e2d] text-white font-bold py-2 rounded-lg text-xs transition shadow flex items-center justify-center gap-2 cursor-pointer mt-2">
                                                <i className="fa-solid fa-circle-play text-amber-400"></i>
                                                <span>Resume Page {lastPg}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

window.EmbeddedReaderProfile = EmbeddedReaderProfile;