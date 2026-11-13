const { useState, useEffect, useCallback, useRef } = React;

(function () {
    const originalFetch = window.fetch;
    window.fetch = async function () {
        const response = await originalFetch.apply(this, arguments);
        if (response.status === 401) {
            const clone = response.clone();
            try {
                const data = await clone.json();
                if (data.error === "SessionExpired") {
                    alert(data.message || "Your Account is Login in Another Device.");
                    localStorage.removeItem('isExplicitLogin');
                    window.location.reload();
                }
            } catch (e) { }
        }
        return response;
    };
})();


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
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

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
    const [vendorsList, setVendorsList] = useState([]);
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

    
    const saveReadingProgressToBackend = (bookObj, pageNum = 1) => {
        if (!bookObj) return;

        const targetBookId = bookObj.id || bookObj.Id || bookObj.bookId || bookObj.itemNo;
        const totalPg = bookObj.noOfPages || bookObj.NoOfPages || 100;

        if (!targetBookId) return;

        fetch('/Reader/api/save-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookId: targetBookId,
                lastReadPage: pageNum,
                totalPages: totalPg
            })
        })
            .then(res => res.ok ? res.json() : fetch('/api/reader/save-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: targetBookId,
                    lastReadPage: pageNum,
                    totalPages: totalPg
                })
            }))
            .catch(err => console.warn("Auto save progress skipped:", err));
    };

    
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
        saveReadingProgressToBackend(bookObj, 1);
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
                    const rawName = c.categoryName || c.CategoryName || c.name || rawCode;
                    return {
                        id: rawCode,
                        categoryCode: rawCode,
                        categoryName: rawName,
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
    const fetchVendorsMaster = async () => {
        try {
            const res = await fetch('/api/vendor/get-all');
            if (res.ok) {
                const data = await res.json();
                setVendorsList(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error("Fetch vendors error:", e); }
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

    const getBookAuthorName = (b) => {
        if (!b) return 'Dr. Samuel Hahnemann';
        const possibleAuthor = b.authorName || b.AuthorName || b.author || b.Author || b.author_name || b.Author_Name;

        if (possibleAuthor && possibleAuthor !== 'System Administrator' && possibleAuthor.trim() !== '') {
            return possibleAuthor;
        }

        const authorId = b.authorId || b.AuthorId || b.authorCode || b.AuthorCode;
        if (authorId && authorsList.length > 0) {
            const foundAuthor = authorsList.find(a => String(a.id) === String(authorId) || String(a.name) === String(authorId));
            if (foundAuthor) return foundAuthor.name;
        }

        return possibleAuthor || 'Dr. Samuel Hahnemann';
    };
    const getBookCategoryName = (b) => {
        if (!b) return 'General';

        
        const directName = b.categoryName || b.CategoryName || b.category_name || b.Category_Name;
        if (directName && directName.trim() !== '') {
            return directName;
        }

        
        const catCode = b.categoryCode || b.CategoryCode || b.category || b.Category;
        if (catCode && categoriesList.length > 0) {
            const foundCategory = categoriesList.find(c =>
                String(c.id).toLowerCase() === String(catCode).toLowerCase() ||
                String(c.categoryCode).toLowerCase() === String(catCode).toLowerCase()
            );
            if (foundCategory && foundCategory.categoryName) {
                return foundCategory.categoryName;
            }
        }

        return catCode || 'General';
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
                    const actualCategory = getBookCategoryName(b); 

                    return {
                        id: b.id || b.Id || b.itemNo || b.ItemNo || 'N/A',
                        itemNo: b.itemNo || b.ItemNo || b.id || 'N/A',
                        itemName: b.itemName || b.ItemName || b.title || 'Untitled Book',
                        categoryCode: actualCategory, 
                        isbn: b.isbn || b.ISBN || b.Isbn || 'N/A',
                        authorName: actualAuthor,
                        publishedBy: publisher,
                        vendorName: b.vendorName || b.VendorName || 'In-House (B. Jain)',
                        language: b.language || b.Language || 'English',
                        price: b.price !== undefined ? b.price : (b.Price !== undefined ? b.Price : 0),
                        noOfPages: b.noOfPages || b.NoOfPages || 1,
                        isPublished: b.isPublished !== undefined ?b.isPublished : (b.IsPublished !== undefined ? b.IsPublished : false),
                        isPublished: b.isPublished !== undefined ? b.isPublished : (b.IsPublished !== undefined ? b.IsPublished : false),
                        raw: {
                            ...b,
                            extractedAuthorName: actualAuthor,
                            extractedPublisherName: publisher,
                            extractedCategoryName: actualCategory
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

        saveReadingProgressToBackend(bookObj, 1);
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
        fetchVendorsMaster();

        const urlParams = new URLSearchParams(window.location.search);
        const resumeBookId = urlParams.get('readBookId');
        const resumePage = urlParams.get('page');

        if (resumeBookId) {
            fetch('/api/reader/catalog/all-books')
                .then(res => res.ok ? res.json() : [])
                .then(allBooks => {
                    const targetBook = allBooks.find(b =>
                        String(b.id) === String(resumeBookId) ||
                        String(b.Id) === String(resumeBookId) ||
                        String(b.itemNo) === String(resumeBookId) ||
                        String(b.bookId) === String(resumeBookId)
                    );

                    if (targetBook) {
                        targetBook.initialPage = resumePage ? parseInt(resumePage, 10) : 1;
                        setSelectedBookForDrm(targetBook);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                })
                .catch(err => console.warn("Failed to auto resume book:", err));
        }

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
        // 1. Identify Target Identifiers
        let targetItems = [];
        if (deleteConfirmModal.id) {
            targetItems = [deleteConfirmModal.id];
        } else if (deleteConfirmModal.ids && deleteConfirmModal.ids.length > 0) {
            targetItems = deleteConfirmModal.ids;
        }

        if (!targetItems.length) {
            setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' });
            setSelectedMasterIds([]);
            return;
        }

        let successCount = 0;

        for (const targetVal of targetItems) {
            if (!targetVal) continue;

            const cleanVal = String(targetVal).trim();
            const encodedVal = encodeURIComponent(cleanVal);
            let endpoints = [];

            if (selectedMaster === 'items') {
                endpoints = [
                    `/api/author/book/delete-book/${encodedVal}`,
                    `/api/author/book/delete/${encodedVal}`,
                    `/api/author/Book/delete-book/${encodedVal}`
                ];
            } else if (selectedMaster === 'plans') {
                endpoints = [`/api/plan/delete/${encodedVal}`];
            } else if (selectedMaster === 'authors') {
                endpoints = [`/api/authors/delete/${encodedVal}`];
            } else if (selectedMaster === 'categories') {
                endpoints = [`/api/category/delete/${encodedVal}`];
            } else if (selectedMaster === 'languages') {
                endpoints = [`/api/language/delete/${encodedVal}`];
            } else if (selectedMaster === 'keywords') {
                endpoints = [`/api/keyword/delete/${encodedVal}`];
            } else if (selectedMaster === 'customers') {
                endpoints = [`/api/admin/admin/delete-customer/${encodedVal}`];
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
                    console.warn(`Delete request error for ${url}:`, e);
                }
            }

            if (deletedSuccessfully) {
                successCount++;
            }
        }

        // ALWAYS FORCE RESET ALL MODAL & SELECTION STATES
        setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' });
        setSelectedMasterIds([]);

        if (successCount > 0) {
            triggerToast(`${successCount} record(s) deleted successfully!`);

            if (selectedMaster === 'items') {
                await fetchAuthorBooks();
                await fetchStoreBooks();
            } else if (selectedMaster === 'plans') await fetchPlansMaster();
            else if (selectedMaster === 'authors') await fetchAuthorsMaster();
            else if (selectedMaster === 'categories') await fetchCategories();
            else if (selectedMaster === 'languages') await fetchLanguagesMaster();
            else if (selectedMaster === 'keywords') await fetchKeywordsMaster();
            else if (selectedMaster === 'customers') await fetchCustomersMaster();
        } else {
            triggerToast("Failed to delete selected record(s). Check API route constraints.", 'error');
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
                    if (data.sessionToken) {
                        localStorage.setItem('sessionToken', data.sessionToken);
                    }
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
                return myAuthorBooks.map(b => {
                    // Strict GUID / ItemNo Mapping (Never pass Book Name as ID)
                    const recordId = b.id || b.Id || (b.raw ? (b.raw.id || b.raw.Id || b.raw.itemNo) : b.itemNo);
                    const recordName = b.itemName || (b.raw ? b.raw.itemName : 'Book');

                    return {
                        id: recordId,
                        name: recordName,
                        desc: `Category: ${b.categoryCode} | ISBN: ${b.isbn} | Author: ${b.authorName} | Published By: ${b.publishedBy} | Language: ${b.language} | Price: ₹${b.price} | Pages: ${b.noOfPages}`,
                        isPublished: b.isPublished,
                        raw: b.raw || b
                    };
                });
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
            case 'vendors':
                return { title: 'VENDOR MASTER DIRECTORY', buttonText: 'Add Vendor' };
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
    const VendorMasterComp = typeof window.VendorMaster !== 'undefined' ? window.VendorMaster : (typeof VendorMaster !== 'undefined' ? VendorMaster : null);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 text-slate-800 w-full overflow-x-hidden relative">

            {toast.show && (
                <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-3 transition-all transform animate-bounce ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                    <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                    <span>{toast.message}</span>
                </div>
            )}

            
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm w-full">
                <div className="w-full px-4 md:px-8 py-3 flex items-center justify-between gap-4">

                    <div onClick={() => changeNavState({ activeTab: 'store' })} className="cursor-pointer hover:opacity-90 transition">
                        <img
                            src="/images/Screenshot 2026-11-05 104704.png"
                            alt="B. Jain Logo"
                            className="h-9 md:h-11 object-contain rounded bg-white px-2 py-1 shadow"
                        />
                    </div>

                    {/* SEARCH BAR */}
                    <div className="hidden md:flex flex-1 max-w-xl items-center rounded-full border border-gray-300 bg-slate-50 px-3 py-1.5 focus-within:border-red-500 focus-within:bg-white transition">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search publications..."
                            className="w-full px-2 text-xs md:text-sm bg-transparent outline-none text-slate-800"
                        />
                        <button className="text-slate-500 hover:text-red-600 px-2 font-bold"><i className="fa-solid fa-magnifying-glass text-sm"></i></button>
                    </div>

                    {/* AUTH / USER PROFILE */}
                    <div className="flex items-center gap-4 text-xs shrink-0">
                        {user.isLoggedIn ? (
                            <div className="relative">
                                <button onClick={() => setProfileDropdown(!profileDropdown)} className="flex items-center gap-2 p-1.5 rounded-lg border border-gray-300 hover:border-red-500 transition text-left">
                                    <div className="w-8 h-8 rounded-full bg-[#e31b23] flex items-center justify-center text-white font-extrabold text-xs shadow">
                                        {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                                    </div>
                                    <div className="hidden md:block">
                                        <div className="text-xs font-bold text-slate-800">{user.fullName}</div>
                                        <div className="text-[9px] font-black uppercase text-red-600">{user.role} ACCOUNT</div>
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
                                className="bg-[#e31b23] hover:bg-red-700 text-white px-4 py-2 rounded-full font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5">
                                <i className="fa-regular fa-user"></i>
                                <span>Sign In / Register</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* SUB NAV BAR */}
                <div className="bg-slate-900 text-xs px-4 md:px-8 py-2 border-t border-slate-800 flex items-center gap-6">
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
                        <div className="w-full bg-slate-900 text-white p-6 rounded-lg shadow border-l-8 border-red-600 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-black flex items-center gap-2">
                                    <i className="fa-solid fa-shield-halved text-red-500"></i> Admin Dashboard
                                </h1>
                                <p className="text-xs text-gray-300 mt-1">Manage users, books, approvals and platform settings in one place.</p>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setMasterDropdownOpen(!masterDropdownOpen)}
                                    className="bg-[#e31b23] hover:bg-red-700 text-white font-black px-5 py-2.5 rounded shadow text-xs flex items-center gap-2 transition cursor-pointer">
                                    <i className="fa-solid fa-sliders"></i> Actions List <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </button>
                                {masterDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 text-slate-800 rounded-lg shadow-2xl py-2 z-50 text-xs divide-y">
                                        <div className="px-3 py-1.5 font-black text-slate-500 uppercase text-[10px] bg-slate-50">Select System List</div>
                                        {[
                                            { key: 'items', label: 'Items Master ', icon: 'fa-box' },
                                            { key: 'plans', label: 'Plans Master ', icon: 'fa-credit-card' },
                                            { key: 'bundles', label: 'Bundle Master ', icon: 'fa-layer-group' },
                                            { key: 'authors', label: 'Authors ', icon: 'fa-user-pen' },
                                            { key: 'categories', label: 'Categories ', icon: 'fa-layer-group' },
                                            { key: 'languages', label: 'Languages ', icon: 'fa-language' },
                                            { key: 'keywords', label: 'Keywords ', icon: 'fa-key' },
                                            { key: 'customers', label: 'Customers ', icon: 'fa-users' },
                                            { key: 'vendors', label: 'Vendor Master ', icon: 'fa-user-gear' }
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
                                                className={`w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center justify-between font-bold cursor-pointer ${selectedMaster === m.key ? 'text-[#e31b23] bg-red-50/50' : 'text-slate-700'}`}>
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
                                    <i className="fa-solid fa-list-check text-[#e31b23]"></i> {currentHeaderConfig.title}
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
                                {/* BULK UPLOAD BUTTONS FOR ALL MASTERS */}
                                {selectedMaster === 'items' && (
                                    <button
                                        type="button"
                                        onClick={() => changeNavState({ bookPageMode: 'bulk-grid-page' })}
                                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer">
                                        <i className="fa-solid fa-file-excel"></i> Bulk Upload Books
                                    </button>
                                )}

                                {selectedMaster === 'authors' && (
                                    <button
                                        type="button"
                                        onClick={() => changeNavState({ authorPageMode: 'bulk-author-grid-page' })}
                                        className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer">
                                        <i className="fa-solid fa-file-excel"></i> Bulk Upload Authors
                                    </button>
                                )}

                                {selectedMaster === 'categories' && (
                                    <button
                                        type="button"
                                        onClick={() => changeNavState({ categoryPageMode: 'bulk-category-grid-page' })}
                                        className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer">
                                        <i className="fa-solid fa-file-excel"></i> Bulk Upload Categories
                                    </button>
                                )}

                                {selectedMaster === 'languages' && (
                                    <button
                                        type="button"
                                        onClick={() => changeNavState({ languagePageMode: 'bulk-language-grid-page' })}
                                        className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-3.5 py-1.5 rounded shadow flex items-center gap-1.5 transition cursor-pointer">
                                        <i className="fa-solid fa-file-excel"></i> Bulk Upload Languages
                                    </button>
                                )}

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

                        {(selectedMaster === 'vendors') ? (
                            VendorMasterComp ? (
                                <VendorMasterComp
                                    booksList={myAuthorBooks}
                                    triggerToast={triggerToast}
                                />
                            ) : <div>Vendor Master Component Not Loaded</div>
                        ) : (selectedMaster === 'items' && bookPageMode === 'add-book-page') ? (
                            AddBookFormComp ? (
                                <AddBookFormComp
                                    categoriesList={categoriesList}
                                    languagesList={languagesList}
                                        authorsList={authorsList}
                                        vendorsList={vendorsList}
                                    onOpenAddCategoryModal={() => setShowAddCategoryModal(true)}
                                    onOpenAddLanguageModal={() => setShowAddLanguageModal(true)}
                                    onOpenAddAuthorModal={() => setShowAddAuthorModal(true)}
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
                        ) : selectedMaster === 'items' && bookPageMode === 'bulk-grid-page' ? (
                            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => changeNavState({ bookPageMode: 'list' })}
                                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer flex items-center justify-center transition shadow-sm">
                                            <i className="fa-solid fa-arrow-left"></i>
                                        </button>
                                        <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                            <i className="fa-solid fa-table-cells text-emerald-600"></i> Excel-Style Bulk Upload Page
                                        </h3>
                                    </div>
                                </div>

                                <BulkGridFormContainer
                                    categoriesList={categoriesList}
                                    languagesList={languagesList}
                                    authorsList={authorsList}
                                    onSuccess={async (msg) => {
                                        triggerToast(msg);
                                        await fetchAuthorBooks();
                                        await fetchStoreBooks();
                                        changeNavState({ bookPageMode: 'list' });
                                    }}
                                    onCancel={() => changeNavState({ bookPageMode: 'list' })}
                                />
                            </div>
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
                                ) : selectedMaster === 'plans' ? (
                                    <PlanMaster triggerToast={triggerToast} />
                                ) : selectedMaster === 'bundles' ? (
                                    typeof window.BundleMaster !== 'undefined' ? (
                                        <window.BundleMaster triggerToast={triggerToast} />
                                    ) : (
                                        <BundleMaster triggerToast={triggerToast} />
                                    )
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
                        ) : selectedMaster === 'categories' && categoryPageMode === 'bulk-category-grid-page' ? (
                            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <div className="flex items-center gap-3">
                                       <button
                                          type="button"
                                          onClick={() => changeNavState({ categoryPageMode: 'list' })}
                                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer transition shadow-sm">
                                          <i className="fa-solid fa-arrow-left"></i>
                                       </button>
                                       <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                           <i className="fa-solid fa-layer-group text-amber-600"></i> Bulk Upload Categories
                                       </h3>
                                    </div>
                                </div>
                                <BulkCategoryGridContainer
                                    onSuccess={async (msg) => {
                                        triggerToast(msg);
                                         await fetchCategories();
                                          changeNavState({ categoryPageMode: 'list' });
                                    }}
                                     onCancel={() => changeNavState({ categoryPageMode: 'list' })}
                                  />
                            </div>
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
                        ) : selectedMaster === 'languages' && languagePageMode === 'bulk-language-grid-page' ? (
                            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-4">
                                <div className="flex items-center justify-between border-b pb-3">
                                      <div className="flex items-center gap-3">
                                          <button
                                              type="button"
                                              onClick={() => changeNavState({ languagePageMode: 'list' })}
                                              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer transition shadow-sm">
                                              <i className="fa-solid fa-arrow-left"></i>
                                          </button>
                                          <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                             <i className="fa-solid fa-language text-indigo-600"></i> Bulk Upload Languages
                                          </h3>
                                      </div>
                                </div>
                                <BulkLanguageGridContainer
                                    onSuccess={async (msg) => {
                                        triggerToast(msg);
                                        await fetchLanguagesMaster();
                                        changeNavState({ languagePageMode: 'list' });
                                    }}
                                    onCancel={() => changeNavState({ languagePageMode: 'list' })}
                                />
                            </div>
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
                        ) : selectedMaster === 'authors' && authorPageMode === 'bulk-author-grid-page' ? (
                            <div className="w-full bg-white p-6 rounded-lg shadow-md border border-slate-200 space-y-4">
                               <div className="flex items-center justify-between border-b pb-3">
                                   <div className="flex items-center gap-3">
                                       <button
                                           type="button"
                                           onClick={() => changeNavState({ authorPageMode: 'list' })}
                                           className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer transition shadow-sm">
                                           <i className="fa-solid fa-arrow-left"></i>
                                       </button>
                                       <h3 className="text-xl font-bold text-[#0d233a] flex items-center gap-2">
                                          <i className="fa-solid fa-user-pen text-blue-600"></i> Bulk Upload Authors
                                       </h3>
                                   </div>
                               </div>
                               <BulkAuthorGridContainer
                                  onSuccess={async (msg) => {
                                     triggerToast(msg);
                                     await fetchAuthorsMaster();
                                     changeNavState({ authorPageMode: 'list' });
                                  }}
                                  onCancel={() => changeNavState({ authorPageMode: 'list' })}
                               />
                            </div>
                        ) : (
                            <div className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
                                <h3 className="text-base font-bold text-[#0d233a] border-b pb-2 capitalize flex items-center justify-between">
                                    <span><i className="fa-solid fa-list text-[#e31b23] me-2"></i>{selectedMaster} List View ({currentMasterData.length})</span>
                                    <span className="text-xs text-slate-500">Showing Top {rowsPerPage} Rows</span>
                                </h3>

                                                                    
                                <div className="overflow-x-auto overflow-y-auto w-full max-h-[500px] border border-gray-200 rounded-lg shadow-inner">
                                    <table className="w-full text-left text-slate-800 text-xs relative border-collapse">
                                        <thead className="bg-slate-100 text-slate-600 uppercase border-b font-bold sticky top-0 z-20 shadow-sm">
                                            <tr>
                                                <th className="p-3 w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isAllSelected}
                                                        onChange={(e) => handleSelectAllMasterRows(e, currentMasterData.slice(0, rowsPerPage))}
                                                        className="w-4 h-4 cursor-pointer accent-[#e31b23]"
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
                                                                                                                        <th className="p-3">Vendor Name</th>
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
                                               {currentMasterData.map((item, index) => {
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
                                                                className="w-4 h-4 cursor-pointer accent-[#e31b23]"
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
                                                            <>
                                                                    <td className="p-3 font-bold text-amber-700">
                                                                        {getBookCategoryName(item.raw)}
                                                                    </td>
                                                                <td className="p-3 font-mono text-slate-600">
                                                                    {item.raw.isbn || item.raw.ISBN || item.raw.Isbn || 'N/A'}
                                                                </td>
                                                                <td className="p-3 font-bold text-blue-700">
                                                                    {item.raw.extractedAuthorName || item.raw.authorName || item.raw.AuthorName || item.raw.author || item.raw.Author || 'Dr. Samuel Hahnemann'}
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-700">
                                                                    {item.raw.extractedPublisherName || item.raw.createdBy || item.raw.CreatedBy || item.raw.publisherName || item.raw.PublisherName || 'System Administrator'}
                                                                    </td>
                                                                    <td className="p-3 font-bold text-indigo-700">
                                                                        {item.raw.vendorName || item.raw.VendorName || 'In-House (B. Jain)'}
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
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();

                                                                    
                                                                    const targetId = item.id || (item.raw ? (item.raw.id || item.raw.Id || item.raw.itemNo) : item.name);

                                                                   
                                                                    setSelectedMasterIds([]);

                                                                    setDeleteConfirmModal({
                                                                        show: true,
                                                                        id: targetId,
                                                                        ids: [],
                                                                        title: item.name,
                                                                        type: selectedMaster
                                                                    });
                                                                }}
                                                                className="text-[#e31b23] hover:underline font-bold cursor-pointer">
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
                    <main className="w-full space-y-8">

                        
                        <div className="w-full bg-[#e31b23] text-white rounded-2xl shadow-xl overflow-hidden flex flex-col lg:flex-row items-center justify-between p-6 md:p-10 gap-8">

                            
                            <div className="flex items-end justify-center gap-1.5 md:gap-2.5 shrink-0 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm">

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-slate-900 border-l-4 border-slate-700 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-amber-200 font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Boger Repertory</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-emerald-950 border-l-4 border-amber-500 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-white font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Materia Medica</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-red-950 border-l-4 border-amber-400 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-amber-300 font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Essentials Tiwari</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-[#c21807] border-l-4 border-amber-300 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-white font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Guiding Symptoms</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-amber-600 border-l-4 border-amber-200 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-slate-900 font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Clinical Synthesis</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-blue-900 border-l-4 border-amber-400 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-amber-200 font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Lotus Materia</span>
                                </div>

                                <div className="w-9 md:w-11 h-44 md:h-56 bg-amber-100 border-l-4 border-amber-700 rounded-sm shadow-2xl flex flex-col justify-between p-1 text-[8px] text-slate-900 font-serif font-bold text-center">
                                    <span className="rotate-90 origin-left translate-x-3 translate-y-12 truncate w-28 uppercase tracking-tighter">Kent Repertory</span>
                                </div>
                            </div>

                            
                            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">

                                <div className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-900 font-extrabold text-[10px] md:text-xs px-4 py-1.5 rounded-full uppercase tracking-wider shadow-md">
                                    <i className="fa-solid fa-award"></i> More than 50 Years Of Serving Homoeopathy...
                                </div>

                                <div className="space-y-1 pt-2">
                                    <div className="w-20 h-20 md:w-28 md:h-28 mx-auto bg-white rounded-full flex items-center justify-center text-[#e31b23] font-serif font-black text-5xl md:text-7xl shadow-xl leading-none">
                                        b
                                    </div>
                                    <h1 className="text-5xl md:text-7xl font-black font-serif tracking-tight text-white drop-shadow-md">
                                        B JAIN
                                    </h1>
                                    <h2 className="text-sm md:text-xl font-sans font-bold text-amber-200 tracking-widest uppercase">
                                        PUBLISHERS PVT. LTD.
                                    </h2>
                                </div>

                                <p className="text-base md:text-2xl font-serif italic text-white pt-2 font-medium">
                                    Serving Homeopathy Since 1966
                                </p>
                            </div>
                        </div>

                        {loadingBooks ? (
                            <p className="text-center text-xs py-8">Loading Publications...</p>
                        ) : (
                            <div className="space-y-4">
                                <h2 className="text-xl font-bold text-slate-900 border-b pb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-book-bookmark text-[#e31b23]"></i> Catalog Publications
                                </h2>

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
                                                    {(b.isRoyaltyApplicable || b.IsRoyaltyApplicable) && (
                                                        <div className="mt-1">
                                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                                                <i className="fa-solid fa-crown text-amber-600"></i> Royalty: Yes
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2 pt-2 border-t">
                                                    <div className="font-black text-slate-900 text-base">₹{b.price !== undefined ? b.price : b.Price}</div>
                                                    <button
                                                        onClick={() => handleReadAccess(b)}
                                                        className="w-full bg-[#e31b23] hover:bg-red-800 text-white font-bold py-1.5 rounded text-xs shadow flex items-center justify-center gap-1 cursor-pointer">
                                                        <i className="fa-solid fa-book-open"></i> Read Access
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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

            {/* QUICK ADD CATEGORY MODAL */}
            {showAddCategoryModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-amber-500">
                        <button onClick={() => setShowAddCategoryModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-slate-800 cursor-pointer">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                        <h3 className="text-base font-bold text-[#0d233a] flex items-center gap-2">
                            <i className="fa-solid fa-layer-group text-amber-500"></i> Quick Add Category
                        </h3>
                        <form onSubmit={handleSaveQuickCategory} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={quickCategoryName}
                                    onChange={e => setQuickCategoryName(e.target.value)}
                                    placeholder="e.g. Homoeopathy"
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-amber-500"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="px-4 py-2 bg-gray-200 text-slate-700 font-bold rounded cursor-pointer">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-amber-500 text-white font-bold rounded shadow cursor-pointer hover:bg-amber-600">Save Category</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QUICK ADD LANGUAGE MODAL */}
            {showAddLanguageModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-indigo-600">
                        <button onClick={() => setShowAddLanguageModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-slate-800 cursor-pointer">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                        <h3 className="text-base font-bold text-[#0d233a] flex items-center gap-2">
                            <i className="fa-solid fa-language text-indigo-600"></i> Quick Add Language
                        </h3>
                        <form onSubmit={handleSaveQuickLanguage} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Language Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={quickLanguageName}
                                    onChange={e => setQuickLanguageName(e.target.value)}
                                    placeholder="e.g. German"
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-indigo-600"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddLanguageModal(false)} className="px-4 py-2 bg-gray-200 text-slate-700 font-bold rounded cursor-pointer">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white font-bold rounded shadow cursor-pointer hover:bg-indigo-700">Save Language</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* QUICK ADD AUTHOR MODAL */}
            {showAddAuthorModal && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-blue-600">
                        <button onClick={() => setShowAddAuthorModal(false)} className="absolute top-3 right-3 text-gray-400 hover:text-slate-800 cursor-pointer">
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                        <h3 className="text-base font-bold text-[#0d233a] flex items-center gap-2">
                            <i className="fa-solid fa-user-pen text-blue-600"></i> Quick Add Author
                        </h3>
                        <form onSubmit={handleSaveQuickAuthor} className="space-y-4 text-xs">
                            <div>
                                <label className="font-bold text-slate-700 block mb-1">Author Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={quickAuthorName}
                                    onChange={e => setQuickAuthorName(e.target.value)}
                                    placeholder="e.g. Dr. William Boericke"
                                    className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-600"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowAddAuthorModal(false)} className="px-4 py-2 bg-gray-200 text-slate-700 font-bold rounded cursor-pointer">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded shadow cursor-pointer hover:bg-blue-700">Save Author</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* INTERACTIVE EXCEL GRID BULK UPLOAD MODAL */}
            {showBulkUploadModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[95] flex items-center justify-center p-2 md:p-6 select-none">
                    <div className="bg-white rounded-xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl relative border-t-8 border-emerald-600 overflow-hidden">

                        {/* MODAL HEADER */}
                        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-table-cells text-emerald-400 text-2xl"></i>
                                <div>
                                    <h3 className="text-base font-bold text-white">Excel-Style Interactive Bulk Upload Sheet</h3>
                                    <p className="text-[11px] text-slate-400">Directly fill multiple books in the table grid & click upload all.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBulkUploadModal(false)} className="text-slate-400 hover:text-white cursor-pointer text-xl">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* GRID TABLE BODY CONTAINER */}
                        <div className="flex-1 overflow-auto p-4 bg-slate-50">
                            <BulkGridFormContainer
                                categoriesList={categoriesList}
                                languagesList={languagesList}
                                authorsList={authorsList}
                                onSuccess={async (msg) => {
                                    triggerToast(msg);
                                    setShowBulkUploadModal(false);
                                    await fetchAuthorBooks();
                                    await fetchStoreBooks();
                                }}
                                onCancel={() => setShowBulkUploadModal(false)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* AUTHENTICATION MODAL (SIGN IN / REGISTER) */}
            {isAuthOpen && (
                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-md p-6 shadow-2xl relative space-y-4 border-t-4 border-[#e31b23]">
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
                                    className="w-full bg-[#e31b23] hover:bg-red-700 text-white font-bold py-2.5 rounded text-xs shadow transition cursor-pointer">
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
                                            <option value="Publisher">Publisher</option>
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
                                            className="text-[#e31b23] font-bold hover:underline ms-1 cursor-pointer">
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

function BulkGridFormContainer({ categoriesList, languagesList, authorsList, vendorsList, onSuccess, onCancel }) {
    const createEmptyRow = () => ({
        itemNo: '',
        isbn: '',
        itemName: '',
        categoryCode: categoriesList.length > 0 ? (categoriesList[0].categoryCode || categoriesList[0].CategoryCode) : '',
        authorName: authorsList.length > 0 ? authorsList[0].name : '',
        vendorName: '',
        language: languagesList.length > 0 ? (languagesList[0].name || languagesList[0].languageName) : 'English',
        price: '',
        noOfPages: '',
        mainPdf: null,
        coverImage: null
    });

    const [rows, setRows] = React.useState([createEmptyRow()]);
    const [isUploading, setIsUploading] = React.useState(false);
    const [pasteText, setPasteText] = React.useState('');
    const [showPasteBox, setShowPasteBox] = React.useState(false);

    const handleRowChange = (index, field, value) => {
        const updated = [...rows];
        updated[index][field] = value;
        setRows(updated);
    };

    const handleAddRow = () => {
        setRows([...rows, createEmptyRow()]);
    };

    const handleRemoveRow = (index) => {
        if (rows.length <= 1) {
            alert("Kam se kam 1 row honi chahiye.");
            return;
        }
        setRows(rows.filter((_, i) => i !== index));
    };

    // SMART EXCEL PASTE PARSER LOGIC
    const handleParseExcelPaste = () => {
        if (!pasteText || !pasteText.trim()) {
            alert("Kripya Excel se copy kiya hua data text area me paste karein.");
            return;
        }

        const lines = pasteText.trim().split(/\r\n|\n|\r/);
        const parsedRows = [];

        lines.forEach(line => {
            if (!line.trim()) return;

            // Tab-separated string parsing (Excel default format)
            const cols = line.split('\t');

            /* Excel Columns Sequence Expected:
               Col 0: Item Code (Optional)
               Col 1: ISBN
               Col 2: Book Name
               Col 3: Price
               Col 4: Pages
            */
            const itemNo = cols[0] ? cols[0].trim() : '';
            const isbn = cols[1] ? cols[1].trim() : '';
            const itemName = cols[2] ? cols[2].trim() : (cols[0] ? cols[0].trim() : '');
            const price = cols[3] ? cols[3].trim() : '';
            const noOfPages = cols[4] ? cols[4].trim() : '';

            parsedRows.push({
                itemNo: itemNo,
                isbn: isbn,
                itemName: itemName,
                categoryCode: categoriesList.length > 0 ? (categoriesList[0].categoryCode || categoriesList[0].CategoryCode) : '',
                authorName: authorsList.length > 0 ? authorsList[0].name : '',
                language: languagesList.length > 0 ? (languagesList[0].name || languagesList[0].languageName) : 'English',
                price: price,
                noOfPages: noOfPages,
                mainPdf: null,
                coverImage: null
            });
        });

        if (parsedRows.length > 0) {
            setRows(parsedRows);
            setPasteText('');
            setShowPasteBox(false);
            alert(`${parsedRows.length} rows Excel se successfully import ho gayi hain! Ab aap Files upload kar sakte hain.`);
        }
    };

    const handleSubmitGrid = async (e) => {
        e.preventDefault();

        const validRows = rows.filter(r => r.itemName && r.itemName.trim().length > 0);
        if (validRows.length === 0) {
            alert("Kripya kam se kam 1 book ka Book Name fill karein!");
            return;
        }

        setIsUploading(true);
        const formData = new FormData();

        validRows.forEach((r, idx) => {
            formData.append(`Books[${idx}].ItemNo`, r.itemNo ? r.itemNo.trim() : '');
            formData.append(`Books[${idx}].ISBN`, r.isbn ? r.isbn.trim() : 'N/A');
            formData.append(`Books[${idx}].ItemName`, r.itemName.trim());
            formData.append(`Books[${idx}].CategoryCode`, r.categoryCode);
            formData.append(`Books[${idx}].AuthorName`, r.authorName);
            formData.append(`Books[${idx}].VendorName`, r.vendorName || '');
            formData.append(`Books[${idx}].Language`, r.language);
            formData.append(`Books[${idx}].Price`, r.price || '0');
            formData.append(`Books[${idx}].NoOfPages`, r.noOfPages || '1');
            if (r.mainPdf) formData.append(`Books[${idx}].MainPdf`, r.mainPdf);
            if (r.coverImage) formData.append(`Books[${idx}].CoverImage`, r.coverImage);
        });

        try {
            const res = await fetch('/api/author/book/bulk-upload-grid', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok && data.success) {
                onSuccess(data.message);
            } else {
                alert(data.message || "Bulk Grid Upload Failed.");
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmitGrid} className="space-y-4 text-xs">
            {/* EXCEL PASTE QUICK BAR */}
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-300 space-y-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-file-excel text-emerald-700 text-lg"></i>
                        <span className="font-bold text-slate-800 text-xs">
                            Quick Excel Copy-Paste Import
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPasteBox(!showPasteBox)}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-[#e31b23] fa-paste"></i>
                        {showPasteBox ? 'Hide Paste Box' : 'Paste Excel Data Here'}
                    </button>
                </div>

                {showPasteBox && (
                    <div className="space-y-2 pt-2 border-t border-emerald-200">
                        <p className="text-[11px] text-slate-600">
                            Excel sheet se in columns ko copy karein: <strong className="text-emerald-800">[Item Code | ISBN | Book Name | Price | Pages]</strong> aur niche paste karke Process button par click karein.
                        </p>
                        <textarea
                            rows={4}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder="Excel se copy kiya hua data yahan Ctrl+V karein..."
                            className="w-full p-2 border border-slate-300 rounded font-mono text-xs bg-white outline-none focus:border-emerald-600"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={handleParseExcelPaste}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded text-xs shadow cursor-pointer">
                                <i className="fa-solid fa-check me-1"></i> Process & Auto-Fill Table
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* TABLE GRID */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold uppercase border-b border-slate-300 sticky top-0 z-10">
                        <tr>
                            <th className="p-2 w-10 text-center">#</th>
                            <th className="p-2 min-w-[120px]">Item Code</th>
                            <th className="p-2 min-w-[130px]">ISBN</th>
                            <th className="p-2 min-w-[200px]">Book Name *</th>
                            <th className="p-2 min-w-[150px]">Category *</th>
                            <th className="p-2 min-w-[150px]">Author Name</th>
                            <th className="p-2 min-w-[150px]">Vendor Name</th>
                            <th className="p-2 min-w-[110px]">Language</th>
                            <th className="p-2 min-w-[90px]">Price (₹) *</th>
                            <th className="p-2 min-w-[80px]">Pages *</th>
                            <th className="p-2 min-w-[160px]">PDF File *</th>
                            <th className="p-2 min-w-[160px]">Cover Image</th>
                            <th className="p-2 w-12 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                                <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        placeholder="Optional Code"
                                        value={row.itemNo}
                                        onChange={e => handleRowChange(idx, 'itemNo', e.target.value)}
                                        className="w-full border rounded px-2 py-1 font-mono uppercase bg-slate-50"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        placeholder="978-XXXXX"
                                        value={row.isbn}
                                        onChange={e => handleRowChange(idx, 'isbn', e.target.value)}
                                        className="w-full border rounded px-2 py-1"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Enter New Book Name *"
                                        value={row.itemName}
                                        onChange={e => handleRowChange(idx, 'itemName', e.target.value)}
                                        className="w-full border rounded px-2 py-1 font-bold text-slate-800 focus:border-emerald-600 outline-none"
                                    />
                                </td>
                                <td className="p-1">
                                    <select
                                        value={row.categoryCode}
                                        onChange={e => handleRowChange(idx, 'categoryCode', e.target.value)}
                                        className="w-full border rounded px-2 py-1 font-semibold">
                                        {categoriesList.map(c => (
                                            <option key={c.categoryCode || c.CategoryCode} value={c.categoryCode || c.CategoryCode}>
                                                {c.categoryName || c.CategoryName}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-1">
                                    <select
                                        value={row.authorName}
                                        onChange={e => handleRowChange(idx, 'authorName', e.target.value)}
                                        className="w-full border rounded px-2 py-1">
                                        {authorsList.map(a => (
                                            <option key={a.id || a.name} value={a.name}>
                                                {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        list={`vendors-datalist-row-${idx}`}
                                        placeholder="Enter Vendor Name"
                                        value={row.vendorName}
                                        onChange={e => handleRowChange(idx, 'vendorName', e.target.value)}
                                        className="w-full border rounded px-2 py-1 font-semibold bg-emerald-50/50 outline-none focus:border-emerald-600"
                                    />
                                    <datalist id={`vendors-datalist-row-${idx}`}>
                                        {vendorsList && vendorsList.map(v => {
                                            const vName = v.name || v.Name || v.vendorName || v.VendorName;
                                            return <option key={v.id || v.Id} value={vName} />;
                                        })}
                                    </datalist>
                                </td>
                                <td className="p-1">
                                    <select
                                        value={row.language}
                                        onChange={e => handleRowChange(idx, 'language', e.target.value)}
                                        className="w-full border rounded px-2 py-1">
                                        {languagesList.map(l => (
                                            <option key={l.id || l.name} value={l.name || l.languageName}>
                                                {l.name || l.languageName}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        required
                                        placeholder="499"
                                        value={row.price}
                                        onChange={e => handleRowChange(idx, 'price', e.target.value)}
                                        className="w-full border rounded px-2 py-1 font-bold text-emerald-700 text-center"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="number"
                                        required
                                        placeholder="100"
                                        value={row.noOfPages}
                                        onChange={e => handleRowChange(idx, 'noOfPages', e.target.value)}
                                        className="w-full border rounded px-2 py-1 text-center"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="file"
                                        required
                                        accept="application/pdf"
                                        onChange={e => handleRowChange(idx, 'mainPdf', e.target.files[0])}
                                        className="w-full text-[10px]"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={e => handleRowChange(idx, 'coverImage', e.target.files[0])}
                                        className="w-full text-[10px]"
                                    />
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRow(idx)}
                                        className="text-red-500 hover:text-red-700 p-1 font-bold cursor-pointer"
                                        title="Delete Row">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between pt-2">
                <button
                    type="button"
                    onClick={handleAddRow}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded shadow text-xs cursor-pointer flex items-center gap-1.5">
                    <i className="fa-solid fa-plus text-emerald-400"></i> Add Another Book Row
                </button>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="bg-gray-200 hover:bg-gray-300 text-slate-700 font-bold px-5 py-2 rounded text-xs cursor-pointer">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isUploading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded shadow text-xs cursor-pointer flex items-center gap-2">
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        {isUploading ? 'Uploading All Books...' : 'Upload All Books'}
                    </button>
                </div>
            </div>
        </form>
    );
}

// ==========================================
// BULK AUTHOR GRID CONTAINER
// ==========================================
function BulkAuthorGridContainer({ onSuccess, onCancel }) {
    const [rows, setRows] = React.useState([{ authorName: '' }]);
    const [isUploading, setIsUploading] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const valid = rows.filter(r => r.authorName.trim());
        if (!valid.length) return alert("Kam se kam 1 Author Name zaroori hai.");

        setIsUploading(true);
        try {
            const res = await fetch('/api/authors/bulk-upload-grid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(valid)
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || "Bulk Upload Failed.");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-300 p-2 font-bold uppercase text-slate-700">
                        <tr>
                            <th className="p-2 w-12 text-center">#</th>
                            <th className="p-2">Author Name *</th>
                            <th className="p-2 w-16 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2 text-center font-bold text-slate-500">{i + 1}</td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Dr. Samuel Hahnemann"
                                        value={r.authorName}
                                        onChange={e => {
                                            const updated = [...rows];
                                            updated[i].authorName = e.target.value;
                                            setRows(updated);
                                        }}
                                        className="w-full border rounded px-3 py-1.5 font-bold text-slate-800 outline-none focus:border-blue-500"
                                    />
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows)}
                                        className="text-red-500 hover:text-red-700 font-bold p-1 cursor-pointer">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center pt-2">
                <button
                    type="button"
                    onClick={() => setRows([...rows, { authorName: '' }])}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded font-bold shadow text-xs cursor-pointer flex items-center gap-1.5">
                    <i className="fa-solid fa-plus text-blue-400"></i> Add Another Row
                </button>
                <div className="flex gap-2">
                    <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 text-slate-700 px-4 py-2 rounded font-bold text-xs cursor-pointer">Cancel</button>
                    <button type="submit" disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold shadow text-xs cursor-pointer">
                        {isUploading ? 'Uploading...' : 'Upload All Authors'}
                    </button>
                </div>
            </div>
        </form>
    );
}

// ==========================================
// BULK CATEGORY GRID CONTAINER
// ==========================================
function BulkCategoryGridContainer({ onSuccess, onCancel }) {
    const [rows, setRows] = React.useState([{ categoryName: '', description: '' }]);
    const [isUploading, setIsUploading] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const valid = rows.filter(r => r.categoryName.trim());
        if (!valid.length) return alert("Kam se kam 1 Category Name zaroori hai.");

        setIsUploading(true);
        try {
            const res = await fetch('/api/category/bulk-upload-grid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(valid)
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || "Bulk Upload Failed.");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-300 p-2 font-bold uppercase text-slate-700">
                        <tr>
                            <th className="p-2 w-12 text-center">#</th>
                            <th className="p-2 min-w-[200px]">Category Name *</th>
                            <th className="p-2 min-w-[300px]">Description</th>
                            <th className="p-2 w-16 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2 text-center font-bold text-slate-500">{i + 1}</td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Homoeopathy"
                                        value={r.categoryName}
                                        onChange={e => {
                                            const updated = [...rows];
                                            updated[i].categoryName = e.target.value;
                                            setRows(updated);
                                        }}
                                        className="w-full border rounded px-3 py-1.5 font-bold text-amber-900 outline-none focus:border-amber-500"
                                    />
                                </td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        placeholder="Optional Category Description"
                                        value={r.description}
                                        onChange={e => {
                                            const updated = [...rows];
                                            updated[i].description = e.target.value;
                                            setRows(updated);
                                        }}
                                        className="w-full border rounded px-3 py-1.5 outline-none"
                                    />
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows)}
                                        className="text-red-500 hover:text-red-700 font-bold p-1 cursor-pointer">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center pt-2">
                <button
                    type="button"
                    onClick={() => setRows([...rows, { categoryName: '', description: '' }])}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded font-bold shadow text-xs cursor-pointer flex items-center gap-1.5">
                    <i className="fa-solid fa-plus text-amber-400"></i> Add Another Row
                </button>
                <div className="flex gap-2">
                    <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 text-slate-700 px-4 py-2 rounded font-bold text-xs cursor-pointer">Cancel</button>
                    <button type="submit" disabled={isUploading} className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded font-bold shadow text-xs cursor-pointer">
                        {isUploading ? 'Uploading...' : 'Upload All Categories'}
                    </button>
                </div>
            </div>
        </form>
    );
}

// ==========================================
// BULK LANGUAGE GRID CONTAINER
// ==========================================
function BulkLanguageGridContainer({ onSuccess, onCancel }) {
    const [rows, setRows] = React.useState([{ languageName: '' }]);
    const [isUploading, setIsUploading] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const valid = rows.filter(r => r.languageName.trim());
        if (!valid.length) return alert("Kam se kam 1 Language Name zaroori hai.");

        setIsUploading(true);
        try {
            const res = await fetch('/api/language/bulk-upload-grid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(valid)
            });
            const data = await res.json();
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || "Bulk Upload Failed.");
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="border border-slate-300 rounded bg-white overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-300 p-2 font-bold uppercase text-slate-700">
                        <tr>
                            <th className="p-2 w-12 text-center">#</th>
                            <th className="p-2">Language Name *</th>
                            <th className="p-2 w-16 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {rows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2 text-center font-bold text-slate-500">{i + 1}</td>
                                <td className="p-1">
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. German"
                                        value={r.languageName}
                                        onChange={e => {
                                            const updated = [...rows];
                                            updated[i].languageName = e.target.value;
                                            setRows(updated);
                                        }}
                                        className="w-full border rounded px-3 py-1.5 font-bold text-indigo-900 outline-none focus:border-indigo-500"
                                    />
                                </td>
                                <td className="p-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows)}
                                        className="text-red-500 hover:text-red-700 font-bold p-1 cursor-pointer">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-between items-center pt-2">
                <button
                    type="button"
                    onClick={() => setRows([...rows, { languageName: '' }])}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded font-bold shadow text-xs cursor-pointer flex items-center gap-1.5">
                    <i className="fa-solid fa-plus text-indigo-400"></i> Add Another Row
                </button>
                <div className="flex gap-2">
                    <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 text-slate-700 px-4 py-2 rounded font-bold text-xs cursor-pointer">Cancel</button>
                    <button type="submit" disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded font-bold shadow text-xs cursor-pointer">
                        {isUploading ? 'Uploading...' : 'Upload All Languages'}
                    </button>
                </div>
            </div>
        </form>
    );
}


const containerElement = document.getElementById('root') || document.getElementById('main-app-container');
if (containerElement) {
    const root = ReactDOM.createRoot(containerElement);
    root.render(<App />);
}