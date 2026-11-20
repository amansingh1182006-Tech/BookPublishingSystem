function AddLanguageForm({ onSuccess, onCancel }) {
    const [languageNameInput, setLanguageNameInput] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState('');
    const submitLockRef = React.useRef(false);

    const safeParse = async (res) => {
        if (typeof window.safeJsonParse === 'function') return await window.safeJsonParse(res);
        try {
            const txt = await res.text();
            return txt && txt.trim() ? JSON.parse(txt) : {};
        } catch {
            return {};
        }
    };

    const handleSaveLanguage = async (e) => {
        e.preventDefault();
        if (submitLockRef.current) return;

        const trimmedLang = languageNameInput.trim();
        if (!trimmedLang) {
            setErrorMsg("Language Name zaroori hai!");
            return;
        }

        submitLockRef.current = true;
        setIsSaving(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/language/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ languageName: trimmedLang })
            });

            const data = await safeParse(res);
            if (res.ok && data.success !== false) {
                if (typeof window.invalidateApiCache === 'function') window.invalidateApiCache('/api/language');
                onSuccess(`Language '${trimmedLang}' save ho gayi!`);
            } else {
                setErrorMsg(data.message || `Server Error (${res.status}): Language save nahi ho saki.`);
            }
        } catch (err) {
            setErrorMsg("Network error: " + err.message);
        } finally {
            setIsSaving(false);
            submitLockRef.current = false;
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
                    <i className="fa-solid fa-language text-indigo-600"></i> Add New Language
                </h3>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleSaveLanguage} className="space-y-4 text-xs max-w-2xl">
                <div>
                    <label className="font-bold text-slate-700 block mb-1">Language Name *</label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={languageNameInput}
                        onChange={e => setLanguageNameInput(e.target.value)}
                        placeholder="e.g. French"
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
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold px-6 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className={`fa-solid ${isSaving ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
                        {isSaving ? 'Saving Language...' : 'Save Language Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.AddLanguageForm = AddLanguageForm;