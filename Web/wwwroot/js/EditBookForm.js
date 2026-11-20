function EditBookForm({ editingBook, languagesList, vendorsList, onSuccess, onCancel }) {
    const [editBookItemName, setEditBookItemName] = React.useState(
        editingBook ? (editingBook.itemName || editingBook.ItemName || '') : ''
    );
    const [editBookPrice, setEditBookPrice] = React.useState(
        editingBook ? (editingBook.price !== undefined ? editingBook.price : editingBook.Price || 0) : 0
    );
    const [editBookPages, setEditBookPages] = React.useState(
        editingBook ? (editingBook.noOfPages || editingBook.NoOfPages || 100) : 100
    );
    const [editBookLanguage, setEditBookLanguage] = React.useState(
        editingBook ? (editingBook.language || editingBook.Language || 'English') : 'English'
    );
    const [editVendorName, setEditVendorName] = React.useState(
        editingBook ? (editingBook.vendorName || editingBook.VendorName || '') : ''
    );
    const [editCoverImageFile, setEditCoverImageFile] = React.useState(null);
    const [editMainPdfFile, setEditMainPdfFile] = React.useState(null);
    const [isSavingBookEdit, setIsSavingBookEdit] = React.useState(false);
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

    const getTargetBookId = () => {
        if (!editingBook) return '';
        if (editingBook.raw) {
            return editingBook.raw.id || editingBook.raw.Id || editingBook.raw.itemNo || editingBook.raw.ItemNo;
        }
        return editingBook.id || editingBook.Id || editingBook.itemNo || editingBook.ItemNo;
    };

    const handleSaveBookUpdate = async (e) => {
        e.preventDefault();
        if (submitLockRef.current) return;

        const rawBookId = getTargetBookId();
        if (!rawBookId) {
            setErrorMsg("Book ID missing! Update failed.");
            return;
        }

        submitLockRef.current = true;
        setIsSavingBookEdit(true);
        setErrorMsg('');

        const encodedId = encodeURIComponent(String(rawBookId).trim());
        const formData = new FormData();
        formData.append('itemName', editBookItemName.trim());
        formData.append('price', parseFloat(editBookPrice) || 0);
        formData.append('noOfPages', parseInt(editBookPages, 10) || 1);
        formData.append('language', editBookLanguage);
        formData.append('vendorName', editVendorName.trim());

        if (editCoverImageFile) formData.append('coverImage', editCoverImageFile);
        if (editMainPdfFile) formData.append('mainPdf', editMainPdfFile);

        try {
            let res = await fetch(`/api/author/book/update-book/${encodedId}`, {
                method: 'POST',
                body: formData
            });

            if (res.status === 405) {
                res = await fetch(`/api/author/book/update-book/${encodedId}`, {
                    method: 'PUT',
                    body: formData
                });
            }

            const data = await safeParse(res);
            if (res.ok && data.success !== false) {
                if (typeof window.invalidateApiCache === 'function') {
                    window.invalidateApiCache('/api/author/book');
                    window.invalidateApiCache('/api/reader/catalog');
                }
                if (onSuccess) {
                    onSuccess(data.message || `Book '${editBookItemName}' updated successfully!`);
                }
            } else {
                setErrorMsg(data.message || `Failed to update book (Status: ${res.status}).`);
            }
        } catch (err) {
            setErrorMsg("Network error: " + err.message);
        } finally {
            setIsSavingBookEdit(false);
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
                    <i className="fa-solid fa-pen-to-square text-blue-600"></i> Edit Book
                </h3>
            </div>

            {errorMsg && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{errorMsg}</span>
                </div>
            )}

            <form onSubmit={handleSaveBookUpdate} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="font-bold block mb-1">Item / Book Name *</label>
                        <input
                            type="text"
                            required
                            value={editBookItemName}
                            onChange={e => setEditBookItemName(e.target.value)}
                            className="w-full border rounded px-3 py-2 font-bold"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1">Price (₹) *</label>
                        <input
                            type="number"
                            required
                            value={editBookPrice}
                            onChange={e => setEditBookPrice(e.target.value)}
                            className="w-full border rounded px-3 py-2 font-bold"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="font-bold block mb-1">Language *</label>
                        <select
                            required
                            value={editBookLanguage}
                            onChange={e => setEditBookLanguage(e.target.value)}
                            className="w-full border rounded px-3 py-2 font-bold bg-indigo-50">
                            {(languagesList || []).map(lang => (
                                <option key={lang.id || lang.code || lang.name} value={lang.name || lang.languageName}>
                                    {lang.name || lang.languageName}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="font-bold block mb-1">Total Page Count *</label>
                        <input
                            type="number"
                            value={editBookPages}
                            onChange={e => setEditBookPages(e.target.value)}
                            className="w-full border rounded px-3 py-2 font-bold"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1">Vendor Name (Manual Entry)</label>
                        <input
                            type="text"
                            list="vendors-datalist-edit"
                            value={editVendorName}
                            onChange={e => setEditVendorName(e.target.value)}
                            placeholder="Type Vendor Name"
                            className="w-full border rounded px-3 py-2 font-bold bg-emerald-50 outline-none focus:border-emerald-600"
                        />
                        <datalist id="vendors-datalist-edit">
                            {(vendorsList || []).map(v => {
                                const vName = v.name || v.Name || v.vendorName || v.VendorName;
                                return <option key={v.id || v.Id} value={vName} />;
                            })}
                        </datalist>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-3">
                    <div>
                        <label className="font-bold block mb-1">Replace Front Cover Image (Optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => setEditCoverImageFile(e.target.files[0])}
                            className="w-full border p-2 rounded bg-gray-50 text-xs"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1">Replace Full Book PDF (Optional)</label>
                        <input
                            type="file"
                            accept="application/pdf"
                            onChange={e => setEditMainPdfFile(e.target.files[0])}
                            className="w-full border p-2 rounded bg-gray-50 text-xs"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2 rounded text-xs cursor-pointer">
                        Cancel
                    </button>
                    <button type="submit" disabled={isSavingBookEdit} className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className={`fa-solid ${isSavingBookEdit ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                        {isSavingBookEdit ? 'Saving Details...' : 'Update Book Details'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.EditBookForm = EditBookForm;