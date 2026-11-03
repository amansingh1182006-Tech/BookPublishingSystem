function AddPlanForm({ onSuccess, onCancel }) {
    const [planNameInput, setPlanNameInput] = React.useState('');
    const [planDescInput, setPlanDescInput] = React.useState('');
    const [planPriceInput, setPlanPriceInput] = React.useState('');
    const [planTaxInput, setPlanTaxInput] = React.useState('18');
    const [planValidityInput, setPlanValidityInput] = React.useState('30');
    const [planTargetInput, setPlanTargetInput] = React.useState('Reader');
    const [planMaxLimitInput, setPlanMaxLimitInput] = React.useState('-1');
    const [isSavingPlan, setIsSavingPlan] = React.useState(false);

    const handleAddPlanMaster = async (e) => {
        e.preventDefault();
        if (!planNameInput || !planPriceInput || !planValidityInput) {
            alert("Plan Name, Price & Validity Days are required.");
            return;
        }

        setIsSavingPlan(true);

        try {
            const res = await fetch('/api/plan/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planName: planNameInput.trim(),
                    description: planDescInput.trim(),
                    priceIncludingTax: parseFloat(planPriceInput),
                    taxPercentage: parseFloat(planTaxInput || '18'),
                    validityInDays: parseInt(planValidityInput),
                    targetUser: planTargetInput,
                    maxBookLimit: parseInt(planMaxLimitInput || '-1')
                })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess(data.message || `Plan '${planNameInput.trim()}' saved successfully!`);
            } else {
                alert(data.message || "Failed to add Plan.");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsSavingPlan(false);
        }
    };

    return (
        <div className="w-full bg-white p-6 rounded-lg shadow-lg border border-slate-200 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3">
                <button
                    type="button"
                    onClick={onCancel}
                    title="Back to Master List"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                    <i className="fa-solid fa-credit-card text-emerald-600"></i> Add New Subscription Plan
                </h3>
            </div>

            <form onSubmit={handleAddPlanMaster} className="space-y-4 text-xs max-w-2xl">
                <div>
                    <label className="font-bold block mb-1 text-slate-700">Plan Name *</label>
                    <input
                        type="text"
                        required
                        value={planNameInput}
                        onChange={e => setPlanNameInput(e.target.value)}
                        placeholder="e.g. Monthly Gold Reader"
                        className="w-full border rounded px-3 py-2.5 font-bold outline-none focus:border-emerald-600"
                    />
                </div>

                <div>
                    <label className="font-bold block mb-1 text-slate-700">Description</label>
                    <input
                        type="text"
                        value={planDescInput}
                        onChange={e => setPlanDescInput(e.target.value)}
                        placeholder="e.g. Full DRM eBook Access for 30 days"
                        className="w-full border rounded px-3 py-2.5 outline-none focus:border-emerald-600"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Price Incl. Tax (₹) *</label>
                        <input
                            type="number"
                            step="0.01"
                            required
                            value={planPriceInput}
                            onChange={e => setPlanPriceInput(e.target.value)}
                            placeholder="499.00"
                            className="w-full border rounded px-3 py-2.5 font-bold text-emerald-700 outline-none focus:border-emerald-600"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Tax Percentage (%)</label>
                        <input
                            type="number"
                            value={planTaxInput}
                            onChange={e => setPlanTaxInput(e.target.value)}
                            placeholder="18"
                            className="w-full border rounded px-3 py-2.5 outline-none focus:border-emerald-600"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Validity (Days) *</label>
                        <input
                            type="number"
                            required
                            value={planValidityInput}
                            onChange={e => setPlanValidityInput(e.target.value)}
                            placeholder="30"
                            className="w-full border rounded px-3 py-2.5 font-bold outline-none focus:border-emerald-600"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Target User</label>
                        <select
                            value={planTargetInput}
                            onChange={e => setPlanTargetInput(e.target.value)}
                            className="w-full border rounded px-3 py-2.5 font-bold bg-gray-50 outline-none focus:border-emerald-600">
                            <option value="Reader">Reader</option>
                            <option value="Author">Author</option>
                            <option value="Publisher">Publisher</option>
                        </select>
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Max Book Limit</label>
                        <input
                            type="number"
                            value={planMaxLimitInput}
                            onChange={e => setPlanMaxLimitInput(e.target.value)}
                            placeholder="-1 for Unlimited"
                            className="w-full border rounded px-3 py-2.5 outline-none focus:border-emerald-600"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded text-xs cursor-pointer">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSavingPlan}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-plus"></i>
                        {isSavingPlan ? 'Saving Plan...' : 'Save Plan Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.AddPlanForm = AddPlanForm;