function AddAuthorForm({ onSuccess, onCancel }) {
    const [authorNameInput, setAuthorNameInput] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
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

    const handleAddAuthor = async (e) => {
        e.preventDefault();
        if (submitLockRef.current) return;

        const trimmedName = authorNameInput.trim();
        if (!trimmedName) {
            setErrorMsg("Author Name zaroori hai!");
            return;
        }

        submitLockRef.current = true;
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const res = await fetch('/api/authors/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ authorName: trimmedName })
            });

            const data = await safeParse(res);
            if (res.ok && data.success !== false) {
                if (typeof window.invalidateApiCache === 'function') window.invalidateApiCache('/api/authors');
                setAuthorNameInput('');
                onSuccess(`Author '${trimmedName}' created successfully!`);
            } else {
                setErrorMsg(data.message || `Server Error (${res.status}): Author add nahi ho saka.`);
            }
        } catch (err) {
            setErrorMsg("Network error: " + err.message);
        } finally {
            setIsSubmitting(false);
            submitLockRef.current = false;
        }
    };

    return (
        <div className="w-full bg-white p-6 rounded-lg shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center gap-3 border-b pb-3">
                <button
                    type="button"
                    onClick={onCancel}
                    title="Back to Master List"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                    <i className="fa-solid fa-user-pen text-blue-600"></i> Add New Author
                </h3>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleAddAuthor} className="space-y-6 text-xs max-w-2xl">
                <div>
                    <label className="font-bold block mb-1 text-slate-700">Author Full Name *</label>
                    <input
                        type="text"
                        required
                        autoFocus
                        value={authorNameInput}
                        onChange={e => setAuthorNameInput(e.target.value)}
                        placeholder="e.g. Dr. William Boericke"
                        className="w-full border border-gray-300 rounded px-3 py-2.5 font-bold outline-none focus:border-blue-600"
                    />
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
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className={`fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-plus'}`}></i>
                        {isSubmitting ? 'Saving Author...' : 'Save Author Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.AddAuthorForm = AddAuthorForm;