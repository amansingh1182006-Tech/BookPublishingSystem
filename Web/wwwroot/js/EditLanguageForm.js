function EditLanguageForm({ editingLanguage, onSuccess, onCancel }) {
    const [editLangName, setEditLangName] = React.useState(
        editingLanguage ? (editingLanguage.languageName || editingLanguage.LanguageName || editingLanguage.name || '') : ''
    );
    const [isUpdating, setIsUpdating] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState('');
    const submitLockRef = React.useRef(false);

    React.useEffect(() => {
        if (editingLanguage) {
            setEditLangName(editingLanguage.languageName || editingLanguage.LanguageName || editingLanguage.name || '');
        }
    }, [editingLanguage]);

    const safeParse = async (res) => {
        if (typeof window.safeJsonParse === 'function') return await window.safeJsonParse(res);
        try {
            const txt = await res.text();
            return txt && txt.trim() ? JSON.parse(txt) : {};
        } catch {
            return {};
        }
    };

    const handleSaveUpdateLanguage = async (e) => {
        e.preventDefault();
        if (submitLockRef.current) return;
        if (!editLangName || !editLangName.trim()) {
            setErrorMsg("Language Name zaroori hai!");
            return;
        }

        submitLockRef.current = true;
        setIsUpdating(true);
        setErrorMsg('');

        const rawId = editingLanguage.id || editingLanguage.Id || editingLanguage.languageCode || editingLanguage.LanguageCode;
        const langId = encodeURIComponent(String(rawId).trim());
        const payload = JSON.stringify({ languageName: editLangName.trim() });
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };

        try {
            let res = await fetch(`/api/language/update/${langId}`, { method: 'PUT', headers, body: payload });
            if (res.status === 405) {
                res = await fetch(`/api/language/update/${langId}`, { method: 'POST', headers, body: payload });
            }

            const data = await safeParse(res);
            if (res.ok && data.success !== false) {
                if (typeof window.invalidateApiCache === 'function') window.invalidateApiCache('/api/language');
                onSuccess("Language details update ho gayi hain!");
            } else {
                setErrorMsg(data.message || `Update Failed (${res.status}).`);
            }
        } catch (err) {
            setErrorMsg("Network error: " + err.message);
        } finally {
            setIsUpdating(false);
            submitLockRef.current = false;
        }
    };

    const langCode = editingLanguage ? (editingLanguage.languageCode || editingLanguage.LanguageCode || editingLanguage.code || editingLanguage.id || '') : '';

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
                    <i className="fa-solid fa-pen-to-square text-indigo-600"></i> Edit Language
                </h3>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleSaveUpdateLanguage} className="space-y-4 text-xs max-w-2xl">
                <div>
                    <label className="font-bold text-slate-700 block mb-1">Language Code (Read-Only)</label>
                    <input
                        type="text"
                        disabled
                        value={langCode}
                        className="w-full border rounded px-3 py-2.5 font-mono bg-gray-100 text-slate-500 font-bold outline-none"
                    />
                </div>

                <div>
                    <label className="font-bold text-slate-700 block mb-1">Language Name *</label>
                    <input
                        type="text"
                        required
                        value={editLangName}
                        onChange={e => setEditLangName(e.target.value)}
                        className="w-full border rounded px-3 py-2.5 font-bold outline-none focus:border-indigo-600"
                    />
                </div>

                <div className="flex justify-start gap-3 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2 rounded text-xs cursor-pointer">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isUpdating}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                        {isUpdating ? 'Updating Language...' : 'Update Language Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.EditLanguageForm = EditLanguageForm;