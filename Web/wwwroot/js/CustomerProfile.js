const { useState, useEffect } = React;

function CustomerProfilePage({ initialProfile, onProfileSaved, onCancel }) {
    const [profile, setProfile] = useState(initialProfile || {
        custName: '',
        mobileNo: '',
        address1: '',
        address2: '',
        country: 'India',
        state: '',
        postalCode: '',
        landmark: ''
    });

    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (initialProfile) {
            setProfile(prev => ({ ...prev, ...initialProfile }));
        }
    }, [initialProfile]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!profile.custName.trim() || !profile.mobileNo.trim() || !profile.address1.trim() || !profile.state.trim() || !profile.postalCode.trim()) {
            setErrorMsg('Kripya sabhi mandatory (*) fields ko fill karein.');
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/reader/Reader/upsert-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });

            const data = await res.json();
            if (res.ok) {
                setSuccessMsg(data.message || "Profile successfully save ho gayi hai!");
                setTimeout(() => {
                    if (onProfileSaved) onProfileSaved();
                    else window.location.href = '/'; // Direct Home Page Redirection
                }, 1200);
            } else {
                setErrorMsg(data.message || 'Profile save karne me error aayi.');
            }
        } catch (err) {
            setErrorMsg('Network error: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl text-slate-100 my-6">
            <div className="border-b border-slate-800 pb-4 mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <i className="fa-solid fa-address-card text-red-500"></i> Reader Profile Setup
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Reader services aur access setup ke liye apni details yahan update karein.</p>
                </div>
                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-2 rounded-lg transition cursor-pointer">
                        <i className="fa-solid fa-house me-1"></i> Home Page
                    </button>
                )}
            </div>

            {errorMsg && (
                <div className="bg-red-950/80 border border-red-800 text-red-300 p-3 rounded-lg text-xs font-bold mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMsg}</span>
                </div>
            )}

            {successMsg && (
                <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-3 rounded-lg text-xs font-bold mb-4 flex items-center gap-2 animate-pulse">
                    <i className="fa-solid fa-circle-check"></i>
                    <span>{successMsg}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Full Name *</label>
                        <input
                            type="text"
                            required
                            value={profile.custName}
                            onChange={e => setProfile({ ...profile, custName: e.target.value })}
                            placeholder="e.g. Rahul Sharma"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 font-bold outline-none focus:border-red-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Mobile Number *</label>
                        <input
                            type="text"
                            required
                            value={profile.mobileNo}
                            onChange={e => setProfile({ ...profile, mobileNo: e.target.value })}
                            placeholder="10-digit Mobile No."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 font-bold outline-none focus:border-red-500 text-white"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Address Line 1 *</label>
                        <input
                            type="text"
                            required
                            value={profile.address1}
                            onChange={e => setProfile({ ...profile, address1: e.target.value })}
                            placeholder="House / Flat No., Street, Building"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 outline-none focus:border-red-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Address Line 2 (Optional)</label>
                        <input
                            type="text"
                            value={profile.address2 || ''}
                            onChange={e => setProfile({ ...profile, address2: e.target.value })}
                            placeholder="Area, Locality, Sector"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 outline-none focus:border-red-500 text-white"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Country *</label>
                        <input
                            type="text"
                            required
                            value={profile.country}
                            onChange={e => setProfile({ ...profile, country: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-bold outline-none text-slate-400"
                        />
                    </div>
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">State *</label>
                        <input
                            type="text"
                            required
                            value={profile.state}
                            onChange={e => setProfile({ ...profile, state: e.target.value })}
                            placeholder="State Name"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-red-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Postal Code *</label>
                        <input
                            type="text"
                            required
                            value={profile.postalCode}
                            onChange={e => setProfile({ ...profile, postalCode: e.target.value })}
                            placeholder="Pincode"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono outline-none focus:border-red-500 text-white"
                        />
                    </div>
                    <div>
                        <label className="font-bold text-slate-300 block mb-1">Landmark (Optional)</label>
                        <input
                            type="text"
                            value={profile.landmark || ''}
                            onChange={e => setProfile({ ...profile, landmark: e.target.value })}
                            placeholder="Nearby Landmark"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-red-500 text-white"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-lg shadow-lg transition cursor-pointer flex items-center gap-2 text-xs">
                        <i className="fa-solid fa-floppy-disk"></i>
                        {isSaving ? 'Saving Profile...' : 'Save Profile & Go To Home Page'}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.CustomerProfilePage = CustomerProfilePage;