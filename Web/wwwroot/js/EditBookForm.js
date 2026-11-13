// wwwroot/js/EditBookForm.js

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

    const getTargetBookId = () => {
        if (!editingBook) return '';
        if (editingBook.raw) {
            return editingBook.raw.id || editingBook.raw.Id || editingBook.raw.itemNo || editingBook.raw.ItemNo;
        }
        return editingBook.id || editingBook.Id || editingBook.itemNo || editingBook.ItemNo;
    };

    const handleSaveBookUpdate = async (e) => {
        e.preventDefault();
        const rawBookId = getTargetBookId();
        if (!rawBookId) {
            alert("Book ID missing! Update failed.");
            return;
        }

        setIsSavingBookEdit(true);
        const encodedId = encodeURIComponent(String(rawBookId).trim());

        const formData = new FormData();
        formData.append('itemName', editBookItemName.trim());
        formData.append('price', parseFloat(editBookPrice) || 0);
        formData.append('noOfPages', parseInt(editBookPages) || 1);
        formData.append('language', editBookLanguage);
        formData.append('vendorName', editVendorName.trim());

        if (editCoverImageFile) formData.append('coverImage', editCoverImageFile);
        if (editMainPdfFile) formData.append('mainPdf', editMainPdfFile);

        try {
            let res = await fetch(`/api/author/book/update-book/${encodedId}`, {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                res = await fetch(`/api/author/book/update-book/${encodedId}`, {
                    method: 'PUT',
                    body: formData
                });
            }

            let data = {};
            const textResponse = await res.text();
            if (textResponse && textResponse.trim().length > 0) {
                try {
                    data = JSON.parse(textResponse);
                } catch (err) {
                    console.warn("Non-JSON response:", textResponse);
                }
            }

            if (res.ok && data.success !== false) {
                if (onSuccess) {
                    onSuccess(data.message || `Book '${editBookItemName}' updated successfully!`);
                }
            } else {
                alert(data.message || `Failed to update book (Status: ${res.status}).`);
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsSavingBookEdit(false);
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
                            {languagesList && languagesList.map(lang => (
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
                            {vendorsList && vendorsList.map(v => {
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
                    <button type="submit" disabled={isSavingBookEdit} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer">
                        {isSavingBookEdit ? 'Saving Details...' : 'Update Book Details'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.EditBookForm = EditBookForm;