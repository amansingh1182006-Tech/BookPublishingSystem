function EditLanguageForm({ editingLanguage, onSuccess, onCancel }) {
    const [editLangName, setEditLangName] = React.useState(
        editingLanguage ? (editingLanguage.languageName || editingLanguage.LanguageName || editingLanguage.name || '') : ''
    );
    const [isUpdating, setIsUpdating] = React.useState(false);

    React.useEffect(() => {
        if (editingLanguage) {
            setEditLangName(editingLanguage.languageName || editingLanguage.LanguageName || editingLanguage.name || '');
        }
    }, [editingLanguage]);

    const handleSaveUpdateLanguage = async (e) => {
        e.preventDefault();
        if (!editLangName || !editLangName.trim()) {
            alert("Language Name zaroori hai!");
            return;
        }

        setIsUpdating(true);
        const langId = editingLanguage.id || editingLanguage.Id || editingLanguage.languageCode || editingLanguage.LanguageCode;

        try {
            const res = await fetch(`/api/language/update/${langId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    languageName: editLangName.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess("Language details update ho gayi hain!");
            } else {
                alert(data.message || "Language update karne me error aaya.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsUpdating(false);
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
                    <i className="fa-solid fa-pen-to-square text-blue-600"></i> Edit Language
                </h3>
            </div>

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
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-check"></i>
                        {isUpdating ? 'Updating Language...' : 'Update Language Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.EditLanguageForm = EditLanguageForm;