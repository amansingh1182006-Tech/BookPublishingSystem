function EditAuthorForm({ editingAuthor, onSuccess, onCancel }) {
    const [editAuthorName, setEditAuthorName] = React.useState(
        editingAuthor ? (editingAuthor.authorName || editingAuthor.AuthorName || editingAuthor.name || '') : ''
    );
    const [isUpdating, setIsUpdating] = React.useState(false);

    React.useEffect(() => {
        if (editingAuthor) {
            setEditAuthorName(editingAuthor.authorName || editingAuthor.AuthorName || editingAuthor.name || '');
        }
    }, [editingAuthor]);

    const handleSaveUpdateAuthor = async (e) => {
        e.preventDefault();
        if (!editAuthorName || !editAuthorName.trim()) return;

        setIsUpdating(true);
        try {
            const authorId = editingAuthor.id || editingAuthor.Id;
            const res = await fetch(`/api/authors/update/${authorId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorName: editAuthorName.trim() })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess("Author details updated successfully!");
            } else {
                alert(data.message || "Failed to update author.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsUpdating(false);
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
                    <i className="fa-solid fa-pen-to-square text-blue-600"></i> Edit Author 
                </h3>
            </div>

            <form onSubmit={handleSaveUpdateAuthor} className="space-y-6 text-xs max-w-2xl">
                <div>
                    <label className="font-bold block mb-1 text-slate-700">Author Full Name *</label>
                    <input
                        type="text"
                        required
                        value={editAuthorName}
                        onChange={e => setEditAuthorName(e.target.value)}
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
                        disabled={isUpdating}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-check"></i>
                        {isUpdating ? 'Updating Author...' : 'Update Author Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.EditAuthorForm = EditAuthorForm;