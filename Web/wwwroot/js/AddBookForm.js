// wwwroot/js/components/AddBookForm.js

function AddBookForm({
    categoriesList,
    languagesList,
    authorsList,
    vendorsList,
    setShowAddCategoryModal,
    setShowAddLanguageModal,
    setShowAddAuthorModal,
    onSuccess,
    onCancel
}) {
    const [bookCodeInput, setBookCodeInput] = React.useState('');
    const [isbnInput, setIsbnInput] = React.useState('');
    const [itemNameInput, setItemNameInput] = React.useState('');
    const [categoryCodeInput, setCategoryCodeInput] = React.useState('');
    const [noOfPagesInput, setNoOfPagesInput] = React.useState(100);
    const [languageInput, setLanguageInput] = React.useState('English');
    const [authorInput, setAuthorInput] = React.useState('');
    const [vendorNameInput, setVendorNameInput] = React.useState('');
    const [bookPriceInput, setBookPriceInput] = React.useState('');
    const [coverImageFile, setCoverImageFile] = React.useState(null);
    const [mainPdfFile, setMainPdfFile] = React.useState(null);
    const [isPublishingBook, setIsPublishingBook] = React.useState(false);

    // Auto-extract last 5 alphanumeric characters from ISBN to populate Item Code
    const handleIsbnChange = (e) => {
        const val = e.target.value;
        setIsbnInput(val);

        const cleanVal = val.replace(/[^a-zA-Z0-9]/g, '');
        if (cleanVal.length >= 5) {
            const last5 = cleanVal.slice(-5).toUpperCase();
            setBookCodeInput(`${last5}`);
        } else if (cleanVal.length > 0) {
            setBookCodeInput(`${cleanVal.toUpperCase()}`);
        }
    };

    const handlePublishFullBook = async (e) => {
        e.preventDefault();
        if (!bookCodeInput || !categoryCodeInput || !itemNameInput || !bookPriceInput || !mainPdfFile) {
            alert("Please select Category, fill Item Code, Item Name, Price and select Main PDF file.");
            return;
        }

        setIsPublishingBook(true);

        const formData = new FormData();
        formData.append('itemNo', bookCodeInput.trim().toUpperCase());
        formData.append('isbn', isbnInput || 'N/A');
        formData.append('itemName', itemNameInput.trim());
        formData.append('categoryCode', categoryCodeInput);
        formData.append('noOfPages', parseInt(noOfPagesInput) || 1);
        formData.append('language', languageInput || 'English');
        formData.append('authorName', authorInput || 'System Administrator');
        formData.append('vendorName', vendorNameInput || '');
        formData.append('price', parseFloat(bookPriceInput));
        if (coverImageFile) formData.append('coverImage', coverImageFile);
        formData.append('mainPdf', mainPdfFile);

        try {
            const res = await fetch('/api/author/book/upload-full-book', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                onSuccess(`Book '${itemNameInput.trim()}' uploaded and saved successfully!`);
            } else {
                alert(data.message || "Failed to publish book.");
            }
        } catch (err) {
            alert("Connection error: " + err.message);
        } finally {
            setIsPublishingBook(false);
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
                    <i className="fa-solid fa-user-pen text-blue-600"></i> Add New Item
                </h3>
            </div>

            <form onSubmit={handlePublishFullBook} className="space-y-4 text-xs">

                {/* 1. ISBN NUMBER (Pehle) & 2. ITEM CODE / BOOK CODE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">ISBN Number</label>
                        <input
                            type="text"
                            value={isbnInput}
                            onChange={handleIsbnChange}
                            placeholder="978-3-16-148410-0"
                            className="w-full border rounded px-3 py-2 font-semibold outline-none focus:border-blue-600"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Item Code / Book Code *</label>
                        <input
                            type="text"
                            required
                            value={bookCodeInput}
                            onChange={e => setBookCodeInput(e.target.value)}
                            placeholder="84100"
                            className="w-full border rounded px-3 py-2 uppercase font-bold text-blue-700 bg-slate-50 outline-none focus:border-blue-600"
                        />
                    </div>
                </div>

                {/* 3. CATEGORY MASTER (Clean Dropdown without Category Code), 4. LANGUAGE MASTER, 5. AUTHOR NAME */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">Category Master *</label>
                            <button type="button" onClick={() => setShowAddCategoryModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow cursor-pointer">
                                + Add Category
                            </button>
                        </div>
                        <select required value={categoryCodeInput} onChange={e => setCategoryCodeInput(e.target.value)} className="w-full border rounded px-3 py-2 font-bold bg-amber-50 outline-none">
                            <option value="">-- Select Category --</option>
                            {categoriesList.map(cat => (
                                <option key={cat.categoryCode || cat.CategoryCode} value={cat.categoryCode || cat.CategoryCode}>
                                    {cat.categoryName || cat.CategoryName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">Language Master *</label>
                            <button type="button" onClick={() => setShowAddLanguageModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow cursor-pointer">
                                + Add Language
                            </button>
                        </div>
                        <select required value={languageInput} onChange={e => setLanguageInput(e.target.value)} className="w-full border rounded px-3 py-2 font-bold bg-indigo-50 outline-none">
                            <option value="">-- Select Language --</option>
                            {languagesList.map(lang => (
                                <option key={lang.id || lang.code || lang.name} value={lang.name || lang.languageName}>
                                    {lang.name || lang.languageName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="font-bold text-slate-700">Author Name *</label>
                            <button type="button" onClick={() => setShowAddAuthorModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded shadow cursor-pointer">
                                + Add Author
                            </button>
                        </div>
                        <select required value={authorInput} onChange={e => setAuthorInput(e.target.value)} className="w-full border rounded px-3 py-2 font-bold bg-blue-50 outline-none">
                            <option value="">-- Select Author --</option>
                            {authorsList.map(ath => (
                                <option key={ath.id || ath.name} value={ath.name}>
                                    {ath.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 6. TOTAL PAGE COUNT & VENDOR NAME (MANUAL + SUGGESTION) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Total Page Count *</label>
                        <input
                            type="number"
                            required
                            value={noOfPagesInput}
                            onChange={e => setNoOfPagesInput(e.target.value)}
                            placeholder="150"
                            className="w-full border rounded px-3 py-2 font-bold outline-none"
                        />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Vendor / Publisher Name</label>
                        <input
                            type="text"
                            list="vendors-datalist-add"
                            value={vendorNameInput}
                            onChange={e => setVendorNameInput(e.target.value)}
                            placeholder="Type Vendor Name (e.g. Aman Singh) or leave blank for In-House"
                            className="w-full border rounded px-3 py-2 font-bold bg-emerald-50 outline-none focus:border-emerald-600"
                        />
                        <datalist id="vendors-datalist-add">
                            {vendorsList && vendorsList.map(v => {
                                const vName = v.name || v.Name || v.vendorName || v.VendorName;
                                return <option key={v.id || v.Id} value={vName} />;
                            })}
                        </datalist>
                    </div>
                </div>

                {/* 7. ITEM NAME & PRICE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Item Name / Book Name *</label>
                        <input type="text" required value={itemNameInput} onChange={e => setItemNameInput(e.target.value)} placeholder="Materia Medica & Repertory" className="w-full border rounded px-3 py-2 font-bold outline-none" />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Price (₹) *</label>
                        <input type="number" required value={bookPriceInput} onChange={e => setBookPriceInput(e.target.value)} placeholder="499" className="w-full border rounded px-3 py-2 font-bold outline-none" />
                    </div>
                </div>

                {/* 8. COVER IMAGE & MAIN PDF */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Front Cover Image</label>
                        <input type="file" accept="image/*" onChange={e => setCoverImageFile(e.target.files[0])} className="w-full border p-2 rounded bg-gray-50 text-xs" />
                    </div>
                    <div>
                        <label className="font-bold block mb-1 text-slate-700">Full Book PDF *</label>
                        <input type="file" accept="application/pdf" required onChange={e => setMainPdfFile(e.target.files[0])} className="w-full border p-2 rounded bg-gray-50 text-xs" />
                    </div>
                </div>

                {/* FORM ACTIONS */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                    <button type="button" onClick={onCancel} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2 rounded text-xs cursor-pointer">
                        Cancel
                    </button>
                    <button type="submit" disabled={isPublishingBook} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded text-xs shadow cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-upload"></i>
                        {isPublishingBook ? 'Uploading...' : 'Upload Book Master'}
                    </button>
                </div>
            </form>
        </div>
    );
}
window.AddBookForm = AddBookForm;