function EditCategoryForm({ editingCategory, onSuccess, onCancel }) {
    const [editCatName, setEditCatName] = React.useState(
        editingCategory ? (editingCategory.categoryName || editingCategory.CategoryName || '') : ''
    );
    const [editCatDesc, setEditCatDesc] = React.useState(
        editingCategory ? (editingCategory.description || editingCategory.Description || '') : ''
    );
    const [isUpdating, setIsUpdating] = React.useState(false);

    React.useEffect(() => {
        if (editingCategory) {
            setEditCatName(editingCategory.categoryName || editingCategory.CategoryName || '');
            setEditCatDesc(editingCategory.description || editingCategory.Description || '');
        }
    }, [editingCategory]);

    const handleSaveUpdateCategory = async (e) => {
        e.preventDefault();
        if (!editCatName || !editCatName.trim()) {
            alert("Category Name zaroori hai!");
            return;
        }

        setIsUpdating(true);
        const code = editingCategory.categoryCode || editingCategory.CategoryCode;

        try {
            const res = await fetch(`/api/category/update/${code}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryName: editCatName.trim(),
                    description: editCatDesc.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess("Category details update ho gayi hain!");
            } else {
                alert(data.message || "Category update karne mein error aaya.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const categoryCode = editingCategory ? (editingCategory.categoryCode || editingCategory.CategoryCode || '') : '';

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
                    <i className="fa-solid fa-pen-to-square text-blue-600"></i> Edit Category
                </h3>
            </div>

            <form onSubmit={handleSaveUpdateCategory} className="space-y-4 text-xs max-w-2xl">
                <div>
                    <label className="font-bold text-slate-700 block mb-1">Category Code (Read-Only)</label>
                    <input
                        type="text"
                        disabled
                        value={categoryCode}
                        className="w-full border rounded px-3 py-2.5 font-mono bg-gray-100 text-slate-500 font-bold outline-none"
                    />
                </div>

                <div>
                    <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                    <input
                        type="text"
                        required
                        value={editCatName}
                        onChange={e => setEditCatName(e.target.value)}
                        className="w-full border rounded px-3 py-2.5 font-bold outline-none focus:border-amber-600"
                    />
                </div>

                <div>
                    <label className="font-bold text-slate-700 block mb-1">Description / Details</label>
                    <textarea
                        rows="3"
                        value={editCatDesc}
                        onChange={e => setEditCatDesc(e.target.value)}
                        className="w-full border rounded px-3 py-2.5 outline-none focus:border-amber-600"
                    ></textarea>
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
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-check"></i>
                        {isUpdating ? 'Updating Category...' : 'Update Category Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}

window.EditCategoryForm = EditCategoryForm;