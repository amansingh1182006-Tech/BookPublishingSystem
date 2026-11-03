function AddLanguageForm({ onSuccess, onCancel }) {
    const [languageNameInput, setLanguageNameInput] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);

    const handleSaveLanguage = async (e) => {
        e.preventDefault();
        if (!languageNameInput.trim()) {
            alert("Language Name zaroori hai!");
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch('/api/language/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    languageName: languageNameInput.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess(`Language '${languageNameInput.trim()}' save ho gayi!`);
            } else {
                alert(data.message || "Language add karne me error aaya.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsSaving(false);
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
                    <i className="fa-solid fa-user-pen text-blue-600"></i> Add New Language
                </h3>
            </div>

            <form onSubmit={handleSaveLanguage} className="space-y-4 text-xs max-w-2xl">
                <div>
                    <label className="font-bold text-slate-700 block mb-1">Language Name *</label>
                    <input
                        type="text"
                        required
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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-plus"></i>
                        {isSaving ? 'Saving Language...' : 'Save Language Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.AddLanguageForm = AddLanguageForm;