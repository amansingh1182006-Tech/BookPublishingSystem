function UserPlansPage({ user, pendingBook, triggerToast, onCompleteAccess }) {
    const [plans, setPlans] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [purchasingId, setPurchasingId] = React.useState(null);

    // Step Switch: 'plans' (Step 1) -> 'profile' (Step 2 attached right after plan buy)
    const [step, setStep] = React.useState('plans');
    const [purchasedPlanName, setPurchasedPlanName] = React.useState('');
    const [isSavingProfile, setIsSavingProfile] = React.useState(false);

    const [profile, setProfile] = React.useState({
        custName: user?.fullName || '',
        mobileNo: '',
        address1: '',
        address2: '',
        country: 'India',
        state: '',
        postalCode: '',
        landmark: ''
    });

    React.useEffect(() => {
        fetch('/api/plan/get-all')
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                const activePlans = (data || []).filter(p => (p.isActive ?? p.IsActive) !== false);
                setPlans(activePlans);
            })
            .catch(err => console.error("Error loading plans:", err))
            .finally(() => setLoading(false));

        fetch('/Reader/profile-status')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.profile) {
                    setProfile(prev => ({
                        ...prev,
                        custName: data.profile.custName || user?.fullName || '',
                        mobileNo: data.profile.mobileNo || '',
                        address1: data.profile.address1 || '',
                        address2: data.profile.address2 || '',
                        country: data.profile.country || 'India',
                        state: data.profile.state || '',
                        postalCode: data.profile.postalCode || '',
                        landmark: data.profile.landmark || ''
                    }));
                }
            })
            .catch(() => { });
    }, [user]);

    const handleSubscribeNow = async (plan) => {
        const pId = plan.id || plan.Id;
        const pName = plan.planName || plan.PlanName;

        setPurchasingId(pId);
        try {
            const res = await fetch('/api/plan/subscribe-direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planId: pId,
                    userEmail: user?.email || ''
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setPurchasedPlanName(pName);
                if (triggerToast) triggerToast(data.message || `${pName} Activated!`);

                const statusRes = await fetch('/Reader/profile-status');
                const statusData = statusRes.ok ? await statusRes.json() : null;

                if (statusData && statusData.hasProfile) {
                    if (onCompleteAccess) onCompleteAccess(pendingBook);
                } else {
                    setStep('profile');
                }
            } else {
                alert(data.message || "Plan activation failed.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setPurchasingId(null);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setIsSavingProfile(true);
        try {
            const res = await fetch('/Reader/upsert-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });

            const data = await res.json();
            if (res.ok) {
                if (triggerToast) triggerToast("Profile saved! Opening your book...");
                if (onCompleteAccess) onCompleteAccess(pendingBook);
            } else {
                alert(data.message || "Failed to save profile.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsSavingProfile(false);
        }
    };

    if (step === 'profile') {
        return (
            <div className="w-full max-w-3xl mx-auto py-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#0d233a] to-[#163554] p-6 text-white">
                        <span className="bg-emerald-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">
                            Step 2 of 2 • Plan "{purchasedPlanName}" Active
                        </span>
                        <h2 className="text-xl font-black mt-2 flex items-center gap-2">
                            <i className="fa-solid fa-id-card text-amber-400"></i> Complete Your Reader Profile
                        </h2>
                        <p className="text-xs text-slate-300 mt-1">
                            Apni profile details save karein aur turant apni book padhna shuru karein.
                        </p>
                    </div>

                    <form onSubmit={handleSaveProfile} className="p-6 md:p-8 space-y-5 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                        <div className="pt-4 border-t flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingProfile}
                                className="bg-[#e31b23] hover:bg-red-700 text-white font-extrabold px-8 py-3 rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center gap-2">
                                <i className="fa-solid fa-book-open"></i>
                                {isSavingProfile ? 'Saving Profile...' : 'Save Profile & Open Book'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-6xl mx-auto py-4 space-y-6">
            <div className="bg-gradient-to-r from-[#0d233a] to-[#1b3b5c] text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <span className="bg-amber-400 text-slate-900 font-extrabold text-[10px] uppercase px-3 py-1 rounded-full">
                        Step 1 of 2 • Unlock Reading Access
                    </span>
                    <h2 className="text-2xl font-black mt-2 flex items-center gap-2">
                        <i className="fa-solid fa-crown text-amber-400"></i> Choose Your Subscription Plan
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                        {pendingBook
                            ? `"${pendingBook.itemName || pendingBook.ItemName}" padhne ke liye niche diye gaye plans me se koi ek plan select karein.`
                            : 'Select any plan created by Admin to unlock Basic & Royalty publications immediately.'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 bg-white rounded-lg border font-bold text-slate-500">
                    Loading Subscription Plans...
                </div>
            ) : plans.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border border-dashed text-slate-500">
                    No active plans available right now.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {plans.map(plan => {
                        const pId = plan.id || plan.Id;
                        const pName = plan.planName || plan.PlanName;
                        const pDesc = plan.description || plan.Description || '';
                        const pPrice = plan.priceIncludingTax || plan.PriceIncludingTax || 0;
                        const pPeriod = plan.billingPeriod || plan.BillingPeriod || 'Monthly';
                        const pDays = plan.validityInDays || plan.ValidityInDays || 30;
                        const basicLimit = plan.basicBookLimit ?? plan.BasicBookLimit ?? 0;
                        const royaltyLimit = plan.royaltyBookLimit ?? plan.RoyaltyBookLimit ?? 0;
                        const pFeatures = plan.features || plan.Features || [];

                        return (
                            <div key={pId} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden flex flex-col justify-between hover:shadow-xl transition">
                                <div className="p-6 space-y-4">
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded">
                                            {pDays} Days Validity • {pPeriod}
                                        </span>
                                        <h3 className="text-xl font-extrabold text-slate-900 mt-2">{pName}</h3>
                                        {pDesc && <p className="text-xs text-slate-500 mt-1">{pDesc}</p>}
                                    </div>

                                    <div className="flex items-baseline gap-1 border-b pb-4">
                                        <span className="text-3xl font-black text-slate-900">₹{pPrice}</span>
                                        <span className="text-xs font-bold text-slate-500">Incl. Tax</span>
                                    </div>

                                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                                        <div className="flex justify-between font-bold text-slate-700">
                                            <span>Basic Books Limit:</span>
                                            <span className="text-emerald-700">{basicLimit < 0 ? 'Unlimited' : `${basicLimit} Books`}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-slate-700">
                                            <span>Royalty Books Limit:</span>
                                            <span className="text-indigo-700">{royaltyLimit < 0 ? 'Unlimited' : `${royaltyLimit} Books`}</span>
                                        </div>
                                    </div>

                                    {pFeatures.length > 0 && (
                                        <div className="space-y-2 text-xs pt-1">
                                            {pFeatures.map((f, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-slate-700">
                                                    <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i>
                                                    <div>
                                                        <span className="font-semibold">{f.featureName || f.FeatureName}</span>
                                                        {(f.limitation || f.Limitation) && (
                                                            <span className="text-[10px] text-slate-400 block">{f.limitation || f.Limitation}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 bg-slate-50 border-t">
                                    <button
                                        type="button"
                                        disabled={purchasingId === pId}
                                        onClick={() => handleSubscribeNow(plan)}
                                        className="w-full bg-[#e31b23] hover:bg-red-700 disabled:opacity-50 text-white font-extrabold py-3 rounded-xl text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2">
                                        <i className="fa-solid fa-bolt"></i>
                                        {purchasingId === pId ? 'Activating Plan...' : `Subscribe Now • ₹${pPrice}`}
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

window.UserPlansPage = UserPlansPage;