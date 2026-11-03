const { useState, useEffect, useCallback, useRef } = React;

// DEDICATED EDIT AUTHOR FORM COMPONENT
function InternalEditAuthorForm({ editingAuthor, onSuccess, onCancel }) {
    const [editAuthorName, setEditAuthorName] = useState(
        editingAuthor ? (editingAuthor.authorName || editingAuthor.AuthorName || editingAuthor.name || '') : ''
    );
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
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
            <div className="flex items-center gap-4 border-b pb-3">
                <button
                    type="button"
                    onClick={onCancel}
                    title="Back to Master List"
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                    <i className="fa-solid fa-pen-to-square text-blue-600"></i> Edit Author Master Page
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

// ----------------------------------------------------------------------
// DRM PDF VIEWER (FAST MOUSE SCROLL & NAVIGABLE PAGINATION ENGINE)
// ----------------------------------------------------------------------
// SMART MULTI-ROLE DRM PDF VIEWER MODAL
function SecurePdfViewerModal({ book, user, onClose }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const renderTaskRef = useRef(null);
    const isScrollingRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [renderingPage, setRenderingPage] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [jumpPageInput, setJumpPageInput] = useState('1');
    const [pdfDoc, setPdfDoc] = useState(null);

    // Dynamic Extraction for Both Object and Raw String IDs
    const realId = typeof book === 'object' && book !== null
        ? (book.id || book.Id || book.itemNo || book.ItemNo || book.bookId)
        : book;

    const userEmail = user?.email || user?.Email || "reader@bjain.com";

    useEffect(() => {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }, []);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setErrorMsg('');

        const loadPdfStream = async () => {
            try {
                if (!realId) throw new Error("Invalid Book Identifier!");

                const encodedVal = encodeURIComponent(realId);

                // Prioritize BookController Direct Route first (Works for Home Page and Admin Table)
                const endpoints = [
                    `/api/author/book/view-pdf/${encodedVal}`,
                    `/api/reader/reader/stream-book/${encodedVal}`,
                    `/api/reader/stream-book/${encodedVal}`
                ];

                let arrayBuffer = null;
                let lastStatus = 404;

                for (const url of endpoints) {
                    try {
                        const res = await fetch(url, { headers: { 'Accept': 'application/pdf' } });
                        if (res.ok) {
                            arrayBuffer = await res.arrayBuffer();
                            if (arrayBuffer && arrayBuffer.byteLength > 0) break;
                        } else {
                            lastStatus = res.status;
                        }
                    } catch (e) {
                        console.warn(`Fetch error for ${url}:`, e);
                    }
                }

                if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                    throw new Error(`PDF Stream Load Failed (Status: ${lastStatus}). File missing or access denied.`);
                }

                const loadingTask = window.pdfjsLib.getDocument({
                    data: arrayBuffer,
                    disableAutoFetch: true,
                    disableStream: true
                });
                const pdf = await loadingTask.promise;

                if (isMounted) {
                    setPdfDoc(pdf);
                    setNumPages(pdf.numPages);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setErrorMsg(err.message || "Failed to render PDF memory stream.");
                    setLoading(false);
                }
            }
        };

        loadPdfStream();
        return () => { isMounted = false; };
    }, [realId]);

    const renderPage = useCallback(async (num) => {
        if (!pdfDoc || !canvasRef.current) return;

        if (renderTaskRef.current) {
            try { renderTaskRef.current.cancel(); } catch (e) { }
        }

        setRenderingPage(true);
        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale: 1.35 });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: context, viewport };
            renderTaskRef.current = page.render(renderContext);
            await renderTaskRef.current.promise;

            context.save();
            context.font = "bold 15px Arial";
            context.fillStyle = "rgba(190, 30, 45, 0.18)";
            context.rotate((-25 * Math.PI) / 180);

            const watermarkText = `${userEmail} | ${new Date().toLocaleDateString()} | B. JAIN DRM PROTECTED`;
            for (let i = -canvas.height; i < canvas.height * 2; i += 140) {
                for (let j = -canvas.width; j < canvas.width * 2; j += 260) {
                    context.fillText(watermarkText, j, i);
                }
            }
            context.restore();
        } catch (err) {
            if (err?.name !== 'RenderingCancelledException') {
                console.error("Page Render Error:", err);
            }
        } finally {
            setRenderingPage(false);
        }
    }, [pdfDoc, userEmail]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNumber);
            setJumpPageInput(pageNumber.toString());
        }
    }, [pdfDoc, pageNumber, renderPage]);

    const handleWheelScroll = (e) => {
        if (isScrollingRef.current || loading) return;

        if (e.deltaY > 25) {
            if (pageNumber < numPages) {
                isScrollingRef.current = true;
                setPageNumber(prev => Math.min(prev + 1, numPages));
                setTimeout(() => { isScrollingRef.current = false; }, 180);
            }
        } else if (e.deltaY < -25) {
            if (pageNumber > 1) {
                isScrollingRef.current = true;
                setPageNumber(prev => Math.max(prev - 1, 1));
                setTimeout(() => { isScrollingRef.current = false; }, 180);
            }
        }
    };

    const handleJumpPage = (e) => {
        e.preventDefault();
        const p = parseInt(jumpPageInput, 10);
        if (!isNaN(p) && p >= 1 && p <= numPages) {
            setPageNumber(p);
        } else {
            setJumpPageInput(pageNumber.toString());
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex flex-col select-none overflow-hidden">
            <div className="flex flex-wrap items-center justify-between bg-[#0d233a] px-6 py-3 border-b border-slate-800 shadow-lg text-white gap-3">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="bg-[#be1e2d] hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer">
                        ← Close Reader
                    </button>
                    <div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                            <i className="fa-solid fa-shield-halved"></i> Fast DRM Continuous Viewer
                        </span>
                        <h2 className="text-xs font-bold text-white truncate max-w-xs">
                            {book?.itemName || book?.ItemName || book?.title || "Secured Book View"}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                        disabled={pageNumber <= 1 || loading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold rounded text-xs border border-slate-700 cursor-pointer">
                        ◀ Prev
                    </button>

                    <form onSubmit={handleJumpPage} className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs">
                        <span className="text-slate-400 font-bold">Page</span>
                        <input
                            type="text"
                            value={jumpPageInput}
                            onChange={(e) => setJumpPageInput(e.target.value)}
                            className="w-14 bg-slate-900 border border-slate-700 text-amber-400 font-bold text-center rounded outline-none px-1"
                        />
                        <span className="text-slate-400 font-bold">of {numPages}</span>
                        <button type="submit" className="text-[10px] bg-slate-800 hover:bg-slate-700 text-white px-2 py-0.5 rounded font-bold ms-1">Go</button>
                    </form>

                    <button
                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
                        disabled={pageNumber >= numPages || loading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold rounded text-xs border border-slate-700 cursor-pointer">
                        Next ▶
                    </button>
                </div>

                <div className="hidden sm:block text-right">
                    <span className="text-[11px] text-slate-300 block font-mono">{userEmail}</span>
                </div>
            </div>

            <div
                ref={containerRef}
                onWheel={handleWheelScroll}
                className="flex-1 overflow-auto p-4 flex justify-center items-center bg-slate-950 relative cursor-grab">
                {loading ? (
                    <div className="text-white text-xs font-bold flex flex-col items-center gap-2">
                        <i className="fa-solid fa-spinner fa-spin text-3xl text-amber-500"></i>
                        <span>Decrypting DRM Book Memory Stream...</span>
                    </div>
                ) : errorMsg ? (
                    <div className="bg-red-950/60 border border-red-600 text-red-200 p-4 rounded text-xs font-bold max-w-md text-center">
                        ⚠️ {errorMsg}
                    </div>
                ) : (
                    <div className="relative shadow-2xl rounded bg-white border border-slate-800 min-h-[650px] flex items-center justify-center">
                        {renderingPage && (
                            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] z-10 flex items-center justify-center text-white text-xs font-bold gap-2">
                                <i className="fa-solid fa-circle-notch fa-spin text-xl text-amber-400"></i>
                                <span>Loading Page {pageNumber}...</span>
                            </div>
                        )}
                        <canvas ref={canvasRef} className="block select-none pointer-events-none" />
                    </div>
                )}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// MAIN APPLICATION COMPONENT WITH INTERNAL BROWSER HISTORY ROUTER
// ----------------------------------------------------------------------
function App() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');

    const [profileDropdown, setProfileDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState('store');

    const [masterDropdownOpen, setMasterDropdownOpen] = useState(false);
    const [selectedMaster, setSelectedMaster] = useState('items');

    const [bookPageMode, setBookPageMode] = useState('list');
    const [authorPageMode, setAuthorPageMode] = useState('list');
    const [categoryPageMode, setCategoryPageMode] = useState('list');
    const [languagePageMode, setLanguagePageMode] = useState('list');
    const [planPageMode, setPlanPageMode] = useState('list');

    const [selectedMasterIds, setSelectedMasterIds] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [showAddLanguageModal, setShowAddLanguageModal] = useState(false);
    const [showAddAuthorModal, setShowAddAuthorModal] = useState(false);

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const [deleteConfirmModal, setDeleteConfirmModal] = useState({
        show: false,
        id: null,
        ids: [],
        title: '',
        type: ''
    });

    const [quickCategoryName, setQuickCategoryName] = useState('');
    const [quickCategoryCode, setQuickCategoryCode] = useState('');
    const [quickLanguageName, setQuickLanguageName] = useState('');
    const [quickAuthorName, setQuickAuthorName] = useState('');

    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [visibleColumns, setVisibleColumns] = useState({
        col1: true,
        col2: true,
        col3: true
    });

    const [categoriesList, setCategoriesList] = useState([]);
    const [customersList, setCustomersList] = useState([]);
    const [authorsList, setAuthorsList] = useState([]);
    const [languagesList, setLanguagesList] = useState([]);
    const [keywordsList, setKeywordsList] = useState([]);
    const [plansList, setPlansList] = useState([]);
    const [storeBooks, setStoreBooks] = useState([]);
    const [myAuthorBooks, setMyAuthorBooks] = useState([]);
    const [loadingBooks, setLoadingBooks] = useState(false);

    const [editingPlan, setEditingPlan] = useState(null);
    const [editingAuthor, setEditingAuthor] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingLanguage, setEditingLanguage] = useState(null);

    const [editingKeyword, setEditingKeyword] = useState(null);
    const [editKwName, setEditKwName] = useState('');
    const [editKwDesc, setEditKwDesc] = useState('');
    const [isUpdatingKeyword, setIsUpdatingKeyword] = useState(false);

    const [editingCustomer, setEditingCustomer] = useState(null);
    const [editCustName, setEditCustName] = useState('');
    const [editCustMobile, setEditCustMobile] = useState('');
    const [editCustEmail, setEditCustEmail] = useState('');
    const [editCustAddress, setEditCustAddress] = useState('');
    const [isUpdatingCustomer, setIsUpdatingCustomer] = useState(false);

    const [editingBook, setEditingBook] = useState(null);

    const [kwNameInput, setKwNameInput] = useState('');
    const [kwDescInput, setKwDescInput] = useState('');

    const [custNameInput, setCustNameInput] = useState('');
    const [custMobileInput, setCustMobileInput] = useState('');
    const [custEmailInput, setCustEmailInput] = useState('');
    const [custAddressInput, setCustAddressInput] = useState('');

    const [selectedBookForDrm, setSelectedBookForDrm] = useState(null);

    const [user, setUser] = useState({
        isLoggedIn: false,
        fullName: '',
        email: '',
        role: ''
    });

    const [emailInput, setEmailInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [fullNameInput, setFullNameInput] = useState('');
    const [selectedRoleInput, setSelectedRoleInput] = useState('Author');

    const [forgotEmailInput, setForgotEmailInput] = useState('');
    const [newPasswordInput, setNewPasswordInput] = useState('');
    const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

    const [authError, setAuthError] = useState('');
    const [authSuccessMsg, setAuthSuccessMsg] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    // BROWSER BACK BUTTON CONTROLLER
    useEffect(() => {
        window.history.replaceState({ page: 'home', activeTab: 'store' }, '');

        const handlePopState = (event) => {
            if (isAuthOpen) {
                setIsAuthOpen(false);
                return;
            }
            if (selectedBookForDrm) {
                setSelectedBookForDrm(null);
                return;
            }
            if (deleteConfirmModal.show) {
                setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' });
                return;
            }
            if (showAddModal || showAddCategoryModal || showAddLanguageModal || showAddAuthorModal) {
                setShowAddModal(false);
                setShowAddCategoryModal(false);
                setShowAddLanguageModal(false);
                setShowAddAuthorModal(false);
                return;
            }

            if (event.state) {
                if (event.state.activeTab !== undefined) setActiveTab(event.state.activeTab);
                if (event.state.selectedMaster !== undefined) setSelectedMaster(event.state.selectedMaster);
                if (event.state.bookPageMode !== undefined) setBookPageMode(event.state.bookPageMode);
                if (event.state.authorPageMode !== undefined) setAuthorPageMode(event.state.authorPageMode);
                if (event.state.categoryPageMode !== undefined) setCategoryPageMode(event.state.categoryPageMode);
                if (event.state.languagePageMode !== undefined) setLanguagePageMode(event.state.languagePageMode);
                if (event.state.planPageMode !== undefined) setPlanPageMode(event.state.planPageMode);
            } else {
                setActiveTab('store');
                setBookPageMode('list');
                setAuthorPageMode('list');
                setCategoryPageMode('list');
                setLanguagePageMode('list');
                setPlanPageMode('list');
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isAuthOpen, selectedBookForDrm, deleteConfirmModal.show, showAddModal, showAddCategoryModal, showAddLanguageModal, showAddAuthorModal]);

    const changeNavState = (newState) => {
        const updatedState = {
            activeTab,
            selectedMaster,
            bookPageMode,
            authorPageMode,
            categoryPageMode,
            languagePageMode,
            planPageMode,
            ...newState
        };

        window.history.pushState(updatedState, '');

        if (newState.activeTab !== undefined) setActiveTab(newState.activeTab);
        if (newState.selectedMaster !== undefined) setSelectedMaster(newState.selectedMaster);
        if (newState.bookPageMode !== undefined) setBookPageMode(newState.bookPageMode);
        if (newState.authorPageMode !== undefined) setAuthorPageMode(newState.authorPageMode);
        if (newState.categoryPageMode !== undefined) setCategoryPageMode(newState.categoryPageMode);
        if (newState.languagePageMode !== undefined) setLanguagePageMode(newState.languagePageMode);
        if (newState.planPageMode !== undefined) setPlanPageMode(newState.planPageMode);
    };

    const triggerToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => {
            setToast({ show: false, message: '', type: 'success' });
        }, 3500);
    };

    const isAdmin = user.isLoggedIn && (
        (user.role && user.role.toString().toLowerCase() === 'admin') ||
        user.email === 'admin@booksystem.com'
    );

    const openAuthModal = (mode = 'login') => {
        setAuthError('');
        setAuthSuccessMsg('');
        setAuthMode(mode);
        window.history.pushState({ modal: 'auth' }, '');
        setIsAuthOpen(true);
    };

    const handleSelectAllMasterRows = (e, items) => {
        if (e.target.checked) {
            const allIds = items.map(item => item.id);
            setSelectedMasterIds(allIds);
        } else {
            setSelectedMasterIds([]);
        }
    };

    const handleSelectSingleMasterRow = (id) => {
        setSelectedMasterIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleOpenPdfModal = (bookObj) => {
        if (!bookObj) {
            triggerToast("Record missing!", "error");
            return;
        }
        window.history.pushState({ modal: 'reader' }, '');
        setSelectedBookForDrm(bookObj);
    };

    const handleClosePdfModal = () => {
        setSelectedBookForDrm(null);
    };

    const fetchPlansMaster = async () => {
        try {
            const res = await fetch('/api/plan/all');
            if (res.ok) {
                const data = await res.json();
                setPlansList(data);
            }
        } catch (e) { console.error("Fetch plans error:", e); }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/category/all');
            if (res.ok) {
                const data = await res.json();
                setCategoriesList(data.map(c => {
                    const rawCode = c.categoryCode || c.CategoryCode || c.id || c.Id || c.code;
                    return {
                        id: rawCode,
                        categoryCode: rawCode,
                        categoryName: c.categoryName || c.CategoryName || c.name || rawCode,
                        description: c.description || c.Description || 'System Category',
                        raw: c
                    };
                }));
            }
        } catch (e) { console.error("Fetch categories error:", e); }
    };

    const fetchLanguagesMaster = async () => {
        try {
            const res = await fetch('/api/language/all');
            if (res.ok) {
                const data = await res.json();
                setLanguagesList(data.map(l => {
                    const rawId = l.id || l.Id || l.languageCode || l.LanguageCode || l.code;
                    return {
                        id: rawId,
                        code: rawId,
                        name: l.languageName || l.LanguageName || l.name || rawId,
                        desc: 'System Language',
                        raw: l
                    };
                }));
            }
        } catch (e) { console.error("Fetch languages error:", e); }
    };

    const fetchKeywordsMaster = async () => {
        try {
            const res = await fetch('/api/keyword/all');
            if (res.ok) {
                const data = await res.json();
                setKeywordsList(data.map(k => ({
                    id: k.id || k.Id || k.keywordCode || k.KeywordCode,
                    code: k.keywordCode || k.KeywordCode,
                    name: k.keywordName || k.KeywordName,
                    desc: k.description || k.Description || 'Core Search Term',
                    raw: k
                })));
            }
        } catch (e) { console.error("Fetch keywords error:", e); }
    };

    const fetchCustomersMaster = async () => {
        try {
            const res = await fetch('/api/admin/admin/customers-list');
            if (res.ok) {
                const data = await res.json();
                setCustomersList(data.map(c => ({
                    ...c,
                    id: c.id || c.Id || c.custId || c.CustId
                })));
            }
        } catch (e) { console.error("Fetch customers error:", e); }
    };

    const fetchAuthorsMaster = async () => {
        try {
            const res = await fetch('/api/authors/all');
            if (res.ok) {
                const data = await res.json();
                setAuthorsList(data.map(a => ({
                    id: a.id || a.Id,
                    name: a.authorName || a.AuthorName || a.name || a.Name,
                    desc: `Created: ${new Date(a.createdAt || a.CreatedAt || Date.now()).toLocaleDateString()}`,
                    raw: a
                })));
            }
        } catch (e) { console.error("Fetch authors error:", e); }
    };

    const fetchStoreBooks = async () => {
        setLoadingBooks(true);
        try {
            const res = await fetch('/api/reader/catalog/all-books');
            if (res.ok) setStoreBooks(await res.json());
        } catch (e) {
            console.error("Fetch store books error:", e);
        } finally {
            setLoadingBooks(false);
        }
    };

    // AUTHOR NAME EXTRACTION HELPER FUNCTION (ACCURATELY PARSES AUTHOR NAME)
    const getBookAuthorName = (b) => {
        if (!b) return 'Dr. Samuel Hahnemann';
        // Primary check for specific author properties
        const possibleAuthor = b.authorName || b.AuthorName || b.author || b.Author || b.author_name || b.Author_Name;

        // If author property exists and is not System Administrator
        if (possibleAuthor && possibleAuthor !== 'System Administrator' && possibleAuthor.trim() !== '') {
            return possibleAuthor;
        }

        // Check if author ID exists in authorsList
        const authorId = b.authorId || b.AuthorId || b.authorCode || b.AuthorCode;
        if (authorId && authorsList.length > 0) {
            const foundAuthor = authorsList.find(a => String(a.id) === String(authorId) || String(a.name) === String(authorId));
            if (foundAuthor) return foundAuthor.name;
        }

        return possibleAuthor || 'Dr. Samuel Hahnemann';
    };

    const getBookPublisherName = (b) => {
        if (!b) return 'System Administrator';
        return b.publishedBy || b.PublishedBy || b.createdBy || b.CreatedBy || b.publisherName || b.PublisherName || b.createdByName || 'System Administrator';
    };

    const fetchAuthorBooks = async () => {
        try {
            let res = await fetch('/api/author/book/my-books');
            let data = [];
            if (res.ok) data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                const fallbackRes = await fetch('/api/reader/catalog/all-books');
                if (fallbackRes.ok) data = await fallbackRes.json();
            }

            if (Array.isArray(data)) {
                setMyAuthorBooks(data.map(b => {
                    const actualAuthor = getBookAuthorName(b);
                    const publisher = getBookPublisherName(b);

                    return {
                        id: b.id || b.Id || b.itemNo || b.ItemNo || 'N/A',
                        itemNo: b.itemNo || b.ItemNo || b.id || 'N/A',
                        itemName: b.itemName || b.ItemName || b.title || 'Untitled Book',
                        categoryCode: b.categoryCode || b.CategoryCode || 'HOMEO',
                        isbn: b.isbn || b.ISBN || b.Isbn || 'N/A',
                        authorName: actualAuthor,
                        publishedBy: publisher,
                        language: b.language || b.Language || 'English',
                        price: b.price !== undefined ? b.price : (b.Price !== undefined ? b.Price : 0),
                        noOfPages: b.noOfPages || b.NoOfPages || 1,
                        isPublished: b.isPublished !== undefined ? b.isPublished : (b.IsPublished !== undefined ? b.IsPublished : false),
                        raw: {
                            ...b,
                            extractedAuthorName: actualAuthor,
                            extractedPublisherName: publisher
                        }
                    };
                }));
            }
        } catch (e) {
            console.error("Fetch author books error:", e);
        }
    };

    const handleReadAccess = (bookObj) => {
        if (!user.isLoggedIn) {
            openAuthModal('login');
            return;
        }

        window.history.pushState({ modal: 'reader' }, '');
        setSelectedBookForDrm(bookObj);
    };

    useEffect(() => {
        fetchStoreBooks();
        fetchCategories();
        fetchLanguagesMaster();
        fetchKeywordsMaster();
        fetchPlansMaster();
        fetchAuthorsMaster();

        fetch('/api/account/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.email && localStorage.getItem('isExplicitLogin') === 'true') {
                    const primaryRole = data.roles && data.roles.length > 0 ? data.roles[0] : 'Reader';
                    setUser({
                        isLoggedIn: true,
                        fullName: data.fullName || data.email.split('@')[0],
                        email: data.email,
                        role: primaryRole
                    });
                } else {
                    setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
                }
            })
            .catch(() => {
                setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
            });
    }, []);

    useEffect(() => {
        setSelectedMasterIds([]);
        if (selectedMaster === 'customers') fetchCustomersMaster();
        else if (selectedMaster === 'plans') fetchPlansMaster();
        else if (selectedMaster === 'authors') fetchAuthorsMaster();
        else if (selectedMaster === 'categories') fetchCategories();
        else if (selectedMaster === 'languages') fetchLanguagesMaster();
        else if (selectedMaster === 'keywords') fetchKeywordsMaster();
        else if (selectedMaster === 'items') fetchAuthorBooks();
    }, [selectedMaster]);

    useEffect(() => {
        if (user.isLoggedIn && isAdmin) {
            fetchAuthorBooks();
            fetchCustomersMaster();
            fetchPlansMaster();
            fetchAuthorsMaster();
            fetchCategories();
            fetchLanguagesMaster();
            fetchKeywordsMaster();
        }
    }, [user.isLoggedIn, user.role, activeTab]);

    const toggleColumn = (colKey) => {
        setVisibleColumns(prev => ({ ...prev, [colKey]: !prev[colKey] }));
    };

    const handleApproveBook = async (bookObj, itemName) => {
        try {
            const targetId = typeof bookObj === 'object' && bookObj !== null
                ? (bookObj.id || bookObj.Id || bookObj.itemNo || bookObj.ItemNo)
                : bookObj;

            const res = await fetch(`/api/author/book/approve-book/${targetId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            let data = {};
            const textResponse = await res.text();
            if (textResponse && textResponse.trim().length > 0) {
                try {
                    data = JSON.parse(textResponse);
                } catch (e) {
                    console.warn("Non-JSON response:", textResponse);
                }
            }

            if (res.ok && (data.success !== false)) {
                triggerToast(data.message || `Book '${itemName}' approved & live on Store Catalogue!`);
                await fetchAuthorBooks();
                await fetchStoreBooks();
            } else {
                triggerToast(data.message || "Approval failed. Check server logs.", 'error');
            }
        } catch (err) {
            triggerToast("Error approving book: " + err.message, 'error');
        }
    };

    const handleOpenEditPlan = (plan) => {
        setEditingPlan(plan);
    };

    const handleAddKeywordMaster = async (e) => {
        e.preventDefault();
        if (!kwNameInput || !kwNameInput.trim()) return triggerToast("Keyword Name is required.", 'error');

        try {
            const res = await fetch('/api/keyword/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keywordName: kwNameInput.trim(),
                    description: kwDescInput.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                triggerToast(`Keyword '${kwNameInput.trim()}' saved to Database!`);
                setKwNameInput('');
                setKwDescInput('');
                setShowAddModal(false);
                await fetchKeywordsMaster();
            } else {
                triggerToast(data.message || "Failed to add Keyword.", 'error');
            }
        } catch (err) {
            triggerToast("Error saving Keyword: " + err.message, 'error');
        }
    };

    const handleOpenEditKeyword = (kw) => {
        setEditingKeyword(kw);
        setEditKwName(kw.keywordName || kw.KeywordName || kw.name || '');
        setEditKwDesc(kw.description || kw.Description || kw.desc || '');
    };

    const handleSaveUpdateKeyword = async (e) => {
        e.preventDefault();
        if (!editKwName || !editKwName.trim()) return triggerToast("Keyword Name is required.", 'error');

        setIsUpdatingKeyword(true);
        const kwId = editingKeyword.id || editingKeyword.Id;

        try {
            const res = await fetch(`/api/keyword/update/${kwId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keywordName: editKwName.trim(),
                    description: editKwDesc.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                triggerToast("Keyword details updated successfully!");
                setEditingKeyword(null);
                await fetchKeywordsMaster();
            } else {
                triggerToast(data.message || "Failed to update keyword.", 'error');
            }
        } catch (err) {
            triggerToast("Error updating keyword: " + err.message, 'error');
        } finally {
            setIsUpdatingKeyword(false);
        }
    };

    const handleOpenEditLanguagePage = (langObj) => {
        setEditingLanguage(langObj);
        changeNavState({ languagePageMode: 'edit-language-page' });
    };

    const handleOpenEditCategoryPage = (catObj) => {
        setEditingCategory(catObj);
        changeNavState({ categoryPageMode: 'edit-category-page' });
    };

    const handleSaveQuickCategory = async (e) => {
        e.preventDefault();
        if (!quickCategoryName.trim()) return triggerToast("Please enter Category Name.", 'error');

        try {
            const res = await fetch('/api/category/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    categoryName: quickCategoryName.trim(),
                    description: 'Manually added quick category'
                })
            });

            const data = await res.json();
            if (res.ok) {
                await fetchCategories();
                setQuickCategoryName('');
                setQuickCategoryCode('');
                setShowAddCategoryModal(false);
                triggerToast(`Category '${quickCategoryName.trim()}' saved successfully!`);
            } else {
                triggerToast(data.message || "Failed to add Category.", 'error');
            }
        } catch (err) {
            triggerToast("Error: " + err.message, 'error');
        }
    };

    const handleSaveQuickLanguage = async (e) => {
        e.preventDefault();
        if (!quickLanguageName.trim()) return triggerToast("Please enter Language Name.", 'error');

        try {
            const res = await fetch('/api/language/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    languageName: quickLanguageName.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                await fetchLanguagesMaster();
                setQuickLanguageName('');
                setShowAddLanguageModal(false);
                triggerToast(`Language '${quickLanguageName.trim()}' saved successfully!`);
            } else {
                triggerToast(data.message || "Failed to add Language.", 'error');
            }
        } catch (err) {
            triggerToast("Error: " + err.message, 'error');
        }
    };

    const handleSaveQuickAuthor = async (e) => {
        e.preventDefault();
        if (!quickAuthorName.trim()) return triggerToast("Please enter Author Name.", 'error');

        try {
            const res = await fetch('/api/authors/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authorName: quickAuthorName.trim() })
            });

            const data = await res.json();
            if (res.ok) {
                await fetchAuthorsMaster();
                setQuickAuthorName('');
                setShowAddAuthorModal(false);
                triggerToast(`Author '${quickAuthorName.trim()}' created successfully!`);
            } else {
                triggerToast(data.message || "Failed to add author.", 'error');
            }
        } catch (err) {
            triggerToast("Error creating author: " + err.message, 'error');
        }
    };

    const handleOpenEditAuthorPage = (authorObj) => {
        setEditingAuthor(authorObj);
        changeNavState({ authorPageMode: 'edit-author-page' });
    };

    const confirmDeleteSelectedMaster = async () => {
        try {
            const targetItems = deleteConfirmModal.ids && deleteConfirmModal.ids.length > 0
                ? deleteConfirmModal.ids
                : [deleteConfirmModal.id];

            let successCount = 0;

            for (const targetVal of targetItems) {
                const encodedVal = encodeURIComponent(targetVal);
                let endpoints = [];

                if (selectedMaster === 'items') {
                    endpoints = [`/api/author/book/delete-book/${encodedVal}`];
                } else if (selectedMaster === 'plans') {
                    endpoints = [`/api/plan/delete/${encodedVal}`, `/api/plan/${encodedVal}`];
                } else if (selectedMaster === 'authors') {
                    endpoints = [`/api/authors/delete/${encodedVal}`, `/api/authors/${encodedVal}`];
                } else if (selectedMaster === 'categories') {
                    endpoints = [
                        `/api/category/delete/${encodedVal}`,
                        `/api/category/${encodedVal}`,
                        `/api/category/delete-category/${encodedVal}`,
                        `/api/category/delete?code=${encodedVal}`,
                        `/api/category/delete?id=${encodedVal}`
                    ];
                } else if (selectedMaster === 'languages') {
                    endpoints = [
                        `/api/language/delete/${encodedVal}`,
                        `/api/language/${encodedVal}`,
                        `/api/language/delete-language/${encodedVal}`,
                        `/api/language/delete?id=${encodedVal}`
                    ];
                } else if (selectedMaster === 'keywords') {
                    endpoints = [`/api/keyword/delete/${encodedVal}`, `/api/keyword/${encodedVal}`];
                } else if (selectedMaster === 'customers') {
                    endpoints = [`/api/admin/admin/delete-customer/${encodedVal}`, `/api/customer/delete/${encodedVal}`];
                }

                let deletedSuccessfully = false;

                for (const url of endpoints) {
                    try {
                        let res = await fetch(url, { method: 'DELETE' });
                        if (!res.ok) {
                            res = await fetch(url, { method: 'POST' });
                        }
                        if (res.ok) {
                            deletedSuccessfully = true;
                            break;
                        }
                    } catch (e) {
                        console.warn(`Delete failed for ${url}:`, e);
                    }
                }

                if (deletedSuccessfully) {
                    successCount++;
                }
            }

            if (successCount > 0) {
                triggerToast(`${successCount} record(s) deleted successfully!`);
                setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' });
                setSelectedMasterIds([]);

                if (selectedMaster === 'items') { await fetchAuthorBooks(); await fetchStoreBooks(); }
                else if (selectedMaster === 'plans') await fetchPlansMaster();
                else if (selectedMaster === 'authors') await fetchAuthorsMaster();
                else if (selectedMaster === 'categories') await fetchCategories();
                else if (selectedMaster === 'languages') await fetchLanguagesMaster();
                else if (selectedMaster === 'keywords') await fetchKeywordsMaster();
                else if (selectedMaster === 'customers') await fetchCustomersMaster();
            } else {
                triggerToast("Failed to delete selected record(s). Check API route constraints.", 'error');
            }
        } catch (err) {
            triggerToast("Error deleting record(s): " + err.message, 'error');
        }
    };

    const handleAddCustomer = async (e) => {
        e.preventDefault();
        if (!custNameInput || !custEmailInput) return triggerToast("Customer Name & Email are required.", 'error');

        try {
            const res = await fetch('/api/customer/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    custName: custNameInput.trim(),
                    mobileNo: custMobileInput.trim(),
                    emailId: custEmailInput.trim(),
                    address1: custAddressInput.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                triggerToast("Customer Master added successfully!");
                setCustNameInput('');
                setCustMobileInput('');
                setCustEmailInput('');
                setCustAddressInput('');
                setShowAddModal(false);
                await fetchCustomersMaster();
            } else {
                triggerToast(data.message || "Failed to add customer.", 'error');
            }
        } catch (err) {
            triggerToast("Error adding customer: " + err.message, 'error');
        }
    };

    const handleOpenEditCustomer = (cust) => {
        setEditingCustomer(cust);
        setEditCustName(cust.custName || cust.CustName || cust.name || '');
        setEditCustMobile(cust.mobileNo || cust.MobileNo || '');
        setEditCustEmail(cust.emailId || cust.EmailId || '');
        setEditCustAddress(cust.address1 || cust.Address1 || '');
    };

    const handleSaveUpdateCustomer = async (e) => {
        e.preventDefault();
        if (!editCustName || !editCustEmail) return triggerToast("Customer Name & Email are required.", 'error');

        setIsUpdatingCustomer(true);
        try {
            const res = await fetch(`/api/customer/update/${editingCustomer.id || editingCustomer.Id || editingCustomer.custId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    custName: editCustName.trim(),
                    mobileNo: editCustMobile.trim(),
                    emailId: editCustEmail.trim(),
                    address1: editCustAddress.trim()
                })
            });

            const data = await res.json();
            if (res.ok) {
                triggerToast("Customer Record updated successfully!");
                setEditingCustomer(null);
                await fetchCustomersMaster();
            } else {
                triggerToast(data.message || "Failed to update customer.", 'error');
            }
        } catch (err) {
            triggerToast("Error updating customer: " + err.message, 'error');
        } finally {
            setIsUpdatingCustomer(false);
        }
    };

    const handleOpenEditBook = (book) => {
        setEditingBook(book);
        changeNavState({ bookPageMode: 'edit-book-page' });
    };

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccessMsg('');
        setAuthLoading(true);

        const endpoint = authMode === 'login' ? '/api/account/login' : '/api/account/register';
        const payload = authMode === 'login'
            ? { email: emailInput, password: passwordInput }
            : {
                fullName: fullNameInput,
                email: emailInput,
                password: passwordInput,
                confirmPassword: passwordInput,
                selectedRole: selectedRoleInput === 'Author' ? 1 : selectedRoleInput === 'Publisher' ? 2 : 3
            };

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (response.ok) {
                if (authMode === 'register') {
                    setAuthSuccessMsg('Registration successful! Please sign in now.');
                    setAuthMode('login');
                    setPasswordInput('');
                } else {
                    const assignedRole = data.roles && data.roles.length > 0 ? data.roles[0] : 'Reader';
                    localStorage.setItem('isExplicitLogin', 'true');
                    setUser({
                        isLoggedIn: true,
                        fullName: data.fullName || emailInput.split('@')[0],
                        email: emailInput,
                        role: assignedRole
                    });
                    setIsAuthOpen(false);
                    setEmailInput('');
                    setPasswordInput('');

                    triggerToast(`Welcome back, ${data.fullName || 'User'}!`);
                }
            } else {
                setAuthError(Array.isArray(data) ? data.map(err => err.description || err).join(', ') : (data.message || 'Authentication failed.'));
            }
        } catch (err) {
            setAuthError('Connection error.');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccessMsg('');

        if (newPasswordInput !== confirmPasswordInput) {
            setAuthError("New Password aur Confirm Password match nahi ho rahe hain.");
            return;
        }

        setAuthLoading(true);

        try {
            const response = await fetch('/api/account/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: forgotEmailInput,
                    newPassword: newPasswordInput,
                    confirmPassword: confirmPasswordInput
                })
            });

            const data = await response.json();
            if (response.ok) {
                triggerToast(data.message || "Password successfully reset ho gaya hai!");
                setAuthMode('login');
                setEmailInput(forgotEmailInput);
                setForgotEmailInput('');
                setNewPasswordInput('');
                setConfirmPasswordInput('');
            } else {
                setAuthError(data.message || "Failed to reset password.");
            }
        } catch (err) {
            setAuthError("Connection error: " + err.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        try { await fetch('/api/account/logout', { method: 'POST' }); } catch (e) { }
        localStorage.removeItem('isExplicitLogin');
        setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
        changeNavState({ activeTab: 'store' });
        setProfileDropdown(false);
        triggerToast("Signed out successfully!");
    };

    const getMasterRenderData = () => {
        switch (selectedMaster) {
            case 'items':
                return myAuthorBooks.map(b => ({
                    id: b.id || b.itemNo,
                    name: b.itemName,
                    desc: `Category: ${b.categoryCode} | ISBN: ${b.isbn} | Author: ${b.authorName} | Published By: ${b.publishedBy} | Language: ${b.language} | Price: ₹${b.price} | Pages: ${b.noOfPages}`,
                    isPublished: b.isPublished,
                    raw: b.raw || b
                }));
            case 'plans':
                return plansList.map(p => ({
                    id: p.id || p.Id,
                    name: p.planName || p.PlanName,
                    desc: `Price: ₹${p.priceIncludingTax || p.PriceIncludingTax} (Inc. ${p.taxPercentage || p.TaxPercentage}% Tax) | Validity: ${p.validityInDays || p.ValidityInDays} Days | Target: ${p.targetUser || p.TargetUser} | Max Books: ${(p.maxBookLimit === -1 || p.MaxBookLimit === -1) ? 'Unlimited' : (p.maxBookLimit || p.MaxBookLimit)}`,
                    raw: p
                }));
            case 'authors':
                return authorsList.map(a => ({
                    id: a.id,
                    name: a.name || a.authorName,
                    desc: a.desc,
                    raw: a.raw || a
                }));
            case 'categories':
                return categoriesList.map(c => ({
                    id: c.categoryCode || c.id,
                    name: c.categoryName || 'General',
                    desc: c.description || 'System Category',
                    raw: c.raw || c
                }));
            case 'languages':
                return languagesList.map(l => ({
                    id: l.id || l.code,
                    name: l.name || 'English',
                    desc: l.desc || 'System Language',
                    raw: l.raw || l
                }));
            case 'keywords':
                return keywordsList.map(k => ({
                    id: k.id || k.code,
                    name: k.name || k.keywordName || 'Homoeopathy',
                    desc: k.desc || k.description || 'Core Search Term',
                    raw: k.raw || k
                }));
            case 'customers':
                return customersList.map(c => ({
                    id: c.id || c.custId || c.CustId,
                    name: c.custName || c.CustName || 'Reader User',
                    mobileNo: c.mobileNo || c.MobileNo || '-',
                    emailId: c.emailId || c.EmailId || '-',
                    address: [c.address1 || c.Address1, c.address2 || c.Address2, c.landmark || c.Landmark].filter(Boolean).join(', ') || '-',
                    state: c.state || c.State || '-',
                    country: c.country || c.Country || 'India',
                    postalCode: c.postalCode || c.PostalCode || '-',
                    raw: c
                }));
            default:
                return [];
        }
    };

    const getMasterHeaderConfig = () => {
        switch (selectedMaster) {
            case 'plans':
                return { title: 'SUBSCRIPTION PLAN LIST', buttonText: 'Add New Plan' };
            case 'authors':
                return { title: 'AUTHOR LIST', buttonText: 'Add Author' };
            case 'categories':
                return { title: 'CATEGORIES LIST', buttonText: 'Add Category' };
            case 'languages':
                return { title: 'LANGUAGE LIST', buttonText: 'Add Language' };
            case 'keywords':
                return { title: 'KEYWORD LIST', buttonText: 'Add Keyword' };
            case 'customers':
                return { title: 'CUSTOMER LIST', buttonText: 'Add Customer' };
            case 'items':
            default:
                return { title: 'BOOK LIST', buttonText: 'Add Item' };
        }
    };

    const currentMasterData = getMasterRenderData();
    const currentHeaderConfig = getMasterHeaderConfig();

    const filteredStoreBooks = storeBooks.filter(b => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const itemName = b.itemName || b.ItemName || '';
        const author = b.author || b.Author || b.authorName || b.AuthorName || '';
        const categoryCode = b.categoryCode || b.CategoryCode || '';
        return itemName.toLowerCase().includes(q) || author.toLowerCase().includes(q) || categoryCode.toLowerCase().includes(q);
    });

    const isAllSelected = currentMasterData.length > 0 && currentMasterData.every(item => selectedMasterIds.includes(item.id));

    const AddBookFormComp = typeof window.AddBookForm !== 'undefined' ? window.AddBookForm : (typeof AddBookForm !== 'undefined' ? AddBookForm : null);
    const EditBookFormComp = typeof window.EditBookForm !== 'undefined' ? window.EditBookForm : (typeof EditBookForm !== 'undefined' ? EditBookForm : null);
    const AddAuthorFormComp = typeof window.AddAuthorForm !== 'undefined' ? window.AddAuthorForm : (typeof AddAuthorForm !== 'undefined' ? AddAuthorForm : null);
    const AddCategoryFormComp = typeof window.AddCategoryForm !== 'undefined' ? window.AddCategoryForm : (typeof AddCategoryForm !== 'undefined' ? AddCategoryForm : null);
    const EditCategoryFormComp = typeof window.EditCategoryForm !== 'undefined' ? window.EditCategoryForm : (typeof EditCategoryForm !== 'undefined' ? EditCategoryForm : null);
    const AddLanguageFormComp = typeof window.AddLanguageForm !== 'undefined' ? window.AddLanguageForm : (typeof AddLanguageForm !== 'undefined' ? AddLanguageForm : null);
    const EditLanguageFormComp = typeof window.EditLanguageForm !== 'undefined' ? window.EditLanguageForm : (typeof EditLanguageForm !== 'undefined' ? EditLanguageForm : null);
    const ExternalEditAuthorFormComp = typeof window.EditAuthorForm !== 'undefined' ? window.EditAuthorForm : (typeof EditAuthorForm !== 'undefined' ? EditAuthorForm : null);
    const AddPlanFormComp = typeof window.AddPlanForm !== 'undefined' ? window.AddPlanForm : (typeof AddPlanForm !== 'undefined' ? AddPlanForm : null);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 text-slate-800 w-full overflow-x-hidden relative">

            {toast.show && (
                <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-3 transition-all transform animate-bounce ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                    <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                    <span>{toast.message}</span>
                </div>
            )}

            <header className="bg-[#0d233a] text-white sticky top-0 z-50 shadow-md w-full">
                <div className="w-full px-4 md:px-8 py-2.5 flex items-center justify-between gap-2 md:gap-4">
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <div onClick={() => changeNavState({ activeTab: 'store' })} className="bg-white p-1 md:p-1.5 rounded shadow flex items-center gap-2 cursor-pointer">
                            <div className="w-7 h-7 md:w-8 md:h-8 rounded bg-[#be1e2d] flex items-center justify-center font-black text-white text-lg md:text-xl shrink-0">BJ</div>
                            <div className="text-left leading-none pr-1">
                                <div className="text-[#0d233a] font-extrabold text-xs md:text-sm uppercase">B. Jain Group</div>
                                <div className="text-[8px] md:text-[9px] text-[#be1e2d] font-bold uppercase tracking-widest">Publishers</div>
                            </div>
                        </div>
                    </div>
                    <div className="hidden sm:flex flex-1 max-w-3xl items-center rounded-md overflow-hidden bg-white text-slate-800">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search B. Jain publications by Item Name, category, or ISBN..."
                            className="w-full px-3 py-2 text-xs md:text-sm outline-none text-slate-800"
                        />
                        <button className="bg-[#be1e2d] text-white px-4 py-2 font-bold"><i className="fa-solid fa-magnifying-glass text-sm"></i></button>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                        {user.isLoggedIn ? (
                            <div className="relative">
                                <button onClick={() => setProfileDropdown(!profileDropdown)} className="flex items-center gap-2.5 p-1.5 rounded-lg bg-[#163554] border border-slate-600 hover:border-amber-400 transition text-left">
                                    <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center text-white font-extrabold text-xs shadow">
                                        {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                                    </div>
                                    <div className="hidden md:block">
                                        <div className="text-xs font-bold text-white">{user.fullName}</div>
                                        <div className="text-[9px] font-black uppercase text-red-400">{user.role} ACCOUNT</div>
                                    </div>
                                </button>
                                {profileDropdown && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 text-slate-800 rounded-lg shadow-2xl py-2 z-50 text-xs">
                                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 font-bold flex items-center gap-2">
                                            <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => openAuthModal('login')}
                                className="bg-[#be1e2d] hover:bg-red-700 text-white px-3.5 py-1.5 rounded-md font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5">
                                <i className="fa-regular fa-user"></i>
                                <span>Sign In / Register</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="bg-[#163554] text-xs px-4 md:px-8 py-1.5 border-t border-slate-700/50 flex items-center gap-6">
                    <button
                        onClick={() => changeNavState({ activeTab: 'store' })}
                        className={`font-bold flex items-center gap-1.5 ${activeTab === 'store' ? 'text-amber-400 border-b-2 border-amber-400 pb-0.5' : 'text-gray-200 hover:text-amber-400'}`}>
                        <i className="fa-solid fa-store"></i> Home
                    </button>

                    {user.isLoggedIn && !isAdmin && (
                        <button
                            onClick={() => window.location.href = '/Reader/Profile'}
                            className="font-bold flex items-center gap-1.5 text-gray-200 hover:text-amber-400 transition cursor-pointer">
                            <i className="fa-solid fa-user"></i> My Profile
                        </button>
                    )}

                    {isAdmin && (
                        <button
                            onClick={() => changeNavState({ activeTab: 'admin' })}
                            className={`font-bold flex items-center gap-1.5 ${activeTab === 'admin' ? 'text-red-400 border-b-2 border-red-400 pb-0.5' : 'text-gray-200 hover:text-red-400'}`}>
                            <i className="fa-solid fa-shield-halved"></i> Admin Profile
                        </button>
                    )}
                </div>
            </header>

            <div className="w-full px-4 md:px-8 py-6 flex-1 space-y-6">
                {activeTab === 'admin' && isAdmin && (
                    <div className="w-full space-y-6">
                        <div className="w-full bg-[#0d233a] text-white p-6 rounded-lg shadow border-l-8 border-red-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-black flex items-center gap-2">
                                    <i className="fa-solid fa-shield-halved text-red-500"></i> Admin Dashboard
                                </h1>
                                <p className="text-xs text-gray-300 mt-1">Manage users, books, approvals and platform settings in one place.</p>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setMasterDropdownOpen(!masterDropdownOpen)}
                                    className="bg-[#be1e2d] hover:bg-red-700 text-white font-black px-5 py-2.5 rounded shadow text-xs flex items-center gap-2 transition cursor-pointer">
                                    <i className="fa-solid fa-sliders"></i> Actions List <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </button>
                                {masterDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 text-slate-800 rounded-lg shadow-2xl py-2 z-50 text-xs divide-y">
                                        <div className="px-3 py-1.5 font-black text-slate-500 uppercase text-[10px] bg-slate-50">Select System List</div>
                                        {[
                                            { key: 'items', label: 'Items Master ', icon: 'fa-box' },
                                            { key: 'plans', label: 'Plans Master ', icon: 'fa-credit-card' },
                                            { key: 'authors', label: 'Authors ', icon: 'fa-user-pen' },
                                            { key: 'categories', label: 'Categories ', icon: 'fa-layer-group' },
                                            { key: 'languages', label: 'Languages ', icon: 'fa-language' },
                                            { key: 'keywords', label: 'Keywords ', icon: 'fa-key' },
                                            { key: 'customers', label: 'Customers ', icon: 'fa-users' }
                                        ].map(m => (
                                            <button
                                                key={m.key}
                                                onClick={() => {
                                                    changeNavState({
                                                        selectedMaster: m.key,
                                                        bookPageMode: 'list',
                                                        authorPageMode: 'list',
                                                        categoryPageMode: 'list',
                                                        languagePageMode: 'list',
                                                        planPageMode: 'list'
                                                    });
                                                    setMasterDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center justify-between font-bold cursor-pointer ${selectedMaster === m.key ? 'text-[#be1e2d] bg-red-50/50' : 'text-slate-700'}`}>
                                                <span className="flex items-center gap-2"><i className={`fa-solid ${m.icon} text-slate-400`}></i> {m.label}</span>
                                                {selectedMaster === m.key && <i className="fa-solid fa-check text-red-600"></i>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="w-full bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-black uppercase text-slate-500 flex items-center gap-1">
                                    <i className="fa-solid fa-list-check text-[#be1e2d]"></i> {currentHeaderConfig.title}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (selectedMaster === 'items') {
                                            changeNavState({ bookPageMode: 'add-book-page' });
                                        } else if (selectedMaster === 'authors') {
                                            changeNavState({ authorPageMode: 'add-author-page' });
                                        } else if (selectedMaster === 'categories') {
                                            changeNavState({ categoryPageMode: 'add-category-page' });
                                        } else if (selectedMaster === 'languages') {
                                            changeNavState({ languagePageMode: 'add-language-page' });
                                        } else if (selectedMaster === 'plans') {
                                            changeNavState({ planPageMode: 'add-plan-page' });
                                        } else {
                                            setShowAddModal(true);
                                        }
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer">
                                    <i className="fa-solid fa-plus"></i> {currentHeaderConfig.buttonText}
                                </button>

                                {selectedMasterIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDeleteConfirmModal({
                                                show: true,
                                                id: null,
                                                ids: selectedMasterIds,
                                                title: `${selectedMasterIds.length} Selected Record(s)`,
                                                type: selectedMaster
                                            });
                                        }}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer animate-pulse">
                                        <i className="fa-solid fa-trash-can"></i> Delete Selected ({selectedMasterIds.length})
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <label className="font-bold text-slate-600">Rows Count:</label>
                                    <select
                                        value={rowsPerPage}
                                        onChange={e => setRowsPerPage(Number(e.target.value))}
                                        className="border rounded px-2 py-1 font-bold bg-gray-50 outline-none">
                                        <option value={5}>5 Rows</option>
                                        <option value={10}>10 Rows</option>
                                        <option value={20}>20 Rows</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 border-l pl-4">
                                    <span className="font-bold text-slate-600">Toggle Columns:</span>
                                    <button onClick={() => toggleColumn('col1')} className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${visibleColumns.col1 ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500 line-through'}`}>ID/Code</button>
                                    <button onClick={() => toggleColumn('col2')} className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${visibleColumns.col2 ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500 line-through'}`}>Name</button>
                                    <button onClick={() => toggleColumn('col3')} className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${visibleColumns.col3 ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500 line-through'}`}>Details</button>
                                </div>
                            </div>
                        </div>

                        {selectedMaster === 'items' && bookPageMode === 'add-book-page' ? (
                            AddBookFormComp ? (
                                <AddBookFormComp
                                    categoriesList={categoriesList}
                                    languagesList={languagesList}
                                    authorsList={authorsList}
                                    setShowAddCategoryModal={setShowAddCategoryModal}
                                    setShowAddLanguageModal={setShowAddLanguageModal}
                                    setShowAddAuthorModal={setShowAddAuthorModal}
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        fetchAuthorBooks();
                                        fetchStoreBooks();
                                        window.history.back();
                                    }}
                                    onCancel={() => window.history.back()}
                                />
                            ) : null
                        ) : selectedMaster === 'items' && bookPageMode === 'edit-book-page' ? (
                            EditBookFormComp ? (
                                <EditBookFormComp
                                    editingBook={editingBook}
                                    languagesList={languagesList}
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        setEditingBook(null);
                                        fetchAuthorBooks();
                                        fetchStoreBooks();
                                        window.history.back();
                                    }}
                                    onCancel={() => {
                                        setEditingBook(null);
                                        window.history.back();
                                    }}
                                />
                            ) : null
                        ) : selectedMaster === 'plans' && planPageMode === 'add-plan-page' ? (
                            AddPlanFormComp ? (
                                <AddPlanFormComp
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        fetchPlansMaster();
                                        window.history.back();
                                    }}
                                    onCancel={() => window.history.back()}
                                />
                            ) : null
                        ) : selectedMaster === 'categories' && categoryPageMode === 'add-category-page' ? (
                            AddCategoryFormComp ? (
                                <AddCategoryFormComp
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        fetchCategories();
                                        window.history.back();
                                    }}
                                    onCancel={() => window.history.back()}
                                />
                            ) : null
                        ) : selectedMaster === 'categories' && categoryPageMode === 'edit-category-page' ? (
                            EditCategoryFormComp ? (
                                <EditCategoryFormComp
                                    editingCategory={editingCategory}
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        setEditingCategory(null);
                                        fetchCategories();
                                        window.history.back();
                                    }}
                                    onCancel={() => {
                                        setEditingCategory(null);
                                        window.history.back();
                                    }}
                                />
                            ) : null
                        ) : selectedMaster === 'languages' && languagePageMode === 'add-language-page' ? (
                            AddLanguageFormComp ? (
                                <AddLanguageFormComp
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        fetchLanguagesMaster();
                                        window.history.back();
                                    }}
                                    onCancel={() => window.history.back()}
                                />
                            ) : null
                        ) : selectedMaster === 'languages' && languagePageMode === 'edit-language-page' ? (
                            EditLanguageFormComp ? (
                                <EditLanguageFormComp
                                    editingLanguage={editingLanguage}
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        setEditingLanguage(null);
                                        fetchLanguagesMaster();
                                        window.history.back();
                                    }}
                                    onCancel={() => {
                                        setEditingLanguage(null);
                                        window.history.back();
                                    }}
                                />
                            ) : null
                        ) : selectedMaster === 'authors' && authorPageMode === 'add-author-page' ? (
                            AddAuthorFormComp ? (
                                <AddAuthorFormComp
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        fetchAuthorsMaster();
                                        window.history.back();
                                    }}
                                    onCancel={() => window.history.back()}
                                />
                            ) : null
                        ) : selectedMaster === 'authors' && authorPageMode === 'edit-author-page' ? (
                            ExternalEditAuthorFormComp ? (
                                <ExternalEditAuthorFormComp
                                    editingAuthor={editingAuthor}
                                    onSuccess={(msg) => {
                                        triggerToast(msg);
                                        setEditingAuthor(null);
                                        fetchAuthorsMaster();
                                        window.history.back();
                                    }}
                                    onCancel={() => {
                                        setEditingAuthor(null);
                                        window.history.back();
                                    }}
                                />
                            ) : null
                        ) : (
                            <div className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <h3 className="text-base font-bold text-[#0d233a] border-b pb-2 capitalize flex items-center justify-between">
                                    <span><i className="fa-solid fa-list text-[#be1e2d] me-2"></i>{selectedMaster} List View ({currentMasterData.length})</span>
                                    <span className="text-xs text-slate-500">Showing Top {rowsPerPage} Rows</span>
                                </h3>

                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left text-slate-800 text-xs">
                                        <thead className="bg-slate-100 text-slate-600 uppercase border-b font-bold">
                                            <tr>
                                                <th className="p-3 w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isAllSelected}
                                                        onChange={(e) => handleSelectAllMasterRows(e, currentMasterData.slice(0, rowsPerPage))}
                                                        className="w-4 h-4 cursor-pointer accent-[#be1e2d]"
                                                    />
                                                </th>

                                                {visibleColumns.col1 && (
                                                    <th className="p-3">
                                                        {selectedMaster === 'authors' ? 'Author ID' :
                                                            selectedMaster === 'plans' ? 'Plan ID' :
                                                                selectedMaster === 'categories' ? 'Category Code' :
                                                                    selectedMaster === 'languages' ? 'Language Code' :
                                                                        selectedMaster === 'keywords' ? 'Keyword Code' :
                                                                            selectedMaster === 'customers' ? 'Customer ID' :
                                                                                'Book Code'}
                                                    </th>
                                                )}

                                                {visibleColumns.col2 && (
                                                    <th className="p-3">
                                                        {selectedMaster === 'authors' ? 'Author Name' :
                                                            selectedMaster === 'plans' ? 'Plan Name' :
                                                                selectedMaster === 'categories' ? 'Category Name' :
                                                                    selectedMaster === 'languages' ? 'Language Name' :
                                                                        selectedMaster === 'keywords' ? 'Keyword Name' :
                                                                            selectedMaster === 'customers' ? 'Customer Name' :
                                                                                'Book Name'}
                                                    </th>
                                                )}

                                                {selectedMaster === 'customers' ? (
                                                    <>
                                                        <th className="p-3">Mobile Number</th>
                                                        <th className="p-3">Email ID</th>
                                                        <th className="p-3">Address</th>
                                                        <th className="p-3">State</th>
                                                        <th className="p-3">Country</th>
                                                        <th className="p-3">Postal / Pincode</th>
                                                    </>
                                                ) : selectedMaster === 'items' ? (
                                                    <>
                                                        <th className="p-3">Category</th>
                                                        <th className="p-3">ISBN</th>
                                                        <th className="p-3">Author Name</th>
                                                        <th className="p-3">Published By</th>
                                                        <th className="p-3">Language</th>
                                                        <th className="p-3">Price (₹)</th>
                                                        <th className="p-3">Pages</th>
                                                    </>
                                                ) : (
                                                    visibleColumns.col3 && (
                                                        <th className="p-3">
                                                            {selectedMaster === 'authors' ? 'Created Date' : 'Description / Details'}
                                                        </th>
                                                    )
                                                )}

                                                <th className="p-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {currentMasterData.slice(0, rowsPerPage).map((item, index) => {
                                                const isChecked = selectedMasterIds.includes(item.id);

                                                return (
                                                    <tr
                                                        key={index}
                                                        onClick={() => {
                                                            if (selectedMaster === 'items' && item.raw) handleOpenEditBook(item.raw);
                                                            else if (selectedMaster === 'plans' && item.raw) handleOpenEditPlan(item.raw);
                                                            else if (selectedMaster === 'categories' && item.raw) handleOpenEditCategoryPage(item.raw);
                                                            else if (selectedMaster === 'languages' && item.raw) handleOpenEditLanguagePage(item.raw);
                                                            else if (selectedMaster === 'keywords' && item.raw) handleOpenEditKeyword(item.raw);
                                                            else if (selectedMaster === 'authors' && item.raw) handleOpenEditAuthorPage(item.raw);
                                                            else if (selectedMaster === 'customers' && item.raw) handleOpenEditCustomer(item.raw);
                                                        }}
                                                        className={`hover:bg-blue-50/70 cursor-pointer transition ${isChecked ? 'bg-amber-50/60' : ''}`}>

                                                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => handleSelectSingleMasterRow(item.id)}
                                                                className="w-4 h-4 cursor-pointer accent-[#be1e2d]"
                                                            />
                                                        </td>

                                                        {visibleColumns.col1 && (
                                                            <td className="p-3 font-mono font-bold text-indigo-600">{item.id}</td>
                                                        )}
                                                        {visibleColumns.col2 && (
                                                            <td className="p-3 font-bold text-slate-900">{item.name}</td>
                                                        )}

                                                        {selectedMaster === 'customers' ? (
                                                            <>
                                                                <td className="p-3 text-slate-700">{item.mobileNo}</td>
                                                                <td className="p-3 text-slate-700">{item.emailId}</td>
                                                                <td className="p-3 text-slate-700 max-w-xs truncate" title={item.address}>{item.address}</td>
                                                                <td className="p-3 text-slate-700">{item.state}</td>
                                                                <td className="p-3 text-slate-700">{item.country}</td>
                                                                <td className="p-3 font-mono text-slate-700">{item.postalCode}</td>
                                                            </>
                                                        ) : selectedMaster === 'items' && item.raw ? (
                                                                <><td className="p-3 font-bold text-amber-700">
                                                                    {(() => {
                                                                        // Direct API Response se categoryName read karo
                                                                        if (item.raw.categoryName) return item.raw.categoryName;

                                                                        // Dynamic Fallback: categoriesList state se match karo
                                                                        const catCode = item.raw.categoryCode || item.raw.CategoryCode;
                                                                        const foundCat = categoriesList.find(c =>
                                                                            String(c.categoryCode).toLowerCase() === String(catCode).toLowerCase() ||
                                                                            String(c.id).toLowerCase() === String(catCode).toLowerCase()
                                                                        );
                                                                        return foundCat ? foundCat.categoryName : (catCode || 'General');
                                                                    })()}
                                                                </td>
                                                                <td className="p-3 font-mono text-slate-600">
                                                                    {item.raw.isbn || item.raw.ISBN || item.raw.Isbn || 'N/A'}
                                                                </td>
                                                                {/* STRICT AUTHOR NAME RENDER */}
                                                                <td className="p-3 font-bold text-blue-700">
                                                                    {item.raw.extractedAuthorName || item.raw.authorName || item.raw.AuthorName || item.raw.author || item.raw.Author || 'Dr. Samuel Hahnemann'}
                                                                </td>
                                                                {/* PUBLISHED BY / CREATED BY RENDER */}
                                                                <td className="p-3 font-bold text-slate-700">
                                                                    {item.raw.extractedPublisherName || item.raw.createdBy || item.raw.CreatedBy || item.raw.publisherName || item.raw.PublisherName || 'System Administrator'}
                                                                </td>
                                                                <td className="p-3 font-medium text-slate-700">
                                                                    {item.raw.language || item.raw.Language || 'English'}
                                                                </td>
                                                                <td className="p-3 font-black text-emerald-700">
                                                                    ₹{item.raw.price !== undefined ? item.raw.price : item.raw.Price}
                                                                </td>
                                                                <td className="p-3 font-semibold text-slate-600">
                                                                    {item.raw.noOfPages || item.raw.NoOfPages || 1}
                                                                </td>
                                                            </>
                                                        ) : (
                                                            visibleColumns.col3 && (
                                                                <td className="p-3 text-slate-600">{item.desc}</td>
                                                            )
                                                        )}

                                                        <td className="p-3 text-right space-x-2" onClick={e => e.stopPropagation()}>
                                                            {selectedMaster === 'items' && item.raw && (
                                                                <>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenPdfModal(item.raw); }} className="text-purple-600 hover:underline font-bold me-2 cursor-pointer">
                                                                        <i className="fa-solid fa-file-pdf text-red-600 me-1"></i> View PDF
                                                                    </button>
                                                                    {!item.isPublished && isAdmin && (
                                                                        <button onClick={(e) => { e.stopPropagation(); handleApproveBook(item.raw, item.name); }} className="text-emerald-600 hover:underline font-bold me-2 cursor-pointer">
                                                                            <i className="fa-solid fa-check me-1"></i> Approve
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}

                                                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmModal({ show: true, id: item.id, ids: [], title: item.name, type: selectedMaster }); }} className="text-[#be1e2d] hover:underline font-bold cursor-pointer">
                                                                <i className="fa-solid fa-trash me-1"></i> Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'store' && (
                    <main className="w-full space-y-6">
                        <div className="bg-gradient-to-r from-[#0d233a] to-[#163554] text-white p-6 rounded-lg shadow border-l-8 border-[#be1e2d]">
                            <h1 className="text-2xl font-black">B. Jain Group eBook Store</h1>
                            <p className="text-xs text-gray-300">Browse, buy and read eBooks in a secure, protected reader.</p>
                        </div>

                        {loadingBooks ? (
                            <p className="text-center text-xs py-8">Loading Publications...</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full">
                                {filteredStoreBooks.map(b => (
                                    <div key={b.id || b.Id} className="bg-white border rounded-lg p-4 flex gap-4 hover:shadow-lg transition">
                                        <div className="w-28 h-40 bg-gray-100 rounded border overflow-hidden shrink-0">
                                            <img src={b.image || b.Image || '/images/default-cover.png'} alt={b.itemName || b.ItemName} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 flex flex-col justify-between text-xs">
                                            <div>
                                                <span className="bg-amber-100 text-amber-900 text-[9px] font-bold px-2 py-0.5 rounded border border-amber-300 uppercase me-1">
                                                    {b.categoryCode || b.CategoryCode || 'HOMEO'}
                                                </span>
                                                <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mt-1">{b.itemName || b.ItemName}</h3>
                                                <p className="text-slate-500 text-[11px]">by {getBookAuthorName(b)}</p>
                                            </div>

                                            <div className="space-y-2 pt-2 border-t">
                                                <div className="font-black text-slate-900 text-base">₹{b.price !== undefined ? b.price : b.Price}</div>
                                                <button
                                                    onClick={() => handleReadAccess(b)}
                                                    className="w-full bg-[#0d233a] hover:bg-[#be1e2d] text-white font-bold py-1.5 rounded text-xs shadow flex items-center justify-center gap-1 cursor-pointer">
                                                    <i className="fa-solid fa-book-open"></i> Read Access
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </main>
                )}
            </div>

            {/* INTEGRATED SECURE CANVASES DRM PDF VIEWER MODAL */}
            {selectedBookForDrm && (
                <SecurePdfViewerModal
                    book={selectedBookForDrm}
                    user={user}
                    onClose={handleClosePdfModal}
                />
            )}

            {/* AUTHENTICATION MODAL (SIGN IN / REGISTER) */}
            {isAuthOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-[#be1e2d]">
                        <button onClick={() => setIsAuthOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-slate-800 cursor-pointer">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>

                        <div className="text-center space-y-1">
                            <h3 className="text-lg font-bold text-[#0d233a]">
                                {authMode === 'login' ? 'Sign in to B. Jain Portal' : authMode === 'register' ? 'Register B. Jain Account' : 'Reset Account Password'}
                            </h3>
                            <p className="text-xs text-slate-500">
                                {authMode === 'login' ? 'Enter your credentials to access your account' : authMode === 'register' ? 'Fill details below to create your account' : 'Enter registered email & new password to reset'}
                            </p>
                        </div>

                        {authSuccessMsg && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded text-xs text-center font-bold">
                                {authSuccessMsg}
                            </div>
                        )}
                        {authError && (
                            <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded text-xs text-center font-bold">
                                {authError}
                            </div>
                        )}

                        {authMode === 'forgot' ? (
                            <form onSubmit={handleForgotPasswordSubmit} className="space-y-3 text-xs">
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Registered Email Address *</label>
                                    <input
                                        type="email"
                                        required
                                        value={forgotEmailInput}
                                        onChange={e => setForgotEmailInput(e.target.value)}
                                        placeholder="admin@booksystem.com"
                                        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">New Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPasswordInput}
                                        onChange={e => setNewPasswordInput(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Confirm New Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPasswordInput}
                                        onChange={e => setConfirmPasswordInput(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full bg-[#be1e2d] hover:bg-red-700 text-white font-bold py-2.5 rounded text-xs shadow transition cursor-pointer">
                                    {authLoading ? 'Updating Password...' : 'Reset Password'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
                                {authMode === 'register' && (
                                    <div>
                                        <label className="font-bold text-slate-700 block mb-1">Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={fullNameInput}
                                            onChange={e => setFullNameInput(e.target.value)}
                                            placeholder="e.g. Dr. Samuel Hahnemann"
                                            className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Email Address *</label>
                                    <input
                                        type="email"
                                        required
                                        value={emailInput}
                                        onChange={e => setEmailInput(e.target.value)}
                                        placeholder="admin@booksystem.com"
                                        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-slate-700 block mb-1">Password *</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordInput}
                                        onChange={e => setPasswordInput(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-[#0d233a]"
                                    />
                                </div>
                                {authMode === 'register' && (
                                    <div>
                                        <label className="font-bold text-slate-700 block mb-1">Select Account Role *</label>
                                        <select
                                            value={selectedRoleInput}
                                            onChange={e => setSelectedRoleInput(e.target.value)}
                                            className="w-full border border-gray-300 rounded px-3 py-2 font-bold text-[#0d233a] bg-gray-50 outline-none">
                                            <option value="Author">Author</option>
                                         
                                            <option value="Reader">Reader</option>
                                        </select>
                                    </div>
                                )}
                                <button
                                    type="submit"
                                    disabled={authLoading}
                                    className="w-full bg-[#0d233a] hover:bg-[#163554] text-white font-bold py-2.5 rounded text-xs shadow transition cursor-pointer">
                                    {authLoading ? 'Verifying...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                                </button>
                            </form>
                        )}

                        <div className="pt-3 border-t text-center text-xs text-slate-600 space-y-2">
                            {authMode === 'login' && (
                                <>
                                    <div>
                                        Don't have an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => { setAuthMode('register'); setAuthError(''); setAuthSuccessMsg(''); }}
                                            className="text-[#be1e2d] font-bold hover:underline ms-1 cursor-pointer">
                                            Register Here
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => { setAuthMode('forgot'); setAuthError(''); setAuthSuccessMsg(''); }}
                                            className="text-slate-600 hover:text-[#0d233a] font-bold hover:underline cursor-pointer">
                                            <i className="fa-solid fa-key me-1 text-amber-600"></i> Forgot Password?
                                        </button>
                                    </div>
                                </>
                            )}

                            {(authMode === 'register' || authMode === 'forgot') && (
                                <div>
                                    Already have an account?{' '}
                                    <button
                                        type="button"
                                        onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccessMsg(''); }}
                                        className="text-[#0d233a] font-bold hover:underline ms-1 cursor-pointer">
                                        Sign In Here
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {deleteConfirmModal.show && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-red-600">
                        <div className="flex items-center gap-3 text-red-600 border-b pb-3">
                            <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                            <h3 className="font-bold text-[#0d233a] text-base">Confirm Deletion</h3>
                        </div>
                        <p className="text-xs text-slate-600">
                            Are you sure you want to delete <strong className="text-[#0d233a]">"{deleteConfirmModal.title}"</strong>? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' })}
                                className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200 text-slate-700 font-bold text-xs cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteSelectedMaster}
                                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow cursor-pointer">
                                Delete Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const containerElement = document.getElementById('root') || document.getElementById('main-app-container');
if (containerElement) {
    const root = ReactDOM.createRoot(containerElement);
    root.render(<App />);
}