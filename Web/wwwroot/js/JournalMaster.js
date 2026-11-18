
function JournalMaster({ categoriesList = [], languagesList = [], triggerToast }) {
    const [journals, setJournals] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('ALL');

   
    const [viewMode, setViewMode] = React.useState('list');
    const [editingJournal, setEditingJournal] = React.useState(null);

    
    const [journalCode, setJournalCode] = React.useState('');
    const [name, setName] = React.useState('');
    const [publisherName, setPublisherName] = React.useState('');
    const [publishDate, setPublishDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [issn, setIssn] = React.useState('');
    const [volumeIssue, setVolumeIssue] = React.useState('');
    const [frequency, setFrequency] = React.useState('Quarterly');
    const [categoryCode, setCategoryCode] = React.useState('HOMEO');
    const [language, setLanguage] = React.useState('English');
    const [description, setDescription] = React.useState('');
    const [isActive, setIsActive] = React.useState(true);
    const [coverFile, setCoverFile] = React.useState(null);
    const [coverPreview, setCoverPreview] = React.useState('/images/default-cover.png');
    const [pdfFile, setPdfFile] = React.useState(null);
    const [existingPdfPath, setExistingPdfPath] = React.useState('');
    const [saving, setSaving] = React.useState(false);

    
    const [bulkRows, setBulkRows] = React.useState([
        { name: '', publisherName: '', publishDate: new Date().toISOString().split('T')[0], issn: '', volumeIssue: '', frequency: 'Quarterly', language: 'English' },
        { name: '', publisherName: '', publishDate: new Date().toISOString().split('T')[0], issn: '', volumeIssue: '', frequency: 'Monthly', language: 'English' }
    ]);

    const fetchJournals = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/journal/all');
            if (res.ok) {
                const data = await res.json();
                setJournals(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Fetch journals error:", err);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchJournals();
    }, []);

    const openCreateForm = () => {
        setEditingJournal(null);
        setJournalCode('JRN-' + Math.floor(100000 + Math.random() * 900000));
        setName('');
        setPublisherName('B. Jain Publishers');
        setPublishDate(new Date().toISOString().split('T')[0]);
        setIssn('');
        setVolumeIssue('');
        setFrequency('Quarterly');
        setCategoryCode(categoriesList.length > 0 ? (categoriesList[0].categoryCode || categoriesList[0].CategoryCode || 'HOMEO') : 'HOMEO');
        setLanguage('English');
        setDescription('');
        setIsActive(true);
        setCoverFile(null);
        setCoverPreview('/images/default-cover.png');
        setPdfFile(null);
        setExistingPdfPath('');
        setViewMode('form');
    };

    const openEditForm = (j) => {
        setEditingJournal(j);
        setJournalCode(j.journalCode || '');
        setName(j.name || '');
        setPublisherName(j.publisherName || '');
        const dt = j.publishDate ? new Date(j.publishDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        setPublishDate(dt);
        setIssn(j.issn || '');
        setVolumeIssue(j.volumeIssue || '');
        setFrequency(j.frequency || 'Quarterly');
        setCategoryCode(j.categoryCode || 'HOMEO');
        setLanguage(j.language || 'English');
        setDescription(j.description || '');
        setIsActive(j.isActive !== false);
        setCoverFile(null);
        setCoverPreview(j.coverImagePath || '/images/default-cover.png');
        setPdfFile(null);
        setExistingPdfPath(j.pdfFilePath || '');
        setViewMode('form');
    };

    const handleCoverChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            setCoverFile(file);
            setCoverPreview(URL.createObjectURL(file));
        }
    };

    const handlePdfChange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                alert("Please select a valid PDF file (.pdf).");
                e.target.value = '';
                return;
            }
            setPdfFile(file);
        } else {
            setPdfFile(null);
        }
    };

    const handleSaveJournal = async (e) => {
        e.preventDefault();
        if (!name.trim() || !publisherName.trim() || !publishDate) {
            alert("Journal Name, Publisher Name, and Publish Date are required.");
            return;
        }

        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('JournalCode', journalCode);
            formData.append('Name', name.trim());
            formData.append('PublisherName', publisherName.trim());
            formData.append('PublishDate', publishDate);
            formData.append('ISSN', issn.trim());
            formData.append('VolumeIssue', volumeIssue.trim());
            formData.append('Frequency', frequency);
            formData.append('CategoryCode', categoryCode);
            formData.append('Language', language);
            formData.append('Description', description.trim());
            formData.append('IsActive', isActive);

            if (coverFile) {
                formData.append('CoverImage', coverFile);
            }
            if (pdfFile) {
                formData.append('JournalPdf', pdfFile);
            }

            const url = editingJournal
                ? `/api/journal/update/${editingJournal.id}`
                : '/api/journal/create';

            const res = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast(data.message || "Journal Saved Successfully!");
                await fetchJournals();
                setViewMode('list');
            } else {
                alert(data.message || "Error saving journal.");
            }
        } catch (err) {
            alert("Network error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteJournal = async (id, jName) => {
        if (!confirm(`Are you sure you want to delete journal "${jName}"?`)) return;
        try {
            const res = await fetch(`/api/journal/delete/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success !== false) {
                if (triggerToast) triggerToast(data.message || "Journal Deleted!");
                await fetchJournals();
            } else {
                alert(data.message || "Error deleting journal.");
            }
        } catch (err) {
            alert("Delete error: " + err.message);
        }
    };

    
    const handleBulkRowChange = (idx, field, val) => {
        const updated = [...bulkRows];
        updated[idx][field] = val;
        setBulkRows(updated);
    };

    const addBulkRow = () => {
        setBulkRows([...bulkRows, {
            name: '',
            publisherName: '',
            publishDate: new Date().toISOString().split('T')[0],
            issn: '',
            volumeIssue: '',
            frequency: 'Quarterly',
            language: 'English'
        }]);
    };

    const removeBulkRow = (idx) => {
        if (bulkRows.length <= 1) return;
        setBulkRows(bulkRows.filter((_, i) => i !== idx));
    };

    const handleSaveBulkJournals = async (e) => {
        e.preventDefault();
        const validRows = bulkRows.filter(r => r.name.trim() && r.publisherName.trim());
        if (validRows.length === 0) {
            alert("Please enter at least one row with Journal Name and Publisher Name.");
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/journal/bulk-upload-grid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validRows)
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (triggerToast) triggerToast(data.message);
                await fetchJournals();
                setViewMode('list');
            } else {
                alert(data.message || "Bulk upload failed.");
            }
        } catch (err) {
            alert("Bulk save error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    
    const filteredJournals = journals.filter(j => {
        const matchesSearch =
            (j.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (j.publisherName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (j.journalCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (j.issn || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesStatus =
            statusFilter === 'ALL' ||
            (statusFilter === 'ACTIVE' && j.isActive) ||
            (statusFilter === 'INACTIVE' && !j.isActive);

        return matchesSearch && matchesStatus;
    });

    
    if (viewMode === 'form') {
        return (
            <div className="w-full bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-6 text-xs">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full cursor-pointer">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                <i className="fa-solid fa-newspaper text-indigo-600"></i>
                                {editingJournal ? 'Edit Journal Master Record' : 'Create New Journal Master Record'}
                            </h3>
                            <p className="text-slate-500">Enter Journal Name, Publisher Name, Publish Date, Cover Image, and Issue/Article PDF.</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setViewMode('list')} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded cursor-pointer">
                        Cancel
                    </button>
                </div>

                <form onSubmit={handleSaveJournal} className="space-y-6">
                    {/* CORE REQUIRED FIELDS */}
                    <div className="bg-indigo-50/40 p-5 rounded-lg border border-indigo-200 space-y-4">
                        <h4 className="font-bold text-indigo-900 text-sm border-b border-indigo-200 pb-2">
                            1. Core Journal Publication Details (Required)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Journal Code</label>
                                <input type="text" readOnly value={journalCode} className="w-full border border-slate-300 rounded px-3 py-2.5 font-mono font-bold bg-slate-100 text-indigo-900" />
                            </div>
                            <div className="md:col-span-2">
                                <label className="font-bold block mb-1.5 text-slate-700">Journal Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. The Homoeopathic Heritage"
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-bold text-slate-900 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Publish Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={publishDate}
                                    onChange={e => setPublishDate(e.target.value)}
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-bold text-slate-900 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="font-bold block mb-1.5 text-slate-700">Publisher Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={publisherName}
                                    onChange={e => setPublisherName(e.target.value)}
                                    placeholder="e.g. B. Jain Publishers (P) Ltd."
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-bold text-slate-900 bg-white outline-none focus:border-indigo-600"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">ISSN Number</label>
                                <input
                                    type="text"
                                    value={issn}
                                    onChange={e => setIssn(e.target.value)}
                                    placeholder="e.g. 0970-6038"
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-bold uppercase text-slate-800 bg-white"
                                />
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Volume / Issue No.</label>
                                <input
                                    type="text"
                                    value={volumeIssue}
                                    onChange={e => setVolumeIssue(e.target.value)}
                                    placeholder="e.g. Vol. 51, Issue 4"
                                    className="w-full border border-slate-300 rounded px-3 py-2.5 font-bold text-slate-800 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* CLASSIFICATION, COVER IMAGE & PDF UPLOAD */}
                    <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 space-y-4">
                        <h4 className="font-bold text-slate-800 text-sm border-b pb-2">
                            2. Classification, Status, Cover Image & Issue PDF
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Publication Frequency</label>
                                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="Monthly">Monthly</option>
                                    <option value="Bi-Monthly">Bi-Monthly</option>
                                    <option value="Quarterly">Quarterly</option>
                                    <option value="Half-Yearly">Half-Yearly</option>
                                    <option value="Annual">Annual</option>
                                </select>
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Category</label>
                                <select value={categoryCode} onChange={e => setCategoryCode(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="HOMEO">Homoeopathy (Default)</option>
                                    {categoriesList.map((c, i) => {
                                        const code = c.categoryCode || c.CategoryCode;
                                        const cName = c.categoryName || c.CategoryName;
                                        return <option key={code || i} value={code}>{cName}</option>;
                                    })}
                                </select>
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Language</label>
                                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="English">English</option>
                                    <option value="Hindi">Hindi</option>
                                    {languagesList.map((l, i) => {
                                        const lName = l.languageName || l.LanguageName;
                                        return <option key={l.id || i} value={lName}>{lName}</option>;
                                    })}
                                </select>
                            </div>
                            <div>
                                <label className="font-bold block mb-1.5 text-slate-700">Active Status</label>
                                <select value={isActive ? "true" : "false"} onChange={e => setIsActive(e.target.value === "true")} className="w-full border rounded px-3 py-2.5 font-bold bg-white">
                                    <option value="true">Active (Published)</option>
                                    <option value="false">Inactive (Draft/Archived)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                            <div className="md:col-span-2">
                                <label className="font-bold block mb-1.5 text-slate-700">Editorial Notes / Description</label>
                                <textarea
                                    rows="3"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Brief summary of journal issue, clinical focus, or editorial board..."
                                    className="w-full border rounded px-3 py-2 font-semibold bg-white"
                                ></textarea>
                            </div>

                            {/* COVER IMAGE UPLOAD */}
                            <div className="flex items-center gap-3 bg-white p-3 rounded border border-slate-200">
                                <img src={coverPreview} alt="Cover" className="w-14 h-20 object-cover rounded border shadow-sm shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <label className="font-bold block mb-1 text-slate-700">Journal Cover Image</label>
                                    <input type="file" accept="image/*" onChange={handleCoverChange} className="w-full text-[11px]" />
                                    <span className="text-[10px] text-slate-400 block mt-1">JPG, PNG, WEBP</span>
                                </div>
                            </div>

                            {/* JOURNAL ISSUE / ARTICLE PDF UPLOAD */}
                            <div className="flex flex-col justify-center bg-white p-3 rounded border border-red-200">
                                <label className="font-bold block mb-1 text-slate-700 flex items-center gap-1.5">
                                    <i className="fa-solid fa-file-pdf text-red-600"></i> Journal Issue / Article PDF
                                </label>
                                <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={handlePdfChange}
                                    className="w-full text-[11px]"
                                />
                                {pdfFile ? (
                                    <span className="text-[10px] text-emerald-700 font-bold mt-1.5 truncate flex items-center gap-1">
                                        <i className="fa-solid fa-circle-check"></i> {pdfFile.name}
                                    </span>
                                ) : existingPdfPath ? (
                                    <a
                                        href={existingPdfPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] text-red-600 font-bold hover:underline mt-1.5 inline-flex items-center gap-1">
                                        <i className="fa-solid fa-eye"></i> View Uploaded PDF
                                    </a>
                                ) : (
                                    <span className="text-[10px] text-slate-400 mt-1.5">Upload full issue or article PDF</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setViewMode('list')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-6 py-2.5 rounded cursor-pointer">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-2.5 rounded shadow flex items-center gap-2 cursor-pointer">
                            <i className="fa-solid fa-check"></i> {saving ? 'Saving...' : (editingJournal ? 'Update Journal' : 'Save Journal')}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    
    if (viewMode === 'bulk') {
        return (
            <div className="w-full bg-white p-6 rounded-xl shadow-md border border-slate-200 space-y-5 text-xs">
                <div className="flex items-center justify-between border-b pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setViewMode('list')} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full cursor-pointer">
                            <i className="fa-solid fa-arrow-left"></i>
                        </button>
                        <div>
                            <h3 className="text-xl font-bold text-[#0d233a]">Bulk Journal Entry Grid</h3>
                            <p className="text-slate-500">Add multiple journals at once with Name, Publisher Name, and Publish Date.</p>
                        </div>
                    </div>
                    <button onClick={addBulkRow} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded cursor-pointer">
                        + Add Row
                    </button>
                </div>

                <form onSubmit={handleSaveBulkJournals} className="space-y-4">
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                                    <th className="p-2.5">#</th>
                                    <th className="p-2.5">Journal Name *</th>
                                    <th className="p-2.5">Publisher Name *</th>
                                    <th className="p-2.5">Publish Date *</th>
                                    <th className="p-2.5">ISSN</th>
                                    <th className="p-2.5">Vol / Issue</th>
                                    <th className="p-2.5">Frequency</th>
                                    <th className="p-2.5 text-center">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bulkRows.map((row, idx) => (
                                    <tr key={idx} className="border-b">
                                        <td className="p-2 font-bold text-slate-500">{idx + 1}</td>
                                        <td className="p-2">
                                            <input type="text" value={row.name} onChange={e => handleBulkRowChange(idx, 'name', e.target.value)} placeholder="Journal Title" className="w-full border rounded px-2.5 py-1.5 font-bold" />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" value={row.publisherName} onChange={e => handleBulkRowChange(idx, 'publisherName', e.target.value)} placeholder="Publisher Name" className="w-full border rounded px-2.5 py-1.5 font-bold" />
                                        </td>
                                        <td className="p-2">
                                            <input type="date" value={row.publishDate} onChange={e => handleBulkRowChange(idx, 'publishDate', e.target.value)} className="w-full border rounded px-2.5 py-1.5 font-bold" />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" value={row.issn} onChange={e => handleBulkRowChange(idx, 'issn', e.target.value)} placeholder="0970-XXXX" className="w-full border rounded px-2.5 py-1.5" />
                                        </td>
                                        <td className="p-2">
                                            <input type="text" value={row.volumeIssue} onChange={e => handleBulkRowChange(idx, 'volumeIssue', e.target.value)} placeholder="Vol 1, No 1" className="w-full border rounded px-2.5 py-1.5" />
                                        </td>
                                        <td className="p-2">
                                            <select value={row.frequency} onChange={e => handleBulkRowChange(idx, 'frequency', e.target.value)} className="w-full border rounded px-2.5 py-1.5 font-bold">
                                                <option value="Monthly">Monthly</option>
                                                <option value="Quarterly">Quarterly</option>
                                                <option value="Annual">Annual</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => removeBulkRow(idx)} className="text-red-600 hover:text-red-800 font-bold cursor-pointer">
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setViewMode('list')} className="bg-slate-200 text-slate-700 font-bold px-5 py-2 rounded">Cancel</button>
                        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded shadow cursor-pointer">
                            {saving ? 'Saving...' : 'Save All Journals'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    
    const activeCount = journals.filter(j => j.isActive).length;
    const uniquePublishers = new Set(journals.map(j => (j.publisherName || '').trim().toLowerCase()).filter(Boolean)).size;

    return (
        <div className="w-full space-y-5 text-xs">
            {/* HEADER BAR */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200 gap-3">
                <div>
                    <h2 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                        <i className="fa-solid fa-newspaper text-indigo-600"></i> Journal Master Directory
                    </h2>
                    <p className="text-slate-500 mt-0.5">Manage academic & clinical journals, publishers, publish dates, ISSN, issues, and PDFs.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setViewMode('bulk')}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-4 py-2.5 rounded flex items-center gap-2 cursor-pointer">
                        <i className="fa-solid fa-table-cells"></i> Bulk Entry Grid
                    </button>
                    <button
                        onClick={openCreateForm}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded shadow flex items-center gap-2 cursor-pointer">
                        <i className="fa-solid fa-plus"></i> Add New Journal
                    </button>
                </div>
            </div>

            {/* KPI SUMMARY CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Total Journals</span>
                        <span className="text-2xl font-black text-slate-900 block mt-0.5">{journals.length}</span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-book-journal-whills"></i>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Active Publications</span>
                        <span className="text-2xl font-black text-emerald-700 block mt-0.5">{activeCount}</span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-circle-check"></i>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Registered Publishers</span>
                        <span className="text-2xl font-black text-amber-700 block mt-0.5">{uniquePublishers}</span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-building"></i>
                    </div>
                </div>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 justify-between">
                <div className="relative flex-1">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400"></i>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by Journal Name, Publisher Name, Code, or ISSN..."
                        className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 font-semibold outline-none focus:border-indigo-600"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 font-bold bg-slate-50">
                    <option value="ALL">All Status ({journals.length})</option>
                    <option value="ACTIVE">Active Only ({activeCount})</option>
                    <option value="INACTIVE">Inactive Only ({journals.length - activeCount})</option>
                </select>
            </div>

            {/* DATA TABLE */}
            {loading ? (
                <div className="bg-white p-10 rounded-xl border text-center font-bold text-slate-400">
                    <i className="fa-solid fa-spinner fa-spin text-xl text-indigo-600 mb-2 block"></i>
                    Loading Journal Master...
                </div>
            ) : filteredJournals.length === 0 ? (
                <div className="bg-white p-12 rounded-xl border border-dashed text-center text-slate-500 space-y-2">
                    <i className="fa-solid fa-newspaper text-3xl text-slate-300"></i>
                    <p className="font-bold">No journal records found.</p>
                    <button onClick={openCreateForm} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                        + Click here to create your first journal
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b">
                                <th className="p-3">Cover</th>
                                <th className="p-3">Code / ISSN</th>
                                <th className="p-3">Journal Name</th>
                                <th className="p-3">Publisher Name</th>
                                <th className="p-3">Publish Date</th>
                                <th className="p-3">Vol / Frequency</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJournals.map(j => (
                                <tr key={j.id} className="border-b hover:bg-indigo-50/40 transition">
                                    <td className="p-3">
                                        <img src={j.coverImagePath || '/images/default-cover.png'} alt={j.name} className="w-10 h-12 object-cover rounded border" />
                                    </td>
                                    <td className="p-3">
                                        <span className="font-mono font-bold text-indigo-700 block">{j.journalCode}</span>
                                        {j.issn && <span className="text-[10px] text-slate-500 font-semibold">ISSN: {j.issn}</span>}
                                    </td>
                                    <td className="p-3">
                                        <span className="font-bold text-slate-900 text-sm block">{j.name}</span>
                                        <span className="text-[10px] text-slate-500">{j.categoryName} • {j.language}</span>
                                    </td>
                                    <td className="p-3 font-bold text-slate-700">{j.publisherName}</td>
                                    <td className="p-3 font-semibold text-slate-700">
                                        <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2.5 py-1 rounded font-bold">
                                            {new Date(j.publishDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </span>
                                    </td>
                                    <td className="p-3">
                                        <span className="font-semibold text-slate-700 block">{j.volumeIssue || '—'}</span>
                                        <span className="text-[10px] text-slate-500">{j.frequency}</span>
                                    </td>
                                    <td className="p-3">
                                        {j.isActive ? (
                                            <span className="bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">Active</span>
                                        ) : (
                                            <span className="bg-slate-200 text-slate-700 font-bold px-2.5 py-0.5 rounded-full text-[10px]">Inactive</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right space-x-3">
                                        {j.pdfFilePath && (
                                            <a
                                                href={j.pdfFilePath}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-red-600 font-bold hover:underline cursor-pointer">
                                                <i className="fa-solid fa-file-pdf"></i> View PDF
                                            </a>
                                        )}
                                        <button onClick={() => openEditForm(j)} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                                            <i className="fa-solid fa-pen-to-square"></i> Edit
                                        </button>
                                        <button onClick={() => handleDeleteJournal(j.id, j.name)} className="text-red-600 font-bold hover:underline cursor-pointer">
                                            <i className="fa-solid fa-trash"></i> Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

window.JournalMaster = JournalMaster;