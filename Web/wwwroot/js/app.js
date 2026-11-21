const { useState, useEffect, useCallback, useRef } = React;

// ============================================================================
// 1. INDUSTRY-STANDARD API CLIENT & GLOBAL FETCH INTERCEPTOR (LOCAL + SERVER)
// ============================================================================
(function () {
    const originalFetch = window.fetch;
    const apiCache = new Map();
    const inFlightRequests = new Map();
    const CACHE_TTL_MS = 60 * 1000; // 1 minute smart cache for GET master APIs

    // Auto-detect base URL (works on localhost, IP:Port, or IIS virtual directory)
    const getBaseUrl = () => {
        if (window.__APP_BASE_URL__) return window.__APP_BASE_URL__.replace(/\/$/, '');
        return window.location.origin;
    };

    const resolveApiUrl = (inputUrl) => {
        if (typeof inputUrl !== 'string') return inputUrl;
        if (/^https?:\/\//i.test(inputUrl)) return inputUrl;
        const cleanPath = inputUrl.startsWith('/') ? inputUrl : `/${inputUrl}`;
        return `${getBaseUrl()}${cleanPath}`;
    };

    // Safe JSON parser to prevent "Unexpected end of JSON input" on 400/405/500
    window.safeJsonParse = async function (response) {
        if (!response) return {};
        const text = await response.text();
        if (!text || !text.trim()) return {};
        try {
            return JSON.parse(text);
        } catch (e) {
            return { message: `Server Error (${response.status}): ${response.statusText || 'Invalid Response'}` };
        }
    };

    // Clear cache on data mutations (POST/PUT/DELETE)
    window.clearApiCache = function (prefix = '') {
        if (!prefix) {
            apiCache.clear();
            return;
        }
        for (const key of apiCache.keys()) {
            if (key.includes(prefix)) apiCache.delete(key);
        }
    };

    window.fetch = async function (resource, init = {}) {
        const url = typeof resource === 'string' ? resolveApiUrl(resource) : resource;
        const method = (init.method || 'GET').toUpperCase();
        const isApiCall = typeof url === 'string' && (url.includes('/api/') || url.includes('/Reader/api/'));

        const headers = new Headers(init.headers || {});
        if (!headers.has('Accept')) {
            headers.set('Accept', 'application/json, text/plain, */*');
        }
        headers.set('X-Requested-With', 'XMLHttpRequest');

        const token = localStorage.getItem('sessionToken');
        if (token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        const finalInit = {
            ...init,
            method,
            headers,
            credentials: init.credentials || 'include'
        };

        // Fast Cache & Deduplication for GET API requests (excluding binary PDF streams)
        const isBinary = headers.get('Accept')?.includes('application/pdf');
        const cacheKey = `${method}:${url}`;

        if (isApiCall && method === 'GET' && !isBinary && !init.noCache) {
            const cached = apiCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
                return new Response(cached.body, {
                    status: cached.status,
                    statusText: cached.statusText,
                    headers: cached.headers
                });
            }

            if (inFlightRequests.has(cacheKey)) {
                const sharedRes = await inFlightRequests.get(cacheKey);
                return sharedRes.clone();
            }
        }

        // Invalidate cache automatically on write operations
        if (isApiCall && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
            window.clearApiCache();
        }

        // Timeout controller (25 seconds max so server doesn't hang UI)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);
        if (!finalInit.signal) {
            finalInit.signal = controller.signal;
        }

        const fetchPromise = (async () => {
            try {
                const response = await originalFetch(url, finalInit);
                clearTimeout(timeoutId);

                if (response.status === 401 && isApiCall) {
                    const clone = response.clone();
                    try {
                        const data = await window.safeJsonParse(clone);
                        if (data && data.error === "SessionExpired") {
                            alert(data.message || "Your Account is Logged in on Another Device.");
                            localStorage.removeItem('isExplicitLogin');
                            localStorage.removeItem('sessionToken');
                            window.location.reload();
                        }
                    } catch (e) { }
                }

                // Store successful GET JSON responses in fast memory cache
                if (isApiCall && method === 'GET' && response.ok && !isBinary) {
                    const cloneForCache = response.clone();
                    const textBody = await cloneForCache.text();
                    apiCache.set(cacheKey, {
                        body: textBody,
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers,
                        timestamp: Date.now()
                    });
                }

                return response;
            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError') {
                    throw new Error('Server request timed out. Please check network/server load.');
                }
                throw error;
            } finally {
                inFlightRequests.delete(cacheKey);
            }
        })();

        if (isApiCall && method === 'GET' && !isBinary && !init.noCache) {
            inFlightRequests.set(cacheKey, fetchPromise);
        }

        const res = await fetchPromise;
        return isApiCall && method === 'GET' && !isBinary ? res.clone() : res;
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

            const data = await window.safeJsonParse(res);
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
    const startPage = Math.max(1, parseInt(book?.initialPage || 1, 10) || 1);
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [jumpPageInput, setJumpPageInput] = useState('1');
    const [pdfDoc, setPdfDoc] = useState(null);
    const [zoomScale, setZoomScale] = useState(1.35);

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
        const blockShortcuts = (e) => {
            if ((e.ctrlKey || e.metaKey) && ['p', 's', 'u'].includes(e.key.toLowerCase())) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                return false;
            }
        };

        const blockContextMenu = (e) => {
            e.preventDefault();
            return false;
        };

        const printStyle = document.createElement('style');
        printStyle.id = 'drm-print-blocker';
        printStyle.innerHTML = `@media print { body * { display: none !important; visibility: hidden !important; } }`;
        document.head.appendChild(printStyle);

        window.addEventListener('keydown', blockShortcuts, true);
        document.addEventListener('keydown', blockShortcuts, true);
        document.addEventListener('contextmenu', blockContextMenu, true);

        return () => {
            window.removeEventListener('keydown', blockShortcuts, true);
            document.removeEventListener('keydown', blockShortcuts, true);
            document.removeEventListener('contextmenu', blockContextMenu, true);
            const existingStyle = document.getElementById('drm-print-blocker');
            if (existingStyle) existingStyle.remove();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setErrorMsg('');

        const loadPdfStream = async () => {
            try {
                if (!realId) throw new Error("Invalid Book Identifier!");

                const encodedVal = encodeURIComponent(realId);

                // Prioritize specific streamUrl if available to avoid 404 waterfall
                const endpoints = book?.streamUrl
                    ? [book.streamUrl]
                    : [
                        `/api/author/book/view-pdf/${encodedVal}`,
                        `/api/journal/view-pdf/${encodedVal}`,
                        `/api/reader/stream-book/${encodedVal}`,
                        `/api/reader/reader/stream-book/${encodedVal}`
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
                    const safePage = Math.min(Math.max(1, startPage), pdf.numPages || 1);
                    setPageNumber(safePage);
                    setJumpPageInput(String(safePage));
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
            const viewport = page.getViewport({ scale: zoomScale });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = { canvasContext: context, viewport };
            renderTaskRef.current = page.render(renderContext);
            await renderTaskRef.current.promise;

            context.save();
            const fontSize = Math.max(18, Math.round(16 * (zoomScale || 1.35)));
            context.font = `900 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
            context.fillStyle = "rgba(190, 30, 45, 0.34)";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.rotate((-28 * Math.PI) / 180);

            const watermarkText = `USER ID: ${userEmail}  |  ${new Date().toLocaleDateString('en-IN')}  |  B. JAIN DRM`;
            const textMetrics = context.measureText(watermarkText);
            const stepX = Math.max(textMetrics.width + 110, 440);
            const stepY = 210;

            for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
                const rowOffset = (Math.abs(Math.round(y / stepY)) % 2) * (stepX / 2);
                for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
                    context.fillText(watermarkText, x + rowOffset, y);
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
    }, [pdfDoc, userEmail, zoomScale]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNumber);
            setJumpPageInput(pageNumber.toString());
        }
    }, [pdfDoc, pageNumber, renderPage]);

    useEffect(() => {
        if (!pdfDoc || !realId || numPages <= 0) return;
        if (book?.itemType === 'Journal' || (book?.streamUrl && book.streamUrl.includes('/journal/'))) return;

        const saveTimer = setTimeout(() => {
            fetch('/Reader/api/save-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: realId,
                    lastReadPage: pageNumber,
                    totalPages: numPages
                })
            }).catch(err => console.warn("Live progress save warning:", err));
        }, 500);

        return () => clearTimeout(saveTimer);
    }, [pdfDoc, realId, pageNumber, numPages, book]);

    const handleZoomIn = () => setZoomScale(prev => Math.min(Number((prev + 0.25).toFixed(2)), 3.0));
    const handleZoomOut = () => setZoomScale(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.6));
    const handleZoomReset = () => setZoomScale(1.35);

    const handleWheelScroll = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) handleZoomIn();
            else if (e.deltaY > 0) handleZoomOut();
            return;
        }

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
        <div
            onContextMenu={(e) => e.preventDefault()}
            className="fixed inset-0 bg-slate-950/95 z-[100] flex flex-col select-none overflow-hidden">
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

                    <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-700 ms-2">
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            disabled={zoomScale <= 0.6 || loading}
                            title="Zoom Out Page"
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-black rounded text-xs cursor-pointer">
                            −
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomReset}
                            title="Reset Zoom (100%)"
                            className="px-2 py-0.5 text-amber-400 font-bold text-[11px] min-w-[46px] text-center cursor-pointer">
                            {Math.round((zoomScale / 1.35) * 100)}%
                        </button>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            disabled={zoomScale >= 3.0 || loading}
                            title="Zoom In Page"
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-black rounded text-xs cursor-pointer">
                            +
                        </button>
                    </div>
                </div>

                <div className="hidden sm:block text-right">
                    <span className="text-[11px] text-slate-300 block font-mono">{userEmail}</span>
                </div>
            </div>

            <div
                ref={containerRef}
                onWheel={handleWheelScroll}
                className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-950 relative cursor-grab">
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
window.SecurePdfViewerModal = SecurePdfViewerModal;

// ----------------------------------------------------------------------
// MAIN APPLICATION COMPONENT WITH INTERNAL BROWSER HISTORY ROUTER
// ----------------------------------------------------------------------
function App() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAnnualBilling, setIsAnnualBilling] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState('login');

    const [profileDropdown, setProfileDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState('store');

    const [masterDropdownOpen, setMasterDropdownOpen] = useState(false);
    const [selectedMaster, setSelectedMaster] = useState('items');
    const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

  
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (!e.target.closest('[data-dropdown-container]')) {
                setProfileDropdown(false);
                setMasterDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, []);

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
    useEffect(() => {
        setCurrentPage(1);
        setAdminSearchTerm('');
    }, [selectedMaster, rowsPerPage]);
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
    const [storeJournals, setStoreJournals] = useState([]);
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
    const [singleBookCheckoutModal, setSingleBookCheckoutModal] = useState(null);
    const [singleBookPreviewData, setSingleBookPreviewData] = useState(null);
    const [isLoadingBookPreview, setIsLoadingBookPreview] = useState(false);
    const [suggestedBundlesForBook, setSuggestedBundlesForBook] = useState([]);
    const [expandedBundleId, setExpandedBundleId] = useState(null);
    const [selectedAccessDays, setSelectedAccessDays] = useState(365);
    const [isPurchasingSingleBook, setIsPurchasingSingleBook] = useState(false);

    const handleOpenSingleBookCheckoutWithSuggestion = async (bookObj) => {
        setSingleBookCheckoutModal(bookObj);
        setSingleBookPreviewData(null);
        setSuggestedBundlesForBook([]);
        setSelectedAccessDays(365);

        const targetId = bookObj?.id || bookObj?.Id;
        if (!targetId) return;

        setIsLoadingBookPreview(true);
        try {
            const res = await fetch(`/api/single-book/book-preview/${targetId}`);
            if (res.ok) {
                const details = await window.safeJsonParse(res);
                setSingleBookPreviewData(details);
                setSuggestedBundlesForBook(Array.isArray(details.matchingBundles) ? details.matchingBundles : []);
            }
        } catch (err) {
            console.warn("Book preview fetch warning:", err);
        } finally {
            setIsLoadingBookPreview(false);
        }
    };

    const handleConfirmSingleBookPurchase = async () => {
        if (!singleBookCheckoutModal) return;
        const targetId = singleBookCheckoutModal.id || singleBookCheckoutModal.Id;
        if (!targetId) return;

        setIsPurchasingSingleBook(true);
        try {
            const res = await fetch('/api/single-book/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: targetId,
                    validityDays: selectedAccessDays
                })
            });
            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) {
                triggerToast(data.message);
                const bookToOpen = singleBookCheckoutModal;
                setSingleBookCheckoutModal(null);
                setSingleBookPreviewData(null);
                setSuggestedBundlesForBook([]);
                saveReadingProgressToBackend(bookToOpen, 1);
                window.history.pushState({ modal: 'reader' }, '');
                setSelectedBookForDrm(bookToOpen);
            } else {
                triggerToast(data.message || "Purchase failed.", "error");
            }
        } catch (err) {
            triggerToast("Error: " + err.message, "error");
        } finally {
            setIsPurchasingSingleBook(false);
        }
    };

    const [purchasingBundleId, setPurchasingBundleId] = useState(null);

    const handleConfirmBundlePurchaseFromBook = async (bundleObj) => {
        if (!bundleObj || !bundleObj.bundleId) return;
        const currentBookId = singleBookCheckoutModal?.id || singleBookCheckoutModal?.Id || null;

        setPurchasingBundleId(bundleObj.bundleId);
        try {
            const res = await fetch('/api/single-book/purchase-bundle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bundleId: bundleObj.bundleId,
                    currentBookId: currentBookId,
                    validityDays: selectedAccessDays
                })
            });

            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) {
                triggerToast(data.message);
                const bookToOpen = singleBookCheckoutModal;
                setSingleBookCheckoutModal(null);
                setSingleBookPreviewData(null);
                setSuggestedBundlesForBook([]);
                setExpandedBundleId(null);

                if (bookToOpen) {
                    saveReadingProgressToBackend(bookToOpen, 1);
                    window.history.pushState({ modal: 'reader' }, '');
                    setSelectedBookForDrm(bookToOpen);
                }
            } else {
                triggerToast(data.message || "Bundle purchase failed.", "error");
            }
        } catch (err) {
            triggerToast("Error: " + err.message, "error");
        } finally {
            setPurchasingBundleId(null);
        }
    };

    const [viewingCustomerFullProfile, setViewingCustomerFullProfile] = useState(null);
    const [isLoadingCustomerFullProfile, setIsLoadingCustomerFullProfile] = useState(false);

    const handleOpenCustomerFullProfile = async (custRaw) => {
        const targetId = custRaw?.id || custRaw?.Id;
        if (!targetId) return;

        setIsLoadingCustomerFullProfile(true);
        try {
            const res = await fetch(`/api/admin/admin/customer-full-profile/${targetId}`);
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                setViewingCustomerFullProfile(data);
            } else {
                triggerToast("Customer ki full profile load nahi ho payi.", "error");
            }
        } catch (err) {
            triggerToast("Error loading profile: " + err.message, "error");
        } finally {
            setIsLoadingCustomerFullProfile(false);
        }
    };

    const [editingBook, setEditingBook] = useState(null);

    const [kwNameInput, setKwNameInput] = useState('');
    const [kwDescInput, setKwDescInput] = useState('');

    const [custNameInput, setCustNameInput] = useState('');
    const [custMobileInput, setCustMobileInput] = useState('');
    const [custEmailInput, setCustEmailInput] = useState('');
    const [custAddressInput, setCustAddressInput] = useState('');

    const [selectedBookForDrm, setSelectedBookForDrm] = useState(null);
    const [pendingBookForPlan, setPendingBookForPlan] = useState(null);
    const [hasEverPurchasedPlan, setHasEverPurchasedPlan] = useState(false);

    const checkUserPlanHistory = async () => {
        try {
            const [statusRes, memberRes] = await Promise.allSettled([
                fetch('/api/plan/my-subscription-status'),
                fetch('/api/plan/my-profile-membership')
            ]);

            if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
                const statusData = await window.safeJsonParse(statusRes.value);
                if (statusData?.hasActivePlan) {
                    setHasEverPurchasedPlan(true);
                    return true;
                }
            }

            if (memberRes.status === 'fulfilled' && memberRes.value.ok) {
                const memberData = await window.safeJsonParse(memberRes.value);
                if (Array.isArray(memberData?.plans) && memberData.plans.length > 0) {
                    setHasEverPurchasedPlan(true);
                    return true;
                }
            }
        } catch (err) {
            console.warn("Plan history check warning:", err);
        }
        return false;
    };

    const checkBookOwnership = async (targetBookId) => {
        if (!targetBookId) return false;
        const cleanTarget = String(targetBookId).toLowerCase().trim();

        try {
            const [accessRes, memberRes] = await Promise.allSettled([
                fetch(`/api/single-book/check-access/${encodeURIComponent(targetBookId)}`),
                fetch('/api/plan/my-profile-membership')
            ]);

            if (accessRes.status === 'fulfilled' && accessRes.value.ok) {
                const accessData = await window.safeJsonParse(accessRes.value);
                if (accessData?.hasAccess === true) return true;
            }

            if (memberRes.status === 'fulfilled' && memberRes.value.ok) {
                const memberData = await window.safeJsonParse(memberRes.value);

                if (Array.isArray(memberData?.plans)) {
                    for (const plan of memberData.plans) {
                        if (plan.isActive === false) continue;
                        const planBooks = Array.isArray(plan.books) ? plan.books : [];
                        if (planBooks.some(b => String(b.id || b.bookId || '').toLowerCase().trim() === cleanTarget)) {
                            return true;
                        }
                    }
                }

                if (Array.isArray(memberData?.bundles)) {
                    for (const bundle of memberData.bundles) {
                        const bundleBooks = Array.isArray(bundle.books) ? bundle.books : [];
                        if (bundleBooks.some(b => String(b.id || b.bookId || '').toLowerCase().trim() === cleanTarget)) {
                            return true;
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("Ownership check warning:", e);
        }

        return false;
    };

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
        if (bookObj.itemType === 'Journal' || (bookObj.streamUrl && bookObj.streamUrl.includes('/journal/'))) return;

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
            .then(res => res.ok ? window.safeJsonParse(res) : fetch('/api/reader/save-progress', {
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
    const isVendor = user.isLoggedIn && (
        user.role && user.role.toString().toLowerCase().includes('vendor')
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
            const res = await fetch('/api/plan/get-all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                setPlansList(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error("Fetch plans error:", e); }
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch('/api/category/all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                if (Array.isArray(data)) {
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
            }
        } catch (e) { console.error("Fetch categories error:", e); }
    };

    const fetchLanguagesMaster = async () => {
        try {
            const res = await fetch('/api/language/all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                if (Array.isArray(data)) {
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
            }
        } catch (e) { console.error("Fetch languages error:", e); }
    };

    const fetchKeywordsMaster = async () => {
        try {
            const res = await fetch('/api/keyword/all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                if (Array.isArray(data)) {
                    setKeywordsList(data.map(k => ({
                        id: k.id || k.Id || k.keywordCode || k.KeywordCode,
                        code: k.keywordCode || k.KeywordCode,
                        name: k.keywordName || k.KeywordName,
                        desc: k.description || k.Description || 'Core Search Term',
                        raw: k
                    })));
                }
            }
        } catch (e) { console.error("Fetch keywords error:", e); }
    };

    const fetchCustomersMaster = async () => {
        try {
            const res = await fetch('/api/admin/admin/customers-list');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                if (Array.isArray(data)) {
                    setCustomersList(data.map(c => ({
                        ...c,
                        id: c.id || c.Id || c.custId || c.CustId
                    })));
                }
            }
        } catch (e) { console.error("Fetch customers error:", e); }
    };

    const fetchAuthorsMaster = async () => {
        try {
            const res = await fetch('/api/authors/all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                if (Array.isArray(data)) {
                    setAuthorsList(data.map(a => ({
                        id: a.id || a.Id,
                        name: a.authorName || a.AuthorName || a.name || a.Name,
                        desc: `Created: ${new Date(a.createdAt || a.CreatedAt || Date.now()).toLocaleDateString()}`,
                        raw: a
                    })));
                }
            }
        } catch (e) { console.error("Fetch authors error:", e); }
    };

    const fetchVendorsMaster = async () => {
        try {
            const res = await fetch('/api/vendor/get-all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                setVendorsList(Array.isArray(data) ? data : []);
            }
        } catch (e) { console.error("Fetch vendors error:", e); }
    };

    const fetchStoreBooks = async () => {
        setLoadingBooks(true);
        try {
            const res = await fetch('/api/reader/catalog/all-books');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                setStoreBooks(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error("Fetch store books error:", e);
        } finally {
            setLoadingBooks(false);
        }
    };

    const fetchStoreJournals = async () => {
        try {
            const res = await fetch('/api/journal/all');
            if (res.ok) {
                const data = await window.safeJsonParse(res);
                const activeOnly = Array.isArray(data) ? data.filter(j => j.isActive !== false) : [];
                setStoreJournals(activeOnly);
            }
        } catch (e) {
            console.error("Fetch store journals error:", e);
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
            if (res.ok) data = await window.safeJsonParse(res);

            if (!Array.isArray(data) || data.length === 0) {
                const fallbackRes = await fetch('/api/reader/catalog/all-books');
                if (fallbackRes.ok) data = await window.safeJsonParse(fallbackRes);
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

    const handleReadAccess = async (bookObj) => {
        if (!user.isLoggedIn) {
            setPendingBookForPlan(bookObj);
            openAuthModal('login');
            return;
        }

        if (isAdmin) {
            saveReadingProgressToBackend(bookObj, 1);
            window.history.pushState({ modal: 'reader' }, '');
            setSelectedBookForDrm(bookObj);
            return;
        }

        const targetId = bookObj.id || bookObj.Id || bookObj.bookId;
        const isOwned = await checkBookOwnership(targetId);

        if (isOwned) {
            saveReadingProgressToBackend(bookObj, 1);
            window.history.pushState({ modal: 'reader' }, '');
            setSelectedBookForDrm(bookObj);
            return;
        }

        const hasPlanHistory = hasEverPurchasedPlan || await checkUserPlanHistory();
        if (!hasPlanHistory) {
            setPendingBookForPlan(bookObj);
            changeNavState({ activeTab: 'user-plans' });
            triggerToast("You Don't have this book please Purchase the plane!");
            return;
        }

        triggerToast("You don't have this book in your bundle and Subscription plane .", "error");
        handleOpenSingleBookCheckoutWithSuggestion(bookObj);
    };

    
    useEffect(() => {
        let isMounted = true;

        const initAppFast = async () => {
            await Promise.allSettled([
                fetchStoreBooks(),
                fetchStoreJournals(),
                fetchCategories(),
                fetchPlansMaster(),
                fetchLanguagesMaster(),
                fetch('/api/account/me')
                    .then(res => res.ok ? window.safeJsonParse(res) : null)
                    .then(data => {
                        if (!isMounted) return;
                        if (data && data.email && localStorage.getItem('isExplicitLogin') === 'true') {
                            const primaryRole = data.roles && data.roles.includes('Vendor')
                                ? 'Vendor'
                                : (data.roles && data.roles.length > 0 ? data.roles[0] : 'Reader');
                            setUser({
                                isLoggedIn: true,
                                fullName: data.fullName || data.email.split('@')[0],
                                email: data.email,
                                role: primaryRole
                            });
                            checkUserPlanHistory();
                        } else {
                            setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
                        }
                    })
                    .catch(() => {
                        if (isMounted) setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
                    })
            ]);
        };

        initAppFast();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        if (!user.isLoggedIn || storeBooks.length === 0) return;

        const params = new URLSearchParams(window.location.search);
        const readBookId = params.get('readBookId');
        const targetPage = parseInt(params.get('page') || '1', 10) || 1;

        if (readBookId) {
            const matchedBook = storeBooks.find(b =>
                String(b.id || b.Id || b.itemNo || b.bookId) === String(readBookId)
            );

            if (matchedBook) {
                const bookWithStartPage = { ...matchedBook, initialPage: targetPage };
                saveReadingProgressToBackend(matchedBook, targetPage);
                setSelectedBookForDrm(bookWithStartPage);
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
    }, [user.isLoggedIn, storeBooks]);

    useEffect(() => {
        setSelectedMasterIds([]);
        if (!isAdmin) return;

        if (selectedMaster === 'customers') fetchCustomersMaster();
        else if (selectedMaster === 'plans') fetchPlansMaster();
        else if (selectedMaster === 'authors') fetchAuthorsMaster();
        else if (selectedMaster === 'categories') fetchCategories();
        else if (selectedMaster === 'languages') fetchLanguagesMaster();
        else if (selectedMaster === 'keywords') fetchKeywordsMaster();
        else if (selectedMaster === 'vendors') fetchVendorsMaster();
        else if (selectedMaster === 'items') {
            Promise.allSettled([fetchAuthorBooks(), fetchVendorsMaster(), fetchAuthorsMaster()]);
        }
    }, [selectedMaster, isAdmin]);

    useEffect(() => {
        if (user.isLoggedIn && isAdmin && activeTab === 'admin') {
            Promise.allSettled([
                fetchAuthorBooks(),
                fetchAuthorsMaster(),
                fetchCategories(),
                fetchLanguagesMaster()
            ]);
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

            const data = await window.safeJsonParse(res);

            if (res.ok && (data.success !== false)) {
                triggerToast(data.message || `Book '${itemName}' approved & live on Store Catalogue!`);
                await Promise.allSettled([fetchAuthorBooks(), fetchStoreBooks()]);
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

            const data = await window.safeJsonParse(res);
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

            const data = await window.safeJsonParse(res);
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

            const data = await window.safeJsonParse(res);
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

            const data = await window.safeJsonParse(res);
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

            const data = await window.safeJsonParse(res);
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
                    `/api/author/book/delete/${encodedVal}`
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

        setDeleteConfirmModal({ show: false, id: null, ids: [], title: '', type: '' });
        setSelectedMasterIds([]);

        if (successCount > 0) {
            triggerToast(`${successCount} record(s) deleted successfully!`);

            if (selectedMaster === 'items') {
                await Promise.allSettled([fetchAuthorBooks(), fetchStoreBooks()]);
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

            const data = await window.safeJsonParse(res);
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

            const data = await window.safeJsonParse(res);
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
            ? { email: emailInput.trim(), password: passwordInput }
            : {
                fullName: fullNameInput.trim(),
                email: emailInput.trim(),
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

            const data = await window.safeJsonParse(response);
            if (response.ok) {
                if (authMode === 'register') {
                    setAuthSuccessMsg('Registration successful! Please sign in now.');
                    setAuthMode('login');
                    setPasswordInput('');
                    changeNavState({ activeTab: 'store' });
                } else {
                    const rolesLower = Array.isArray(data.roles) ? data.roles.map(r => r.toLowerCase()) : [];
                    const assignedRole = rolesLower.includes('admin')
                        ? 'Admin'
                        : rolesLower.includes('vendor')
                            ? 'Vendor'
                            : (data.roles && data.roles.length > 0 ? data.roles[0] : 'Reader');
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
                    checkUserPlanHistory();
                    setIsAuthOpen(false);
                    setEmailInput('');
                    setPasswordInput('');

                    if (assignedRole.toLowerCase() === 'vendor') {
                        changeNavState({ activeTab: 'vendor-profile' });
                    }

                    triggerToast(`Welcome back, ${data.fullName || 'User'}!`);
                }
            } else {
                setAuthError(Array.isArray(data) ? data.map(err => err.description || err).join(', ') : (data.message || `Authentication failed (${response.status}).`));
            }
        } catch (err) {
            setAuthError('Connection error: ' + err.message);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccessMsg('');

        if (newPasswordInput !== confirmPasswordInput) {
            setAuthError("New Password and Confirm Password do not match  .");
            return;
        }

        setAuthLoading(true);

        try {
            const response = await fetch('/api/account/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: forgotEmailInput.trim(),
                    newPassword: newPasswordInput,
                    confirmPassword: confirmPasswordInput
                })
            });

            const data = await window.safeJsonParse(response);
            if (response.ok) {
                triggerToast(data.message || "Password  reset successfully !");
                setAuthMode('login');
                setEmailInput(forgotEmailInput);
                setForgotEmailInput('');
                setNewPasswordInput('');
                setConfirmPasswordInput('');
            } else {
                setAuthError(data.message || `Failed to reset password (${response.status}).`);
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
        localStorage.removeItem('sessionToken');
        window.clearApiCache();
        setUser({ isLoggedIn: false, fullName: '', email: '', role: '' });
        changeNavState({ activeTab: 'store' });
        setProfileDropdown(false);
        triggerToast("Signed out successfully!");
    };

    const getMasterRenderData = () => {
        switch (selectedMaster) {
            case 'items':
                return myAuthorBooks.map(b => {
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
            case 'bundles':
                return { title: 'BUNDLE LIST', buttonText: '' };
            case 'authors':
                return { title: 'AUTHOR LIST', buttonText: 'Add Author' };
            case 'categories':
                return { title: 'CATEGORIES LIST', buttonText: 'Add Category' };
            case 'languages':
                return { title: 'LANGUAGE LIST', buttonText: 'Add Language' };
            case 'keywords':
                return { title: 'KEYWORD LIST', buttonText: 'Add Keyword' };
            case 'customers':
                return { title: 'CUSTOMER LIST' };
            case 'items':
            default:
                return { title: 'BOOK LIST', buttonText: 'Add Item' };
        }
    };

    const currentMasterData = getMasterRenderData();
    const currentHeaderConfig = getMasterHeaderConfig();

    const filteredStoreBooks = storeBooks.filter(b => {
        const itemName = b.itemName || b.ItemName || '';
        const author = b.author || b.Author || b.authorName || b.AuthorName || '';
        const categoryCode = b.categoryCode || b.CategoryCode || '';
        const categoryName = getBookCategoryName(b);

        if (selectedCategoryFilter && selectedCategoryFilter !== 'All') {
            const catFilterLower = selectedCategoryFilter.toLowerCase();
            const matchesCat =
                categoryCode.toLowerCase().includes(catFilterLower) ||
                categoryName.toLowerCase().includes(catFilterLower);
            if (!matchesCat) return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return itemName.toLowerCase().includes(q) || author.toLowerCase().includes(q) || categoryCode.toLowerCase().includes(q);
    });

    const scrollToHomeSection = (sectionId) => {
        if (activeTab !== 'store') {
            changeNavState({ activeTab: 'store' });
            setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
            }, 150);
        } else {
            const el = document.getElementById(sectionId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const filteredStoreJournals = storeJournals.filter(j => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (j.name || '').toLowerCase().includes(q) ||
            (j.publisherName || '').toLowerCase().includes(q) ||
            (j.issn || '').toLowerCase().includes(q) ||
            (j.categoryName || '').toLowerCase().includes(q);
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
    const PlatformRevenueMasterComp = typeof window.PlatformRevenueMaster !== 'undefined' ? window.PlatformRevenueMaster : (typeof PlatformRevenueMaster !== 'undefined' ? PlatformRevenueMaster : null);
    const JournalMasterComp = typeof window.JournalMaster !== 'undefined' ? window.JournalMaster : (typeof JournalMaster !== 'undefined' ? JournalMaster : null);



    return (
        <div className="min-h-screen flex flex-col bg-gray-100 text-slate-800 w-full overflow-x-hidden relative">

            {toast.show && (
                <div className={`fixed top-5 right-5 z-[100] px-5 py-3 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-3 transition-all transform animate-bounce ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                    <i className={`fa-solid ${toast.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'} text-base`}></i>
                    <span>{toast.message}</span>
                </div>
            )}

            {/* TOP ANNOUNCEMENT BAR */}
            <div className="bg-navyDark text-white px-4 py-2 text-xs font-medium border-b border-white/10">
                <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
                    <span className="flex items-center space-x-2 mx-auto md:mx-0">
                        <span className="bg-emeraldPrimary/20 text-emeraldPrimary px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Official Portal</span>
                        <span>Trusted by 60,000+ Homeopaths Worldwide | <strong>www.bjainrx.com</strong></span>
                    </span>
                    <div className="hidden md:flex items-center space-x-6 text-xs text-slate-300">
                        <button type="button" onClick={() => scrollToHomeSection('about-us')} className="hover:text-emeraldPrimary transition cursor-pointer">About BJainRx</button>
                        <button type="button" onClick={() => scrollToHomeSection('plans')} className="hover:text-emeraldPrimary transition cursor-pointer">Subscriptions</button>
                        <button type="button" onClick={() => scrollToHomeSection('contact')} className="hover:text-emeraldPrimary transition cursor-pointer"><i className="fa-solid fa-headset mr-1"></i> Support</button>
                    </div>
                </div>
            </div>

            {/* MAIN HEADER NAVIGATION */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm w-full">
                <div className="w-full px-4 sm:px-8 lg:px-12">
                    <div className="flex items-center justify-between h-20 gap-3">

                        {/* Brand Logo */}
                        <div
                            onClick={() => { setSelectedCategoryFilter('All'); changeNavState({ activeTab: 'store' }); }}
                            className="flex items-center space-x-3 cursor-pointer shrink-0">
                            <div className="w-11 h-11 rounded-xl bg-navyDark flex items-center justify-center text-white shadow-md border border-emeraldPrimary/30">
                                <i className="fa-solid fa-book-medical text-emeraldPrimary text-2xl"></i>
                            </div>
                            <div>
                                <div className="flex items-center">
                                    <span className="text-2xl font-extrabold text-navyDark tracking-tight">B.Jain</span>
                                    <span className="text-2xl font-black text-emeraldPrimary tracking-wide">Rx</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Digital Homeopathy Library</p>
                            </div>
                        </div>

                        {/* Navigation Links */}
                        <nav className="hidden xl:flex items-center space-x-6 text-sm font-semibold text-slate-700">
                            <button
                                type="button"
                                onClick={() => { setSelectedCategoryFilter('All'); changeNavState({ activeTab: 'store' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                className={`transition cursor-pointer ${activeTab === 'store' ? 'text-emeraldPrimary font-bold' : 'hover:text-emeraldPrimary'}`}>
                                Home
                            </button>
                            <button type="button" onClick={() => scrollToHomeSection('about-us')} className="hover:text-emeraldPrimary transition cursor-pointer">About Us</button>

                            {/* Categories Dropdown */}
                            <div className="relative group">
                                <button type="button" onClick={() => scrollToHomeSection('catalog-section')} className="hover:text-emeraldPrimary transition flex items-center py-2 cursor-pointer">
                                    <span>Book Categories</span>
                                    <i className="fa-solid fa-chevron-down ml-1.5 text-xs text-slate-400 group-hover:text-emeraldPrimary transition"></i>
                                </button>
                                <div className="absolute left-0 top-full hidden group-hover:block w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 text-xs space-y-1 z-50">
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedCategoryFilter('All'); scrollToHomeSection('catalog-section'); }}
                                        className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary cursor-pointer">
                                        All Publications ({storeBooks.length})
                                    </button>
                                    {categoriesList.length > 0 ? categoriesList.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => { setSelectedCategoryFilter(cat.categoryName); scrollToHomeSection('catalog-section'); }}
                                            className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary cursor-pointer">
                                            {cat.categoryName}
                                        </button>
                                    )) : (
                                        <>
                                            <button type="button" onClick={() => { setSelectedCategoryFilter('Materia Medica'); scrollToHomeSection('catalog-section'); }} className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary">Materia Medica</button>
                                            <button type="button" onClick={() => { setSelectedCategoryFilter('Repertory'); scrollToHomeSection('catalog-section'); }} className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary">Repertory & Rubrics</button>
                                            <button type="button" onClick={() => { setSelectedCategoryFilter('Organon'); scrollToHomeSection('catalog-section'); }} className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary">Organon & Philosophy</button>
                                            <button type="button" onClick={() => { setSelectedCategoryFilter('Clinical'); scrollToHomeSection('catalog-section'); }} className="w-full text-left block px-3 py-2 rounded-xl hover:bg-emeraldLight text-slate-700 font-semibold hover:text-emeraldPrimary">Clinical Therapeutics</button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    if (user.isLoggedIn && !isAdmin) changeNavState({ activeTab: 'user-plans' });
                                    else scrollToHomeSection('plans');
                                }}
                                className={`transition cursor-pointer ${activeTab === 'user-plans' ? 'text-emeraldPrimary font-bold' : 'hover:text-emeraldPrimary'}`}>
                                Plans & Pricing
                            </button>
                            <button type="button" onClick={() => scrollToHomeSection('services')} className="hover:text-emeraldPrimary transition cursor-pointer">Services</button>
                            <button type="button" onClick={() => scrollToHomeSection('contact')} className="hover:text-emeraldPrimary transition cursor-pointer">Contact Us</button>

                            {isVendor && (
                                <button
                                    type="button"
                                    onClick={() => changeNavState({ activeTab: 'vendor-profile' })}
                                    className="text-xs bg-purple-50 hover:bg-purple-100 text-publisherPurple font-bold px-3 py-1.5 rounded-lg transition border border-publisherPurple/20 cursor-pointer">
                                    <i className="fa-solid fa-feather-pointed mr-1"></i> Vendor Portal
                                </button>
                            )}

                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => changeNavState({ activeTab: 'admin' })}
                                    className="text-xs bg-navyDark hover:bg-navyDeep text-white font-bold px-3 py-1.5 rounded-lg transition border border-goldAccent/40 cursor-pointer">
                                    <i className="fa-solid fa-user-shield mr-1 text-goldAccent"></i> Admin CRM
                                </button>
                            )}
                        </nav>

                        {/* Search Bar (Compact Desktop) */}
                        <div className="hidden md:flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 w-56 focus-within:w-64 focus-within:border-emeraldPrimary focus-within:bg-white transition-all">
                            <i className="fa-solid fa-magnifying-glass text-slate-400 text-xs mr-2"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (activeTab !== 'store') changeNavState({ activeTab: 'store' });
                                }}
                                placeholder="Search books, authors..."
                                className="w-full text-xs bg-transparent outline-none text-slate-800"
                            />
                        </div>

                        {/* Action Items / Auth Buttons */}
                        <div className="flex items-center space-x-2.5 shrink-0">
                            {!user.isLoggedIn ? (
                                <div className="flex items-center space-x-2">
                                    <button
                                        type="button"
                                        onClick={() => openAuthModal('login')}
                                        className="text-xs font-bold text-navyDark hover:text-emeraldPrimary px-3.5 py-2.5 rounded-xl transition cursor-pointer">
                                        Sign In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openAuthModal('register')}
                                        className="bg-emeraldPrimary hover:bg-emeraldHover text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-md shadow-emeraldPrimary/20 cursor-pointer">
                                        Get Started
                                    </button>
                                </div>
                            ) : (
                                <div className="relative flex items-center space-x-2" data-dropdown-container="profile">
                                    {!isAdmin && !isVendor && (
                                        <button
                                            type="button"
                                            onClick={() => changeNavState({ activeTab: 'reader-profile' })}
                                            className="hidden sm:flex bg-emeraldLight hover:bg-emeraldPrimary hover:text-white text-emeraldPrimary px-3 py-2 rounded-xl text-xs font-bold transition items-center cursor-pointer">
                                            <i className="fa-solid fa-book-bookmark mr-1.5"></i> My Library
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setProfileDropdown(!profileDropdown)}
                                        className="flex items-center gap-2 p-1.5 pr-3 rounded-xl border border-slate-200 hover:border-emeraldPrimary bg-slate-50 transition text-left cursor-pointer">
                                        <div className="w-8 h-8 rounded-lg bg-navyDark flex items-center justify-center text-emeraldPrimary font-extrabold text-xs shadow">
                                            {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                                        </div>
                                        <div className="hidden md:block">
                                            <div className="text-xs font-bold text-navyDark leading-tight">{user.fullName}</div>
                                            <div className="text-[9px] font-black uppercase text-emeraldPrimary">{user.role}</div>
                                        </div>
                                        <i className="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
                                    </button>

                                    {profileDropdown && (
                                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 text-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs">
                                            {!isAdmin && !isVendor && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setProfileDropdown(false); changeNavState({ activeTab: 'reader-profile' }); }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-emeraldLight text-slate-800 font-bold flex items-center gap-2 cursor-pointer">
                                                        <i className="fa-solid fa-user text-emeraldPrimary"></i> My Profile & Library
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setProfileDropdown(false); changeNavState({ activeTab: 'user-plans' }); }}
                                                        className="w-full text-left px-4 py-2.5 hover:bg-emeraldLight text-slate-800 font-bold flex items-center gap-2 border-b border-slate-100 cursor-pointer">
                                                        <i className="fa-solid fa-crown text-goldAccent"></i> Subscription Plans
                                                    </button>
                                                </>
                                            )}
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setProfileDropdown(false); changeNavState({ activeTab: 'admin' }); }}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-slate-100 text-navyDark font-bold flex items-center gap-2 border-b border-slate-100 cursor-pointer">
                                                    <i className="fa-solid fa-user-shield text-goldAccent"></i> Admin Dashboard
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleLogout}
                                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-bold flex items-center gap-2 cursor-pointer">
                                                <i className="fa-solid fa-right-from-bracket"></i> Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mobile Menu Trigger */}
                            <button
                                type="button"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                className="xl:hidden p-2 text-slate-700 hover:text-emeraldPrimary">
                                <i className="fa-solid fa-bars text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Drawer Navigation */}
                {mobileMenuOpen && (
                    <div className="xl:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-2 shadow-xl text-xs">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search publications..."
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl mb-2"
                        />
                        <button type="button" onClick={() => { changeNavState({ activeTab: 'store' }); setMobileMenuOpen(false); }} className="block w-full text-left font-bold text-navyDark py-2">Home</button>
                        <button type="button" onClick={() => { scrollToHomeSection('catalog-section'); setMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-slate-700 py-2">Book Catalog</button>
                        <button type="button" onClick={() => { scrollToHomeSection('about-us'); setMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-slate-700 py-2">About Us</button>
                        <button type="button" onClick={() => { scrollToHomeSection('plans'); setMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-slate-700 py-2">Plans & Pricing</button>
                        <button type="button" onClick={() => { scrollToHomeSection('services'); setMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-slate-700 py-2">Services</button>
                        <button type="button" onClick={() => { scrollToHomeSection('contact'); setMobileMenuOpen(false); }} className="block w-full text-left font-semibold text-slate-700 py-2">Contact Us</button>
                        {isAdmin && (
                            <button type="button" onClick={() => { changeNavState({ activeTab: 'admin' }); setMobileMenuOpen(false); }} className="block w-full text-left font-bold text-navyDark py-2">Admin CRM Dashboard</button>
                        )}
                    </div>
                )}
            </header>

            <div className={activeTab === 'store' ? 'w-full flex-1' : 'w-full px-3 sm:px-6 lg:px-10 py-6 flex-1 space-y-6'}>
                {activeTab === 'admin' && isAdmin && (() => {
                    const masterMenuItems = [
                        { key: 'items', label: 'Items Master', icon: 'fa-box', badge: myAuthorBooks.length },
                        { key: 'plans', label: 'Plans Master', icon: 'fa-credit-card', badge: plansList.length },
                        { key: 'bundles', label: 'Bundle Master', icon: 'fa-layer-group' },
                        { key: 'single-books', label: 'Single Book Master', icon: 'fa-book-open-reader' },
                        { key: 'authors', label: 'Authors', icon: 'fa-user-pen', badge: authorsList.length },
                        { key: 'categories', label: 'Categories', icon: 'fa-tags', badge: categoriesList.length },
                        { key: 'languages', label: 'Languages', icon: 'fa-language', badge: languagesList.length },
                        { key: 'keywords', label: 'Keywords', icon: 'fa-key', badge: keywordsList.length },
                        { key: 'customers', label: 'Customers', icon: 'fa-users', badge: customersList.length },
                        { key: 'vendors', label: 'Vendor Master', icon: 'fa-user-gear', badge: vendorsList.length },
                        { key: 'platform-revenue', label: 'Platform Revenue (70%)', icon: 'fa-vault' },
                        { key: 'journals', label: 'Journal Master', icon: 'fa-newspaper', badge: storeJournals.length }
                    ];

                    const searchedData = currentMasterData.filter(item => {
                        if (!adminSearchTerm.trim()) return true;
                        const q = adminSearchTerm.toLowerCase();
                        return String(item.id || '').toLowerCase().includes(q) ||
                            String(item.name || '').toLowerCase().includes(q) ||
                            String(item.desc || '').toLowerCase().includes(q) ||
                            String(item.emailId || '').toLowerCase().includes(q);
                    });

                    const totalPages = Math.max(1, Math.ceil(searchedData.length / rowsPerPage));
                    const safePage = Math.min(currentPage, totalPages);
                    const paginatedData = searchedData.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);
                    const pendingBooksCount = myAuthorBooks.filter(b => !b.isPublished).length;

                    return (
                        <div className="w-full flex flex-col lg:flex-row gap-5 items-start">

                            {/* MOBILE OVERLAY BACKDROP */}
                            {adminSidebarOpen && (
                                <div
                                    onClick={() => setAdminSidebarOpen(false)}
                                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden"
                                />
                            )}

                            {/* LEFT INDUSTRY SIDEBAR */}
                            <aside className={`fixed lg:sticky top-0 lg:top-24 left-0 z-50 lg:z-20 h-full lg:h-[calc(100vh-7rem)] w-72 lg:w-64 shrink-0 bg-[#0B1325] text-white lg:rounded-2xl shadow-xl border border-slate-800 flex flex-col transition-transform duration-300 ${adminSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-[#00A884]/20 border border-[#00A884]/40 flex items-center justify-center text-[#00A884]">
                                            <i className="fa-solid fa-shield-halved text-sm"></i>
                                        </div>
                                        <div>
                                            <span className="text-xs font-black tracking-wide uppercase block text-white">Admin Console</span>
                                            <span className="text-[10px] text-[#D4AF37] font-bold">BJainRx Enterprise</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setAdminSidebarOpen(false)}
                                        className="lg:hidden text-slate-400 hover:text-white p-1.5">
                                        <i className="fa-solid fa-xmark text-base"></i>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                                        Master Modules
                                    </div>
                                    {masterMenuItems.map(m => {
                                        const isActive = selectedMaster === m.key;
                                        return (
                                            <button
                                                key={m.key}
                                                type="button"
                                                onClick={() => {
                                                    changeNavState({
                                                        selectedMaster: m.key,
                                                        bookPageMode: 'list',
                                                        authorPageMode: 'list',
                                                        categoryPageMode: 'list',
                                                        languagePageMode: 'list',
                                                        planPageMode: 'list'
                                                    });
                                                    setAdminSidebarOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${isActive
                                                    ? 'bg-[#00A884] text-white shadow-md shadow-[#00A884]/20'
                                                    : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
                                                <span className="flex items-center gap-2.5 truncate">
                                                    <i className={`fa-solid ${m.icon} w-4 text-center ${isActive ? 'text-white' : 'text-slate-400'}`}></i>
                                                    <span className="truncate">{m.label}</span>
                                                </span>
                                                {m.badge !== undefined && (
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                                        {m.badge}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </aside>

                            {/* RIGHT MAIN WORKSPACE */}
                            <div className="flex-1 min-w-0 w-full space-y-5">

                                {/* TOP HEADER BAR */}
                                <div className="bg-gradient-to-r from-[#0B1325] via-[#132240] to-[#0B1325] text-white p-4 sm:p-6 rounded-2xl shadow-md border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setAdminSidebarOpen(true)}
                                            className="lg:hidden bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-xl border border-white/15 cursor-pointer">
                                            <i className="fa-solid fa-bars text-base"></i>
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h1 className="text-lg sm:text-2xl font-black tracking-tight">Admin Dashboard</h1>
                                                <span className="hidden sm:inline-block bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                                                    CRM Control
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-300 mt-0.5">Manage catalog, masters, approvals, and revenue in real time.</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            window.clearApiCache();
                                            Promise.allSettled([fetchAuthorBooks(), fetchCustomersMaster(), fetchAuthorsMaster(), fetchCategories(), fetchPlansMaster()]);
                                            triggerToast("Dashboard data refreshed!");
                                        }}
                                        className="bg-white/10 hover:bg-[#00A884] text-white font-bold px-4 py-2 rounded-xl text-xs border border-white/15 transition flex items-center gap-2 cursor-pointer self-end sm:self-auto">
                                        <i className="fa-solid fa-arrows-rotate"></i> Sync Live Data
                                    </button>
                                </div>

                                {/* RESPONSIVE KPI SUMMARY CARDS */}
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                                    <div onClick={() => changeNavState({ selectedMaster: 'items', bookPageMode: 'list' })} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#00A884] transition cursor-pointer flex items-center justify-between">
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Books</span>
                                            <div className="text-xl sm:text-2xl font-black text-[#0B1325] mt-0.5">{myAuthorBooks.length}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00A884] flex items-center justify-center text-lg">
                                            <i className="fa-solid fa-book"></i>
                                        </div>
                                    </div>

                                    <div onClick={() => changeNavState({ selectedMaster: 'items', bookPageMode: 'list' })} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 transition cursor-pointer flex items-center justify-between">
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Pending Approval</span>
                                            <div className="text-xl sm:text-2xl font-black text-amber-600 mt-0.5">{pendingBooksCount}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                                            <i className="fa-solid fa-clock"></i>
                                        </div>
                                    </div>

                                    <div onClick={() => changeNavState({ selectedMaster: 'authors', authorPageMode: 'list' })} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-500 transition cursor-pointer flex items-center justify-between">
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Authors</span>
                                            <div className="text-xl sm:text-2xl font-black text-[#0B1325] mt-0.5">{authorsList.length}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                                            <i className="fa-solid fa-user-pen"></i>
                                        </div>
                                    </div>

                                    <div onClick={() => changeNavState({ selectedMaster: 'customers' })} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-500 transition cursor-pointer flex items-center justify-between">
                                        <div>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">Readers / Users</span>
                                            <div className="text-xl sm:text-2xl font-black text-[#0B1325] mt-0.5">{customersList.length}</div>
                                        </div>
                                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                                            <i className="fa-solid fa-users"></i>
                                        </div>
                                    </div>
                                </div>

                                {/* ACTION TOOLBAR + LIVE SEARCH BAR */}
                                {selectedMaster !== 'vendors' && selectedMaster !== 'journals' && selectedMaster !== 'platform-revenue' && (
                                    <div className="w-full bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="text-xs font-black uppercase text-[#0B1325] flex items-center gap-1.5 mr-1">
                                                <i className="fa-solid fa-list-check text-[#00A884]"></i> {currentHeaderConfig.title}
                                            </span>

                                            {selectedMaster !== 'bundles' && selectedMaster !== 'customers' && selectedMaster !== 'single-books' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (selectedMaster === 'items') changeNavState({ bookPageMode: 'add-book-page' });
                                                        else if (selectedMaster === 'authors') changeNavState({ authorPageMode: 'add-author-page' });
                                                        else if (selectedMaster === 'categories') changeNavState({ categoryPageMode: 'add-category-page' });
                                                        else if (selectedMaster === 'languages') changeNavState({ languagePageMode: 'add-language-page' });
                                                        else if (selectedMaster === 'plans') changeNavState({ planPageMode: 'add-plan-page' });
                                                        else setShowAddModal(true);
                                                    }}
                                                    className="bg-[#00A884] hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-plus"></i> {currentHeaderConfig.buttonText}
                                                </button>
                                            )}

                                            {selectedMaster === 'items' && (
                                                <button type="button" onClick={() => changeNavState({ bookPageMode: 'bulk-grid-page' })} className="bg-[#0B1325] hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-file-excel text-[#00A884]"></i> Bulk Upload Books
                                                </button>
                                            )}
                                            {selectedMaster === 'authors' && (
                                                <button type="button" onClick={() => changeNavState({ authorPageMode: 'bulk-author-grid-page' })} className="bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-file-excel"></i> Bulk Upload Authors
                                                </button>
                                            )}
                                            {selectedMaster === 'categories' && (
                                                <button type="button" onClick={() => changeNavState({ categoryPageMode: 'bulk-category-grid-page' })} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-file-excel"></i> Bulk Upload Categories
                                                </button>
                                            )}
                                            {selectedMaster === 'languages' && (
                                                <button type="button" onClick={() => changeNavState({ languagePageMode: 'bulk-language-grid-page' })} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-file-excel"></i> Bulk Upload Languages
                                                </button>
                                            )}

                                            {selectedMasterIds.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteConfirmModal({
                                                        show: true,
                                                        id: null,
                                                        ids: selectedMasterIds,
                                                        title: `${selectedMasterIds.length} Selected Record(s)`,
                                                        type: selectedMaster
                                                    })}
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer">
                                                    <i className="fa-solid fa-trash-can"></i> Delete ({selectedMasterIds.length})
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                            <div className="relative flex-1 sm:w-56">
                                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                                <input
                                                    type="text"
                                                    value={adminSearchTerm}
                                                    onChange={e => { setAdminSearchTerm(e.target.value); setCurrentPage(1); }}
                                                    placeholder={`Filter ${selectedMaster}...`}
                                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#00A884] focus:bg-white font-medium"
                                                />
                                            </div>

                                            <select
                                                value={rowsPerPage}
                                                onChange={e => setRowsPerPage(Number(e.target.value))}
                                                className="border border-slate-200 rounded-xl px-3 py-2 font-bold bg-slate-50 outline-none cursor-pointer">
                                                <option value={5}>5 / page</option>
                                                <option value={10}>10 / page</option>
                                                <option value={25}>25 / page</option>
                                                <option value={50}>50 / page</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* SUB-PAGES & MASTER COMPONENTS */}
                                {(selectedMaster === 'vendors') ? (
                                    VendorMasterComp ? <VendorMasterComp booksList={myAuthorBooks} triggerToast={triggerToast} isVendorSelfView={false} /> : <div>Vendor Master Component Not Loaded</div>
                                ) : (selectedMaster === 'journals') ? (
                                    JournalMasterComp ? <JournalMasterComp categoriesList={categoriesList} languagesList={languagesList} authorsList={authorsList} vendorsList={vendorsList} triggerToast={triggerToast} /> : <div className="p-6 text-center font-bold">Journal Master Component Not Loaded</div>
                                ) : (selectedMaster === 'platform-revenue') ? (
                                    PlatformRevenueMasterComp ? <PlatformRevenueMasterComp triggerToast={triggerToast} /> : <div className="p-6 text-center font-bold">Platform Revenue Component Not Loaded</div>
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
                                            onSuccess={(msg) => { triggerToast(msg); fetchAuthorBooks(); fetchStoreBooks(); window.history.back(); }}
                                            onCancel={() => window.history.back()}
                                        />
                                    ) : null
                                ) : selectedMaster === 'items' && bookPageMode === 'bulk-grid-page' ? (
                                    <div className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-3">
                                            <button type="button" onClick={() => changeNavState({ bookPageMode: 'list' })} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer">
                                                <i className="fa-solid fa-arrow-left"></i>
                                            </button>
                                            <h3 className="text-lg sm:text-xl font-bold text-[#0d233a]">Excel-Style Bulk Upload Page</h3>
                                        </div>
                                        <BulkGridFormContainer
                                            categoriesList={categoriesList}
                                            languagesList={languagesList}
                                            authorsList={authorsList}
                                            vendorsList={vendorsList}
                                            onSuccess={async (msg) => { triggerToast(msg); await fetchAuthorBooks(); await fetchStoreBooks(); changeNavState({ bookPageMode: 'list' }); }}
                                            onCancel={() => changeNavState({ bookPageMode: 'list' })}
                                        />
                                    </div>
                                ) : selectedMaster === 'items' && bookPageMode === 'edit-book-page' ? (
                                    EditBookFormComp ? (
                                        <EditBookFormComp
                                            editingBook={editingBook}
                                            languagesList={languagesList}
                                            onSuccess={(msg) => { triggerToast(msg); setEditingBook(null); fetchAuthorBooks(); fetchStoreBooks(); window.history.back(); }}
                                            onCancel={() => { setEditingBook(null); window.history.back(); }}
                                        />
                                    ) : null
                                ) : selectedMaster === 'plans' ? (
                                    <PlanMaster booksList={myAuthorBooks} triggerToast={triggerToast} />
                                ) : selectedMaster === 'bundles' ? (
                                    typeof window.BundleMaster !== 'undefined' ? <window.BundleMaster triggerToast={triggerToast} /> : <BundleMaster triggerToast={triggerToast} />
                                ) : selectedMaster === 'single-books' ? (
                                    typeof window.SingleBookMaster !== 'undefined' ? <window.SingleBookMaster triggerToast={triggerToast} /> : <div className="p-6 bg-amber-50 border border-amber-300 rounded text-amber-900 font-bold text-xs">Single Book Master not loaded.</div>
                                ) : selectedMaster === 'categories' && categoryPageMode === 'add-category-page' ? (
                                    AddCategoryFormComp ? <AddCategoryFormComp onSuccess={(msg) => { triggerToast(msg); fetchCategories(); window.history.back(); }} onCancel={() => window.history.back()} /> : null
                                ) : selectedMaster === 'categories' && categoryPageMode === 'edit-category-page' ? (
                                    EditCategoryFormComp ? <EditCategoryFormComp editingCategory={editingCategory} onSuccess={(msg) => { triggerToast(msg); setEditingCategory(null); fetchCategories(); window.history.back(); }} onCancel={() => { setEditingCategory(null); window.history.back(); }} /> : null
                                ) : selectedMaster === 'categories' && categoryPageMode === 'bulk-category-grid-page' ? (
                                    <div className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-3">
                                            <button type="button" onClick={() => changeNavState({ categoryPageMode: 'list' })} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer"><i className="fa-solid fa-arrow-left"></i></button>
                                            <h3 className="text-lg font-bold text-[#0d233a]">Bulk Upload Categories</h3>
                                        </div>
                                        <BulkCategoryGridContainer onSuccess={async (msg) => { triggerToast(msg); await fetchCategories(); changeNavState({ categoryPageMode: 'list' }); }} onCancel={() => changeNavState({ categoryPageMode: 'list' })} />
                                    </div>
                                ) : selectedMaster === 'languages' && languagePageMode === 'add-language-page' ? (
                                    AddLanguageFormComp ? <AddLanguageFormComp onSuccess={(msg) => { triggerToast(msg); fetchLanguagesMaster(); window.history.back(); }} onCancel={() => window.history.back()} /> : null
                                ) : selectedMaster === 'languages' && languagePageMode === 'edit-language-page' ? (
                                    EditLanguageFormComp ? <EditLanguageFormComp editingLanguage={editingLanguage} onSuccess={(msg) => { triggerToast(msg); setEditingLanguage(null); fetchLanguagesMaster(); window.history.back(); }} onCancel={() => { setEditingLanguage(null); window.history.back(); }} /> : null
                                ) : selectedMaster === 'languages' && languagePageMode === 'bulk-language-grid-page' ? (
                                    <div className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-3">
                                            <button type="button" onClick={() => changeNavState({ languagePageMode: 'list' })} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer"><i className="fa-solid fa-arrow-left"></i></button>
                                            <h3 className="text-lg font-bold text-[#0d233a]">Bulk Upload Languages</h3>
                                        </div>
                                        <BulkLanguageGridContainer onSuccess={async (msg) => { triggerToast(msg); await fetchLanguagesMaster(); changeNavState({ languagePageMode: 'list' }); }} onCancel={() => changeNavState({ languagePageMode: 'list' })} />
                                    </div>
                                ) : selectedMaster === 'authors' && authorPageMode === 'add-author-page' ? (
                                    AddAuthorFormComp ? <AddAuthorFormComp onSuccess={(msg) => { triggerToast(msg); fetchAuthorsMaster(); window.history.back(); }} onCancel={() => window.history.back()} /> : null
                                ) : selectedMaster === 'authors' && authorPageMode === 'edit-author-page' ? (
                                    ExternalEditAuthorFormComp ? <ExternalEditAuthorFormComp editingAuthor={editingAuthor} onSuccess={(msg) => { triggerToast(msg); setEditingAuthor(null); fetchAuthorsMaster(); window.history.back(); }} onCancel={() => { setEditingAuthor(null); window.history.back(); }} /> : null
                                ) : selectedMaster === 'authors' && authorPageMode === 'bulk-author-grid-page' ? (
                                    <div className="w-full bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                                        <div className="flex items-center gap-3 border-b pb-3">
                                            <button type="button" onClick={() => changeNavState({ authorPageMode: 'list' })} className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold p-2.5 rounded-full text-sm cursor-pointer"><i className="fa-solid fa-arrow-left"></i></button>
                                            <h3 className="text-lg font-bold text-[#0d233a]">Bulk Upload Authors</h3>
                                        </div>
                                        <BulkAuthorGridContainer onSuccess={async (msg) => { triggerToast(msg); await fetchAuthorsMaster(); changeNavState({ authorPageMode: 'list' }); }} onCancel={() => changeNavState({ authorPageMode: 'list' })} />
                                    </div>
                                ) : (
                                    /* RESPONSIVE DATA LIST (MOBILE CARDS + DESKTOP STICKY TABLE) */
                                    <div className="w-full bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                            <h3 className="text-sm sm:text-base font-black text-[#0B1325] capitalize flex items-center gap-2">
                                                <i className="fa-solid fa-table-list text-[#00A884]"></i>
                                                <span>{selectedMaster} Directory ({searchedData.length})</span>
                                            </h3>
                                            <span className="text-xs font-bold text-slate-500">
                                                Page {safePage} of {totalPages}
                                            </span>
                                        </div>

                                        {/* MOBILE CARD VIEW */}
                                        <div className="grid grid-cols-1 gap-3 md:hidden">
                                            {paginatedData.map((item, idx) => (
                                                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <span className="text-[10px] font-mono font-bold text-indigo-600 block truncate max-w-[200px]">{item.id}</span>
                                                            <h4 className="font-black text-sm text-[#0B1325]">{item.name}</h4>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedMasterIds.includes(item.id)}
                                                            onChange={() => handleSelectSingleMasterRow(item.id)}
                                                            className="w-4 h-4 accent-[#00A884]"
                                                        />
                                                    </div>
                                                    <p className="text-xs text-slate-600 line-clamp-2">{item.desc}</p>
                                                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3 text-xs font-bold">
                                                        {selectedMaster === 'items' && item.raw && (
                                                            <>
                                                                <button onClick={() => handleOpenPdfModal(item.raw)} className="text-purple-700"><i className="fa-solid fa-file-pdf text-red-600 mr-1"></i>PDF</button>
                                                                {!item.isPublished && (
                                                                    <button onClick={() => handleApproveBook(item.raw, item.name)} className="text-emerald-700"><i className="fa-solid fa-check mr-1"></i>Approve</button>
                                                                )}
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => setDeleteConfirmModal({ show: true, id: item.id, ids: [], title: item.name, type: selectedMaster })}
                                                            className="text-red-600">
                                                            <i className="fa-solid fa-trash mr-1"></i>Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* DESKTOP COMPACT TABLE */}
                                        <div className="hidden md:block overflow-x-auto w-full border border-slate-200 rounded-xl">
                                            <table className="w-full text-left text-slate-800 text-xs border-collapse">
                                                <thead className="bg-slate-100 text-slate-700 uppercase border-b font-extrabold sticky top-0 z-10">
                                                    <tr>
                                                        <th className="p-3 w-10 text-center">
                                                            <input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAllMasterRows(e, paginatedData)} className="w-4 h-4 cursor-pointer accent-[#00A884]" />
                                                        </th>
                                                        <th className="p-3 whitespace-nowrap">Code / ID</th>
                                                        <th className="p-3 whitespace-nowrap">Name</th>
                                                        {selectedMaster === 'customers' ? (
                                                            <>
                                                                <th className="p-3">Mobile</th>
                                                                <th className="p-3">Email</th>
                                                                <th className="p-3">State</th>
                                                            </>
                                                        ) : selectedMaster === 'items' ? (
                                                            <>
                                                                <th className="p-3">Category</th>
                                                                <th className="p-3">Author</th>
                                                                <th className="p-3">Language</th>
                                                                <th className="p-3">Price</th>
                                                                <th className="p-3">Pages</th>
                                                                <th className="p-3">Status</th>
                                                            </>
                                                        ) : (
                                                            <th className="p-3">Details</th>
                                                        )}
                                                        <th className="p-3 text-right sticky right-0 bg-slate-100 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {paginatedData.map((item, index) => {
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
                                                                    else if (selectedMaster === 'customers' && item.raw) handleOpenCustomerFullProfile(item.raw);
                                                                }}
                                                                className={`hover:bg-emerald-50/50 cursor-pointer transition ${isChecked ? 'bg-amber-50/60' : 'bg-white'}`}>
                                                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                                                    <input type="checkbox" checked={isChecked} onChange={() => handleSelectSingleMasterRow(item.id)} className="w-4 h-4 cursor-pointer accent-[#00A884]" />
                                                                </td>
                                                                <td className="p-3 font-mono font-bold text-indigo-600 max-w-[130px] truncate" title={item.id}>{item.id}</td>
                                                                <td className="p-3 font-bold text-slate-900 max-w-[200px] truncate" title={item.name}>{item.name}</td>

                                                                {selectedMaster === 'customers' ? (
                                                                    <>
                                                                        <td className="p-3">{item.mobileNo}</td>
                                                                        <td className="p-3">{item.emailId}</td>
                                                                        <td className="p-3">{item.state}</td>
                                                                    </>
                                                                ) : selectedMaster === 'items' && item.raw ? (
                                                                    <>
                                                                        <td className="p-3 font-bold text-amber-700 whitespace-nowrap">{getBookCategoryName(item.raw)}</td>
                                                                        <td className="p-3 font-bold text-blue-700 whitespace-nowrap">{item.raw.extractedAuthorName || item.raw.authorName || 'Dr. Samuel Hahnemann'}</td>
                                                                        <td className="p-3 whitespace-nowrap">{item.raw.language || 'English'}</td>
                                                                        <td className="p-3 font-black text-emerald-700 whitespace-nowrap">₹{item.raw.price ?? item.raw.Price}</td>
                                                                        <td className="p-3 font-semibold whitespace-nowrap">{item.raw.noOfPages || 1}</td>
                                                                        <td className="p-3 whitespace-nowrap">
                                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${item.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                                {item.isPublished ? 'Live' : 'Pending'}
                                                                            </span>
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <td className="p-3 text-slate-600">{item.desc}</td>
                                                                )}

                                                                <td className="p-3 text-right whitespace-nowrap sticky right-0 bg-white shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] space-x-2" onClick={e => e.stopPropagation()}>
                                                                    {selectedMaster === 'items' && item.raw && (
                                                                        <>
                                                                            <button onClick={() => handleOpenPdfModal(item.raw)} className="text-purple-600 hover:underline font-bold cursor-pointer">
                                                                                <i className="fa-solid fa-file-pdf text-red-600 mr-1"></i>PDF
                                                                            </button>
                                                                            {!item.isPublished && (
                                                                                <button onClick={() => handleApproveBook(item.raw, item.name)} className="text-emerald-600 hover:underline font-bold cursor-pointer">
                                                                                    <i className="fa-solid fa-check mr-1"></i>Approve
                                                                                </button>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDeleteConfirmModal({ show: true, id: item.id, ids: [], title: item.name, type: selectedMaster })}
                                                                        className="text-red-600 hover:underline font-bold cursor-pointer">
                                                                        <i className="fa-solid fa-trash mr-1"></i>Delete
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* PAGINATION CONTROLS */}
                                        {searchedData.length > 0 && (
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs text-slate-600">
                                                <span>
                                                    Showing <strong>{(safePage - 1) * rowsPerPage + 1}</strong> to <strong>{Math.min(safePage * rowsPerPage, searchedData.length)}</strong> of <strong>{searchedData.length}</strong> entries
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        disabled={safePage <= 1}
                                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                        className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
                                                        ← Prev
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={safePage >= totalPages}
                                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                        className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-100 disabled:opacity-40 cursor-pointer">
                                                        Next →
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'vendor-profile' && isVendor && (
                    VendorMasterComp ? (
                        <VendorMasterComp
                            booksList={storeBooks}
                            triggerToast={triggerToast}
                            isVendorSelfView={true}
                        />
                    ) : <div className="p-6 text-center font-bold">Loading Vendor Profile...</div>
                )}

                {activeTab === 'reader-profile' && user.isLoggedIn && (
                    window.EmbeddedReaderProfile ? (
                        <window.EmbeddedReaderProfile
                            user={user}
                            triggerToast={triggerToast}
                            onOpenBook={(bookObj) => {
                                saveReadingProgressToBackend(bookObj, bookObj.initialPage || 1);
                                window.history.pushState({ modal: 'reader' }, '');
                                setSelectedBookForDrm(bookObj);
                            }}
                        />
                    ) : <div className="p-6 text-center font-bold">Loading Reader Profile...</div>
                )}

                {activeTab === 'user-plans' && (
                    window.UserPlansPage ? (
                        <window.UserPlansPage
                            user={user}
                            pendingBook={pendingBookForPlan}
                            triggerToast={triggerToast}
                            onCompleteAccess={(bookToOpen) => {
                                setHasEverPurchasedPlan(true);
                                setPendingBookForPlan(null);
                                changeNavState({ activeTab: 'store' });
                                if (bookToOpen) {
                                    saveReadingProgressToBackend(bookToOpen, 1);
                                    setSelectedBookForDrm(bookToOpen);
                                }
                            }}
                        />
                    ) : <div className="p-6 text-center font-bold">Loading Plans Component...</div>
                )}

                {activeTab === 'store' && (
                    <main className="w-full overflow-x-hidden">
                        {/* HERO BANNER SECTION */}
                        <section className="hero-pattern text-white relative py-16 lg:py-24 overflow-hidden">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

                                    <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                                        <span className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emeraldPrimary/20 text-emeraldPrimary text-xs font-bold tracking-wide border border-emeraldPrimary/30">
                                            <i className="fa-solid fa-shield-halved text-goldAccent"></i>
                                            <span>Official B. Jain Homeopathy Digital Platform • Since 1966</span>
                                        </span>

                                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                                            The World's Largest <br />
                                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emeraldPrimary to-teal-200">
                                                Homeopathy Digital Library
                                            </span>
                                        </h1>

                                        <p className="text-slate-300 text-base sm:text-lg font-light max-w-2xl leading-relaxed mx-auto lg:mx-0">
                                            Access authentic Homeopathic works, Materia Medica, Repertories, and Academic Journals on demand. Read seamlessly with DRM protection and instant search.
                                        </p>

                                        {/* CTA Options */}
                                        <div className="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!user.isLoggedIn) {
                                                        setSelectedRoleInput('Reader');
                                                        openAuthModal('register');
                                                    } else {
                                                        scrollToHomeSection('catalog-section');
                                                    }
                                                }}
                                                className="bg-emeraldPrimary hover:bg-emeraldHover text-white font-bold px-8 py-4 rounded-xl transition shadow-lg shadow-emeraldPrimary/30 flex items-center justify-center space-x-2 text-sm cursor-pointer">
                                                <i className="fa-solid fa-user-graduate"></i>
                                                <span>{user.isLoggedIn ? 'Explore Digital Library' : 'Join as Reader / Practitioner'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!user.isLoggedIn) {
                                                        setSelectedRoleInput('Author');
                                                        openAuthModal('register');
                                                    } else if (isAdmin) {
                                                        changeNavState({ activeTab: 'admin' });
                                                    } else {
                                                        changeNavState({ activeTab: 'user-plans' });
                                                    }
                                                }}
                                                className="bg-white/10 hover:bg-white/20 text-white font-bold px-8 py-4 rounded-xl border border-white/20 transition flex items-center justify-center space-x-2 text-sm backdrop-blur-md cursor-pointer">
                                                <i className="fa-solid fa-book-open-reader text-goldAccent"></i>
                                                <span>{isAdmin ? 'Open Admin Console' : 'Publisher / Author Portal'}</span>
                                            </button>
                                        </div>

                                        {/* Highlights list */}
                                        <div className="grid grid-cols-3 gap-4 text-center lg:text-left pt-6 border-t border-white/10 text-xs text-slate-300 font-medium">
                                            <div>
                                                <h4 className="text-xl font-extrabold text-white">{storeBooks.length > 0 ? `${storeBooks.length}+` : '10,000+'}</h4>
                                                <p className="text-slate-400">Verified Titles</p>
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-extrabold text-white">60,000+</h4>
                                                <p className="text-slate-400">Active Doctors</p>
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-extrabold text-white">100%</h4>
                                                <p className="text-slate-400">DRM Copyright Protected</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side Featured Clinical Choice Card (Connected to Live Store Book) */}
                                    <div className="lg:col-span-5 flex justify-center">
                                        {(() => {
                                            const featuredBook = storeBooks[0];
                                            return (
                                                <div className="bg-navyDeep p-5 sm:p-6 rounded-3xl border border-white/10 shadow-2xl w-full max-w-md relative mt-4 lg:mt-0">
                                                    <div className="absolute -top-4 -right-4 bg-goldAccent text-navyDark font-extrabold text-xs px-4 py-1.5 rounded-full shadow-lg">
                                                        Featured Edition
                                                    </div>

                                                    <h3 className="text-white font-bold text-lg mb-1 flex items-center">
                                                        <i className="fa-solid fa-bookmark text-emeraldPrimary mr-2"></i> Featured Clinical Choice
                                                    </h3>
                                                    <p className="text-slate-400 text-xs mb-4">
                                                        {featuredBook ? `By ${getBookAuthorName(featuredBook)}` : 'Included in Reader Membership'}
                                                    </p>

                                                    <div className="h-60 rounded-2xl overflow-hidden mb-4 relative shadow-lg bg-slate-900">
                                                        <img
                                                            src={featuredBook?.image || featuredBook?.Image || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80'}
                                                            alt={featuredBook?.itemName || 'Featured Homeopathy Book'}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-navyDark via-navyDark/30 to-transparent flex items-end p-4">
                                                            <span className="text-xs font-bold text-white line-clamp-2">
                                                                {featuredBook?.itemName || featuredBook?.ItemName || "Kent's Lectures on Materia Medica"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2.5 border-t border-white/10 pt-4 text-xs">
                                                        <div className="flex justify-between text-slate-300">
                                                            <span>DRM Watermarked Reader</span>
                                                            <i className="fa-solid fa-check text-emeraldPrimary"></i>
                                                        </div>
                                                        <div className="flex justify-between text-slate-300">
                                                            <span>Auto Page Progress Sync</span>
                                                            <i className="fa-solid fa-check text-emeraldPrimary"></i>
                                                        </div>
                                                        <div className="flex justify-between text-slate-300">
                                                            <span>Bundle & Single Book Access</span>
                                                            <i className="fa-solid fa-check text-emeraldPrimary"></i>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => featuredBook ? handleReadAccess(featuredBook) : scrollToHomeSection('catalog-section')}
                                                        className="mt-5 w-full bg-emeraldPrimary hover:bg-emeraldHover text-white font-bold py-3 rounded-xl transition text-xs flex items-center justify-center space-x-2 cursor-pointer">
                                                        <span>{featuredBook ? 'Read Featured Edition' : 'Browse Complete Catalog'}</span>
                                                        <i className="fa-solid fa-arrow-right"></i>
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                </div>
                            </div>
                        </section>

                        {/* CATEGORIES HIGHLIGHT SECTION */}
                        <section id="categories" className="py-14 bg-white border-b border-slate-200">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8">
                                    <div>
                                        <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">Curated Library</span>
                                        <h2 className="text-3xl font-extrabold text-navyDark mt-1">Explore Homeopathy Book Categories</h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedCategoryFilter('All'); scrollToHomeSection('catalog-section'); }}
                                        className="text-xs font-bold text-emeraldPrimary hover:text-emeraldHover mt-3 md:mt-0 flex items-center cursor-pointer">
                                        Show All Categories &rarr;
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                                    {[
                                        { title: 'Materia Medica', desc: 'Detailed remedy pictures, keynotes, and clinical provings.', icon: 'fa-pills', bg: 'bg-emeraldLight', text: 'text-emeraldPrimary' },
                                        { title: 'Repertory', desc: 'Kent, Synthesis, Boenninghausen, and modern rubrics.', icon: 'fa-list-check', bg: 'bg-amber-50', text: 'text-amber-600' },
                                        { title: 'Organon', desc: 'Hahnemannian principles, chronic miasms, and philosophy.', icon: 'fa-book-journal-whills', bg: 'bg-blue-50', text: 'text-blue-600' },
                                        { title: 'Clinical', desc: 'Specialized clinical therapeutics, oncology, and pediatrics.', icon: 'fa-stethoscope', bg: 'bg-purple-50', text: 'text-purple-600' },
                                        { title: 'Pharmacy', desc: 'Potentisation scales, drug preparation, and pharmacopoeia.', icon: 'fa-vial', bg: 'bg-teal-50', text: 'text-teal-600' }
                                    ].map((cat, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => { setSelectedCategoryFilter(cat.title); scrollToHomeSection('catalog-section'); }}
                                            className={`bg-creamBg rounded-2xl p-5 border transition cursor-pointer group ${selectedCategoryFilter === cat.title ? 'border-emeraldPrimary ring-2 ring-emeraldPrimary/20 shadow-lg' : 'border-slate-200 hover:border-emeraldPrimary hover:shadow-xl'}`}>
                                            <div className={`w-12 h-12 ${cat.bg} ${cat.text} rounded-xl flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition`}>
                                                <i className={`fa-solid ${cat.icon}`}></i>
                                            </div>
                                            <h3 className="font-bold text-navyDark text-base group-hover:text-emeraldPrimary transition">{cat.title}</h3>
                                            <p className="text-xs text-slate-500 mt-1">{cat.desc}</p>
                                            <span className={`inline-block mt-4 text-[11px] font-bold ${cat.text}`}>Browse Titles &rarr;</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* LIVE CATALOG PUBLICATIONS & JOURNALS SECTION */}
                        <section id="catalog-section" className="py-16 bg-creamBg border-b border-slate-200">
                            <div className="w-full px-4 sm:px-8 lg:px-12 space-y-12">

                                {/* Catalog Header & Filter Pills */}
                                <div className="space-y-6">
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                        <div>
                                            <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">Verified Digital Editions</span>
                                            <h2 className="text-3xl font-extrabold text-navyDark mt-1 flex items-center gap-2">
                                                Catalog Publications
                                                {selectedCategoryFilter !== 'All' && (
                                                    <span className="text-xs bg-emeraldPrimary text-white px-3 py-1 rounded-full font-bold">
                                                        {selectedCategoryFilter}
                                                    </span>
                                                )}
                                            </h2>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCategoryFilter('All')}
                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${selectedCategoryFilter === 'All' ? 'bg-navyDark text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-emeraldPrimary'}`}>
                                                All ({storeBooks.length})
                                            </button>
                                            {categoriesList.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => setSelectedCategoryFilter(c.categoryName)}
                                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${selectedCategoryFilter === c.categoryName ? 'bg-emeraldPrimary text-white' : 'bg-white border border-slate-200 text-slate-700 hover:border-emeraldPrimary'}`}>
                                                    {c.categoryName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {loadingBooks ? (
                                        <div className="py-16 text-center text-xs font-bold text-slate-500 flex flex-col items-center gap-2">
                                            <i className="fa-solid fa-spinner fa-spin text-2xl text-emeraldPrimary"></i>
                                            <span>Loading Publications from BJainRx Library...</span>
                                        </div>
                                    ) : filteredStoreBooks.length === 0 ? (
                                        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                                            <p className="text-sm font-bold text-navyDark">No publications found matching your filter.</p>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedCategoryFilter('All'); setSearchQuery(''); }}
                                                className="text-xs font-bold text-emeraldPrimary hover:underline cursor-pointer">
                                                Reset Filters
                                            </button>
                                        </div>
                                    ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-5 sm:gap-6">
                                            {filteredStoreBooks.map(b => (
                                                <div key={b.id || b.Id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition duration-300 flex flex-col justify-between group">
                                                    <div>
                                                        <div className="h-56 bg-slate-100 relative overflow-hidden">
                                                            <img
                                                                src={b.image || b.Image || '/images/default-cover.png'}
                                                                alt={b.itemName || b.ItemName}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                                            />
                                                            <span className="absolute top-3 left-3 bg-navyDark/90 text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                                                                {b.categoryCode || b.CategoryCode || 'HOMEO'}
                                                            </span>
                                                            {(b.isRoyaltyApplicable || b.IsRoyaltyApplicable) && (
                                                                <span className="absolute top-3 right-3 bg-goldAccent text-navyDark text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                                                                    <i className="fa-solid fa-crown"></i> Royalty
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="p-5">
                                                            <h3 className="font-bold text-navyDark text-sm leading-snug line-clamp-2" title={b.itemName || b.ItemName}>
                                                                {b.itemName || b.ItemName}
                                                            </h3>
                                                            <p className="text-xs text-slate-500 mt-1">by {getBookAuthorName(b)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-5 pt-0">
                                                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                                            <span className="text-lg font-black text-navyDark">
                                                                ₹{b.price !== undefined ? b.price : b.Price}
                                                            </span>
                                                            <div className="flex space-x-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!user.isLoggedIn) {
                                                                            setPendingBookForPlan(b);
                                                                            openAuthModal('login');
                                                                            return;
                                                                        }
                                                                        const hasPlanHistory = hasEverPurchasedPlan || await checkUserPlanHistory();
                                                                        if (!hasPlanHistory) {
                                                                            setPendingBookForPlan(b);
                                                                            changeNavState({ activeTab: 'user-plans' });
                                                                            triggerToast("Please choose a Subscription Plan first!");
                                                                            return;
                                                                        }
                                                                        handleOpenSingleBookCheckoutWithSuggestion(b);
                                                                    }}
                                                                    className="bg-emeraldPrimary hover:bg-emeraldHover text-white px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1">
                                                                    <i className="fa-solid fa-cart-shopping"></i> Buy
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReadAccess(b)}
                                                                    className="bg-navyDark hover:bg-navyDeep text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1">
                                                                    <i className="fa-solid fa-book-open text-emeraldPrimary"></i> Read
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* ACADEMIC & CLINICAL JOURNALS SECTION */}
                                {filteredStoreJournals.length > 0 && (
                                    <div className="space-y-6 pt-10 border-t border-slate-200">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-publisherPurple">Peer-Reviewed Research</span>
                                                <h2 className="text-2xl font-extrabold text-navyDark mt-1 flex items-center gap-2">
                                                    <i className="fa-solid fa-newspaper text-publisherPurple"></i> Academic & Clinical Journals
                                                </h2>
                                            </div>
                                            <span className="bg-purple-50 text-publisherPurple border border-publisherPurple/20 text-xs font-bold px-3 py-1 rounded-full">
                                                {filteredStoreJournals.length} Published Issue(s)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                            {filteredStoreJournals.map(j => {
                                                const journalAsItem = {
                                                    ...j,
                                                    itemName: j.name,
                                                    authorName: j.publisherName,
                                                    image: j.coverImagePath,
                                                    itemType: 'Journal',
                                                    streamUrl: `/api/journal/view-pdf/${j.id}`
                                                };
                                                return (
                                                    <div key={j.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition flex flex-col justify-between">
                                                        <div>
                                                            <div className="h-52 bg-slate-100 relative overflow-hidden">
                                                                <img
                                                                    src={j.coverImagePath || '/images/default-cover.png'}
                                                                    alt={j.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <span className="absolute top-3 left-3 bg-publisherPurple text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase">
                                                                    {j.frequency || 'Journal'}
                                                                </span>
                                                                {j.issn && (
                                                                    <span className="absolute bottom-2 right-2 bg-navyDark/85 text-white text-[9px] font-mono px-2 py-0.5 rounded">
                                                                        ISSN: {j.issn}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="p-5 space-y-1">
                                                                <h3 className="font-bold text-navyDark text-sm line-clamp-2" title={j.name}>{j.name}</h3>
                                                                <p className="text-xs text-slate-500">{j.publisherName}</p>
                                                                {j.volumeIssue && <p className="text-[11px] font-bold text-publisherPurple">{j.volumeIssue}</p>}
                                                            </div>
                                                        </div>

                                                        <div className="p-5 pt-0">
                                                            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                                                <span className="text-lg font-black text-navyDark">₹{j.price ?? 0}</span>
                                                                <div className="flex space-x-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            if (!user.isLoggedIn) {
                                                                                setPendingBookForPlan(journalAsItem);
                                                                                openAuthModal('login');
                                                                                return;
                                                                            }
                                                                            const hasPlanHistory = hasEverPurchasedPlan || await checkUserPlanHistory();
                                                                            if (!hasPlanHistory) {
                                                                                setPendingBookForPlan(journalAsItem);
                                                                                changeNavState({ activeTab: 'user-plans' });
                                                                                triggerToast("Please choose a Subscription Plan first!");
                                                                                return;
                                                                            }
                                                                            handleOpenSingleBookCheckoutWithSuggestion(journalAsItem);
                                                                        }}
                                                                        className="bg-emeraldPrimary hover:bg-emeraldHover text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
                                                                        Buy
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleReadAccess(journalAsItem)}
                                                                        className="bg-publisherPurple hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer">
                                                                        Read
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ABOUT US SECTION */}
                        <section id="about-us" className="py-20 bg-white border-b border-slate-200">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                                    <div className="lg:col-span-6 space-y-5">
                                        <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">About B. Jain Publishing House</span>
                                        <h2 className="text-3xl sm:text-4xl font-extrabold text-navyDark leading-tight">
                                            Pioneering Homeopathic Knowledge Since 1966
                                        </h2>
                                        <p className="text-slate-600 text-sm leading-relaxed">
                                            B. Jain Publishers is the world's largest publisher of homeopathic books, repertories, and journals. Through <strong>BJainRx</strong>, we bring this vast heritage into the digital age with instant search, bundle subscriptions, and copyright-protected cloud accessibility.
                                        </p>

                                        <div className="grid grid-cols-2 gap-4 pt-4">
                                            <div className="bg-creamBg p-4 rounded-xl border border-slate-200">
                                                <i className="fa-solid fa-shield-halved text-emeraldPrimary text-lg mb-2"></i>
                                                <h4 className="font-bold text-navyDark text-sm">Genuine & Verified</h4>
                                                <p className="text-xs text-slate-500 mt-1">Directly authentic from original manuscripts and verified editors.</p>
                                            </div>
                                            <div className="bg-creamBg p-4 rounded-xl border border-slate-200">
                                                <i className="fa-solid fa-cloud-arrow-down text-emeraldPrimary text-lg mb-2"></i>
                                                <h4 className="font-bold text-navyDark text-sm">Multi-Device Cloud</h4>
                                                <p className="text-xs text-slate-500 mt-1">Read on Windows, macOS, Android, or iOS with automatic bookmark sync.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-6 flex justify-center">
                                        <div className="relative max-w-md w-full">
                                            <img src="https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80" alt="B Jain Heritage Books" className="rounded-3xl shadow-2xl w-full object-cover h-96" />
                                            <div className="absolute -bottom-6 -left-6 bg-navyDark text-white p-5 rounded-2xl shadow-xl border border-emeraldPrimary/30 max-w-xs">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded-full bg-emeraldPrimary flex items-center justify-center font-bold text-navyDark">
                                                        55+
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xs">Years of Trust</h4>
                                                        <p className="text-[10px] text-slate-400">Serving practitioners across 120+ countries</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* PLANS & SUBSCRIPTION PRICING SECTION (CONNECTED TO LIVE PLANS) */}
                        <section id="plans" className="py-20 bg-creamBg border-b border-slate-200">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
                                    <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">Simple & Transparent Pricing</span>
                                    <h2 className="text-3xl sm:text-4xl font-extrabold text-navyDark">Choose Your Reader Access Plan</h2>
                                    <p className="text-slate-600 text-sm">Unlock homeopathic books with a membership plan. Add special rare titles or bundles whenever you need.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
                                    {(plansList.length > 0 ? plansList.slice(0, 3) : [
                                        { id: 'p1', planName: 'Starter Reader', priceIncludingTax: 499, validityInDays: 30, targetUser: 'Student', maxBookLimit: 5 },
                                        { id: 'p2', planName: 'Practitioner Subscription', priceIncludingTax: 1499, validityInDays: 180, targetUser: 'Practitioner', maxBookLimit: 25 },
                                        { id: 'p3', planName: 'Clinical Pro Master', priceIncludingTax: 2499, validityInDays: 365, targetUser: 'Clinic / Researcher', maxBookLimit: -1 }
                                    ]).map((plan, idx) => {
                                        const isFeatured = idx === 1;
                                        const pName = plan.planName || plan.PlanName;
                                        const pPrice = plan.priceIncludingTax ?? plan.PriceIncludingTax ?? 999;
                                        const pDays = plan.validityInDays || plan.ValidityInDays || 365;
                                        const pLimit = plan.maxBookLimit ?? plan.MaxBookLimit;

                                        return (
                                            <div
                                                key={plan.id || idx}
                                                className={isFeatured
                                                    ? "bg-navyDark text-white rounded-3xl p-8 border-2 border-emeraldPrimary shadow-2xl flex flex-col justify-between relative transform md:-translate-y-4"
                                                    : "bg-white rounded-3xl p-8 border border-slate-200 flex flex-col justify-between"}>
                                                {isFeatured && (
                                                    <span className="absolute -top-3.5 right-8 bg-emeraldPrimary text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full shadow">
                                                        Most Popular Choice
                                                    </span>
                                                )}

                                                <div>
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${isFeatured ? 'text-emeraldPrimary' : 'text-slate-500'}`}>
                                                        {plan.targetUser || plan.TargetUser || 'Reader Pass'}
                                                    </span>
                                                    <h3 className={`text-2xl font-bold mt-1 ${isFeatured ? 'text-white' : 'text-navyDark'}`}>{pName}</h3>
                                                    <p className={`text-xs mt-2 ${isFeatured ? 'text-slate-300' : 'text-slate-500'}`}>
                                                        Valid for {pDays} Days • Full DRM Reader Access
                                                    </p>

                                                    <div className="my-6">
                                                        <span className={`text-4xl font-black ${isFeatured ? 'text-white' : 'text-navyDark'}`}>₹{pPrice}</span>
                                                        <span className={`text-xs ${isFeatured ? 'text-slate-400' : 'text-slate-500'}`}> / {pDays} days</span>
                                                    </div>

                                                    <ul className={`space-y-3 text-xs mb-6 ${isFeatured ? 'text-slate-200' : 'text-slate-600'}`}>
                                                        <li className="flex items-center">
                                                            <i className="fa-solid fa-circle-check text-emeraldPrimary mr-2"></i>
                                                            <span><strong>{pLimit === -1 ? 'Unlimited' : `${pLimit || 10}+`} Books</strong> Included Access</span>
                                                        </li>
                                                        <li className="flex items-center">
                                                            <i className="fa-solid fa-circle-check text-emeraldPrimary mr-2"></i>
                                                            <span>DRM Protected Continuous PDF Reader</span>
                                                        </li>
                                                        <li className="flex items-center">
                                                            <i className="fa-solid fa-circle-check text-emeraldPrimary mr-2"></i>
                                                            <span>Automatic Page Progress & Library Sync</span>
                                                        </li>
                                                    </ul>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!user.isLoggedIn) {
                                                            openAuthModal('login');
                                                        } else {
                                                            changeNavState({ activeTab: 'user-plans' });
                                                        }
                                                    }}
                                                    className={isFeatured
                                                        ? "w-full bg-emeraldPrimary hover:bg-emeraldHover text-white font-bold py-3.5 rounded-xl text-xs transition shadow-lg shadow-emeraldPrimary/30 cursor-pointer"
                                                        : "w-full bg-navyDark hover:bg-navyDeep text-white font-bold py-3 rounded-xl text-xs transition cursor-pointer"}>
                                                    Select {pName}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>

                        {/* SERVICES & PUBLISHER SECTION */}
                        <section id="services" className="py-20 bg-white border-b border-slate-200">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="text-center max-w-2xl mx-auto mb-12">
                                    <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">Our Core Services</span>
                                    <h2 className="text-3xl font-extrabold text-navyDark mt-1">Services for Readers & Authors</h2>
                                    <p className="text-slate-600 text-sm mt-2">Whether you are a practicing physician, student, or book author, BJainRx provides digital distribution and security.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-creamBg p-6 rounded-2xl border border-slate-200 space-y-3">
                                        <div className="w-12 h-12 bg-emeraldLight text-emeraldPrimary rounded-xl flex items-center justify-center text-xl">
                                            <i className="fa-solid fa-laptop-medical"></i>
                                        </div>
                                        <h3 className="font-bold text-navyDark text-base">Digital Reader Ecosystem</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">High-speed e-book rendering engine with zoom controls, continuous scroll, and automatic page progress tracking.</p>
                                    </div>

                                    <div className="bg-creamBg p-6 rounded-2xl border border-slate-200 space-y-3">
                                        <div className="w-12 h-12 bg-purple-50 text-publisherPurple rounded-xl flex items-center justify-center text-xl">
                                            <i className="fa-solid fa-feather-pointed"></i>
                                        </div>
                                        <h3 className="font-bold text-navyDark text-base">Publisher & Author Portal</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">Publish your original homeopathic research, clinical case studies, or new translations to a worldwide audience of 60,000+ doctors.</p>
                                    </div>

                                    <div className="bg-creamBg p-6 rounded-2xl border border-slate-200 space-y-3">
                                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl">
                                            <i className="fa-solid fa-shield-halved"></i>
                                        </div>
                                        <h3 className="font-bold text-navyDark text-base">Copyright & Anti-Piracy DRM</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed">Protected license signatures and dynamic visible watermarks prevent illegal copying, ensuring author copyrights remain protected.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* CONTACT US SECTION */}
                        <section id="contact" className="py-20 bg-creamBg">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                    <div className="lg:col-span-5 space-y-6">
                                        <span className="text-xs font-bold uppercase tracking-wider text-emeraldPrimary">Get in Touch</span>
                                        <h2 className="text-3xl font-extrabold text-navyDark">Contact Customer & Reader Support</h2>
                                        <p className="text-slate-600 text-sm leading-relaxed">Have questions about your subscription plan, book licenses, or submitting a manuscript for publication? Our team is available to assist you.</p>

                                        <div className="space-y-4 pt-2 text-xs">
                                            <div className="flex items-center space-x-3 text-slate-700">
                                                <div className="w-9 h-9 bg-emeraldLight text-emeraldPrimary rounded-lg flex items-center justify-center text-sm font-bold">
                                                    <i className="fa-solid fa-location-dot"></i>
                                                </div>
                                                <span>B. Jain Publishers (P) Ltd., D-157, Sector 63, Noida, U.P., India</span>
                                            </div>

                                            <div className="flex items-center space-x-3 text-slate-700">
                                                <div className="w-9 h-9 bg-emeraldLight text-emeraldPrimary rounded-lg flex items-center justify-center text-sm font-bold">
                                                    <i className="fa-solid fa-envelope"></i>
                                                </div>
                                                <span>support@bjainrx.com | publisher@bjainrx.com</span>
                                            </div>

                                            <div className="flex items-center space-x-3 text-slate-700">
                                                <div className="w-9 h-9 bg-emeraldLight text-emeraldPrimary rounded-lg flex items-center justify-center text-sm font-bold">
                                                    <i className="fa-solid fa-phone"></i>
                                                </div>
                                                <span>+91 120 493 3333 | Toll Free: 1800 11 1414</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                triggerToast('Message sent! Our support team will respond shortly.');
                                                e.target.reset();
                                            }}
                                            className="space-y-4">
                                            <h3 className="font-bold text-navyDark text-base mb-2">Send us a Direct Message</h3>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Your Name</label>
                                                    <input type="text" required placeholder="Dr. Sharma" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emeraldPrimary" />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address</label>
                                                    <input type="email" required placeholder="doctor@clinic.com" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emeraldPrimary" />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Inquiry Category</label>
                                                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emeraldPrimary">
                                                    <option>Reader Subscription Assistance</option>
                                                    <option>Publisher / Author Inquiry</option>
                                                    <option>Institutional & College Access</option>
                                                    <option>General Support</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-slate-600 mb-1">Your Message</label>
                                                <textarea rows="4" required placeholder="Describe how we can help you..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emeraldPrimary"></textarea>
                                            </div>

                                            <button type="submit" className="w-full bg-emeraldPrimary hover:bg-emeraldHover text-white font-bold py-3.5 rounded-xl text-xs transition shadow-md cursor-pointer">
                                                Send Message
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* FOOTER */}
                        <footer className="bg-navyDark text-slate-300 py-12 border-t border-white/10">
                            <div className="w-full px-4 sm:px-8 lg:px-12">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-800 text-xs">
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <span className="text-2xl font-extrabold text-white">B.Jain</span>
                                            <span className="text-2xl font-black text-emeraldPrimary">Rx</span>
                                        </div>
                                        <p className="text-slate-400 leading-relaxed">
                                            The world's most trusted homeopathic publishing platform, serving digital e-books globally since 1966.
                                        </p>
                                        <p className="text-emeraldPrimary font-bold">www.bjainrx.com</p>
                                    </div>

                                    <div>
                                        <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-xs">Navigation</h4>
                                        <ul className="space-y-2 text-slate-400">
                                            <li><button type="button" onClick={() => scrollToHomeSection('about-us')} className="hover:text-emeraldPrimary cursor-pointer">About Us</button></li>
                                            <li><button type="button" onClick={() => scrollToHomeSection('plans')} className="hover:text-emeraldPrimary cursor-pointer">Subscriptions</button></li>
                                            <li><button type="button" onClick={() => scrollToHomeSection('services')} className="hover:text-emeraldPrimary cursor-pointer">Publisher Services</button></li>
                                            <li><button type="button" onClick={() => scrollToHomeSection('contact')} className="hover:text-emeraldPrimary cursor-pointer">Contact Us</button></li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-xs">Book Categories</h4>
                                        <ul className="space-y-2 text-slate-400">
                                            <li><button type="button" onClick={() => { setSelectedCategoryFilter('Materia Medica'); scrollToHomeSection('catalog-section'); }} className="hover:text-emeraldPrimary cursor-pointer">Materia Medica</button></li>
                                            <li><button type="button" onClick={() => { setSelectedCategoryFilter('Repertory'); scrollToHomeSection('catalog-section'); }} className="hover:text-emeraldPrimary cursor-pointer">Repertory Books</button></li>
                                            <li><button type="button" onClick={() => { setSelectedCategoryFilter('Organon'); scrollToHomeSection('catalog-section'); }} className="hover:text-emeraldPrimary cursor-pointer">Organon of Medicine</button></li>
                                            <li><button type="button" onClick={() => { setSelectedCategoryFilter('Clinical'); scrollToHomeSection('catalog-section'); }} className="hover:text-emeraldPrimary cursor-pointer">Clinical Therapeutics</button></li>
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="text-white font-bold mb-3 uppercase tracking-wider text-xs">Account Portals</h4>
                                        <div className="space-y-2">
                                            <button
                                                type="button"
                                                onClick={() => openAuthModal('login')}
                                                className="w-full bg-emeraldPrimary/20 text-emeraldPrimary hover:bg-emeraldPrimary hover:text-white font-bold py-2 rounded-xl text-xs transition border border-emeraldPrimary/30 cursor-pointer">
                                                Reader Sign In
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedRoleInput('Author'); openAuthModal('register'); }}
                                                className="w-full bg-publisherPurple/20 text-indigo-300 hover:bg-publisherPurple hover:text-white font-bold py-2 rounded-xl text-xs transition border border-publisherPurple/30 cursor-pointer">
                                                Publisher / Author Portal
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500">
                                    <p>&copy; 2026 B. Jain Publishers Pvt. Ltd. & BJainRx (www.bjainrx.com). All rights reserved.</p>
                                    <div className="flex space-x-4 mt-4 sm:mt-0">
                                        <a href="#contact" className="hover:text-emeraldPrimary"><i className="fa-brands fa-facebook text-base"></i></a>
                                        <a href="#contact" className="hover:text-emeraldPrimary"><i className="fa-brands fa-twitter text-base"></i></a>
                                        <a href="#contact" className="hover:text-emeraldPrimary"><i className="fa-brands fa-linkedin text-base"></i></a>
                                    </div>
                                </div>
                            </div>
                        </footer>
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

                        <div className="flex-1 overflow-auto p-4 bg-slate-50">
                            <BulkGridFormContainer
                                categoriesList={categoriesList}
                                languagesList={languagesList}
                                authorsList={authorsList}
                                vendorsList={vendorsList}
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

            {/* AUTHENTICATION MODAL (SIGN IN / REGISTER / FORGOT) */}
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

            {/* FULL-SCREEN BOOK DETAILS, ACCESS TIMING & BUNDLE PREVIEW PAGE */}
            {singleBookCheckoutModal && (
                <div className="fixed inset-0 w-screen h-screen bg-slate-100 z-[90] flex flex-col overflow-hidden">
                    <div className="bg-[#0d233a] text-white px-6 md:px-10 py-4 flex items-center justify-between shrink-0 border-b border-slate-700 shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                                <i className="fa-solid fa-book-open text-base"></i>
                            </div>
                            <div>
                                <h2 className="font-black text-sm md:text-lg uppercase tracking-wide leading-none">
                                    Book Details & Access Timing
                                </h2>
                                <span className="text-[11px] text-slate-300">
                                    Review book details, access duration, and bundle availability before confirming
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setSingleBookCheckoutModal(null);
                                setSingleBookPreviewData(null);
                                setSuggestedBundlesForBook([]);
                                setExpandedBundleId(null);
                            }}
                            className="bg-[#be1e2d] hover:bg-red-700 text-white px-5 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow">
                            <i className="fa-solid fa-arrow-left"></i> Back to Store
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-8">
                        <div className="w-full space-y-6 pb-8">
                            {isLoadingBookPreview ? (
                                <div className="py-20 text-center text-sm font-bold text-slate-600 flex flex-col items-center gap-3">
                                    <i className="fa-solid fa-spinner fa-spin text-3xl text-emerald-600"></i>
                                    <span>Loading complete book details...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-sm flex flex-col md:flex-row gap-6 items-start">
                                        <img
                                            src={singleBookPreviewData?.coverImage || singleBookCheckoutModal.image || singleBookCheckoutModal.Image || '/images/default-cover.png'}
                                            alt={singleBookCheckoutModal.itemName}
                                            className="w-40 md:w-48 h-60 md:h-64 object-cover rounded-xl border border-slate-200 shadow-md shrink-0 mx-auto md:mx-0"
                                        />

                                        <div className="flex-1 space-y-3.5 w-full">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-[11px] font-black uppercase bg-amber-100 text-amber-900 px-3 py-1 rounded-md">
                                                    {singleBookPreviewData?.categoryCode || singleBookCheckoutModal.categoryCode || 'HOMEO'}
                                                </span>
                                                {(singleBookPreviewData?.isbn || singleBookCheckoutModal.isbn) && (
                                                    <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-md border">
                                                        ISBN: {singleBookPreviewData?.isbn || singleBookCheckoutModal.isbn}
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-md border">
                                                    Code: {singleBookPreviewData?.itemNo || singleBookCheckoutModal.itemNo || 'N/A'}
                                                </span>
                                            </div>

                                            <h3 className="text-2xl md:text-3xl font-black text-[#0d233a] leading-snug">
                                                {singleBookPreviewData?.itemName || singleBookCheckoutModal.itemName}
                                            </h3>

                                            <p className="text-sm font-bold text-slate-600">
                                                Author: <span className="text-slate-900">{singleBookPreviewData?.authorName || getBookAuthorName(singleBookCheckoutModal)}</span>
                                            </p>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 text-xs">
                                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Language</span>
                                                    <span className="font-black text-slate-800 text-sm">
                                                        {singleBookPreviewData?.language || singleBookCheckoutModal.language || 'English'}
                                                    </span>
                                                </div>
                                                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Pages</span>
                                                    <span className="font-black text-slate-800 text-sm">
                                                        {singleBookPreviewData?.noOfPages || singleBookCheckoutModal.noOfPages || 100} Pages
                                                    </span>
                                                </div>
                                                <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                                                    <span className="text-[10px] text-emerald-700 font-bold uppercase block">Single Book Price</span>
                                                    <span className="font-black text-emerald-700 text-xl">
                                                        ₹{singleBookPreviewData?.price ?? singleBookCheckoutModal.price ?? singleBookCheckoutModal.Price}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
                                            <div>
                                                <h4 className="text-sm font-black uppercase text-[#0d233a] flex items-center gap-2">
                                                    <i className="fa-solid fa-calendar-check text-emerald-600"></i>
                                                    Book Access Timing (Start to End Date)
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Select the Time Period:
                                                </p>
                                            </div>

                                            <select
                                                value={selectedAccessDays}
                                                onChange={(e) => setSelectedAccessDays(Number(e.target.value))}
                                                className="border-2 border-[#0d233a] rounded-xl px-4 py-2.5 text-xs font-black text-[#0d233a] bg-slate-50 outline-none cursor-pointer">
                                                <option value={30}>30 Days (1 Month Access)</option>
                                                <option value={90}>90 Days (3 Months Access)</option>
                                                <option value={180}>180 Days (6 Months Access)</option>
                                                <option value={365}>365 Days (1 Year Access)</option>
                                                <option value={3650}>Lifetime Access (10 Years)</option>
                                            </select>
                                        </div>

                                        {(() => {
                                            const startDate = new Date();
                                            const endDate = new Date();
                                            endDate.setDate(startDate.getDate() + selectedAccessDays);

                                            const startFormatted = startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                                            const endFormatted = endDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                                            return (
                                                <div className="bg-gradient-to-r from-[#0d233a] to-[#17395c] text-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                    <div className="text-center sm:text-left">
                                                        <span className="text-[10px] text-slate-300 uppercase font-bold block">Available From (Start Date)</span>
                                                        <span className="text-lg font-black text-emerald-400">{startFormatted}</span>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-amber-300 font-black text-xs bg-slate-900/60 px-4 py-2 rounded-full border border-slate-700">
                                                        <i className="fa-solid fa-clock"></i>
                                                        <span>{selectedAccessDays === 3650 ? 'Lifetime Validity' : `${selectedAccessDays} Days Validity`}</span>
                                                    </div>

                                                    <div className="text-center sm:text-right">
                                                        <span className="text-[10px] text-slate-300 uppercase font-bold block">Available Till (Expiry Date)</span>
                                                        <span className="text-lg font-black text-amber-300">{endFormatted}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {suggestedBundlesForBook.length > 0 && (
                                        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-5 md:p-6 space-y-3.5 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-black text-indigo-950 flex items-center gap-2">
                                                    <i className="fa-solid fa-layer-group text-indigo-600"></i>
                                                    This Book Available In Bundle ({suggestedBundlesForBook.length} Bundle):
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                {suggestedBundlesForBook.map((bnd) => {
                                                    const isExpanded = expandedBundleId === bnd.bundleId;
                                                    return (
                                                        <div key={bnd.bundleId} className="bg-white border border-indigo-200 rounded-xl overflow-hidden shadow-sm">
                                                            <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                <div>
                                                                    <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                                                                        <span>{bnd.bundleName}</span>
                                                                        <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                                                                            {bnd.totalBooksCount} Books Included
                                                                        </span>
                                                                    </div>
                                                                    {bnd.description && (
                                                                        <p className="text-xs text-slate-500 mt-0.5">{bnd.description}</p>
                                                                    )}
                                                                    <div className="text-xs font-bold text-slate-600 mt-1">
                                                                        Bundle Offer Price: <span className="text-indigo-700 font-black text-sm">₹{bnd.bundlePrice}</span>
                                                                        {bnd.totalPrice > bnd.bundlePrice && (
                                                                            <span className="line-through text-slate-400 ms-2">₹{bnd.totalPrice}</span>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-wrap items-center gap-2 shrink-0">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedBundleId(isExpanded ? null : bnd.bundleId)}
                                                                        className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-bold px-3.5 py-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 border border-indigo-300">
                                                                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-eye'}`}></i>
                                                                        {isExpanded ? 'Hide Books' : `View Books (${bnd.totalBooksCount})`}
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        disabled={purchasingBundleId === bnd.bundleId}
                                                                        onClick={() => handleConfirmBundlePurchaseFromBook(bnd)}
                                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-2.5 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow">
                                                                        <i className="fa-solid fa-cart-shopping"></i>
                                                                        {purchasingBundleId === bnd.bundleId
                                                                            ? 'Unlocking Bundle...'
                                                                            : `Buy Bundle @ ₹${bnd.bundlePrice}`}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="bg-slate-50 border-t border-indigo-100 p-4 space-y-2.5">
                                                                    <div className="text-[11px] font-black uppercase text-indigo-900 tracking-wider">
                                                                        Books Included in "{bnd.bundleName}":
                                                                    </div>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                                        {(bnd.booksInBundle || []).map((bItem) => (
                                                                            <div
                                                                                key={bItem.bookId}
                                                                                className={`p-3 rounded-xl border flex items-center gap-3 bg-white ${bItem.isCurrentBook ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200'}`}>
                                                                                <img
                                                                                    src={bItem.coverImage || '/images/default-cover.png'}
                                                                                    alt={bItem.itemName}
                                                                                    className="w-12 h-16 object-cover rounded border shrink-0"
                                                                                />
                                                                                <div className="min-w-0 flex-1">
                                                                                    {bItem.isCurrentBook && (
                                                                                        <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded inline-block mb-0.5">
                                                                                            Selected Book
                                                                                        </span>
                                                                                    )}
                                                                                    <div className="font-black text-xs text-slate-900 truncate" title={bItem.itemName}>
                                                                                        {bItem.itemName}
                                                                                    </div>
                                                                                    <div className="text-[10px] text-slate-500 truncate">
                                                                                        by {bItem.authorName}
                                                                                    </div>
                                                                                    <div className="text-[11px] font-extrabold text-slate-700 mt-0.5">
                                                                                        Individual Price: ₹{bItem.price}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="text-sm text-slate-600">
                                            Single Book Payable Amount:{' '}
                                            <strong className="text-2xl font-black text-emerald-700">
                                                ₹{singleBookPreviewData?.price ?? singleBookCheckoutModal.price ?? singleBookCheckoutModal.Price}
                                            </strong>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isPurchasingSingleBook}
                                            onClick={handleConfirmSingleBookPurchase}
                                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-3.5 rounded-xl text-sm shadow-lg transition cursor-pointer flex items-center justify-center gap-2">
                                            <i className="fa-solid fa-unlock-keyhole"></i>
                                            {isPurchasingSingleBook
                                                ? 'Unlocking Book...'
                                                : `Confirm Purchase (₹${singleBookPreviewData?.price ?? singleBookCheckoutModal.price ?? singleBookCheckoutModal.Price}) & Read`}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER FULL PROFILE MODAL */}
            {isLoadingCustomerFullProfile && (
                <div className="fixed inset-0 bg-slate-950/60 z-[95] flex items-center justify-center text-white font-bold text-xs gap-2">
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-amber-400"></i>
                    <span>Loading Customer Complete Profile...</span>
                </div>
            )}

            {viewingCustomerFullProfile && (
                <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[95] flex items-center justify-center p-2 md:p-6 overflow-y-auto">
                    <div className="bg-slate-100 w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-auto max-h-[94vh] flex flex-col">
                        <div className="bg-[#0d233a] text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-700">
                            <div className="flex items-center gap-2.5">
                                <i className="fa-solid fa-id-card text-amber-400 text-lg"></i>
                                <span className="font-black text-sm md:text-base uppercase tracking-wide">
                                    Customer Complete Profile — {viewingCustomerFullProfile.profile.custName}
                                </span>
                            </div>
                            <button
                                onClick={() => setViewingCustomerFullProfile(null)}
                                className="bg-[#be1e2d] hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer">
                                ✕ Close Profile
                            </button>
                        </div>

                        <div className="p-4 md:p-8 overflow-y-auto space-y-6">
                            <div className="w-full bg-gradient-to-r from-[#0d233a] via-[#133150] to-[#163554] px-6 md:px-8 py-6 text-white rounded-2xl shadow flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#be1e2d] border-4 border-white/25 flex items-center justify-center font-black text-3xl text-white shadow-xl shrink-0">
                                        {viewingCustomerFullProfile.profile.custName ? viewingCustomerFullProfile.profile.custName[0].toUpperCase() : 'U'}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <h2 className="text-2xl font-black leading-tight">{viewingCustomerFullProfile.profile.custName || 'Reader Account'}</h2>
                                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase">
                                                Reader Account
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-200 flex items-center gap-2">
                                            <i className="fa-solid fa-envelope text-red-400"></i> {viewingCustomerFullProfile.profile.emailId || 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-300 font-mono">Customer ID: {viewingCustomerFullProfile.profile.custId}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                                <div>
                                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2 border-b pb-2">
                                        <i className="fa-solid fa-user-gear text-[#be1e2d]"></i> Personal Details
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                                            <span className="text-slate-400 font-bold block mb-1">Full Name</span>
                                            <span className="font-extrabold text-slate-800 text-sm">{viewingCustomerFullProfile.profile.custName || 'N/A'}</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                                            <span className="text-slate-400 font-bold block mb-1">Mobile Number</span>
                                            <span className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                                <i className="fa-solid fa-phone text-emerald-600"></i> {viewingCustomerFullProfile.profile.mobileNo || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                                            <span className="text-slate-400 font-bold block mb-1">Email Address</span>
                                            <span className="font-extrabold text-slate-800 text-sm">{viewingCustomerFullProfile.profile.emailId || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2 border-b pb-2">
                                        <i className="fa-solid fa-location-dot text-[#be1e2d]"></i> Address Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 md:col-span-2">
                                            <span className="text-slate-400 font-bold block mb-1">Address Details</span>
                                            <span className="font-bold text-slate-800 block text-sm">{viewingCustomerFullProfile.profile.address1 || 'N/A'}</span>
                                            {viewingCustomerFullProfile.profile.address2 && <span className="text-slate-600 block mt-0.5">{viewingCustomerFullProfile.profile.address2}</span>}
                                            {viewingCustomerFullProfile.profile.landmark && <span className="text-slate-500 text-xs block mt-1"><i className="fa-solid fa-map-pin me-1 text-red-500"></i>Landmark: {viewingCustomerFullProfile.profile.landmark}</span>}
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                                            <span className="text-slate-400 font-bold block mb-1">State & Country</span>
                                            <span className="font-extrabold text-slate-800 text-sm">{viewingCustomerFullProfile.profile.state || 'N/A'}, {viewingCustomerFullProfile.profile.country}</span>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                                            <span className="text-slate-400 font-bold block mb-1">Postal / Pincode</span>
                                            <span className="font-mono font-extrabold text-indigo-700 text-sm">{viewingCustomerFullProfile.profile.postalCode || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <h3 className="text-base font-black text-[#0d233a] flex items-center gap-2 border-b pb-3">
                                    <i className="fa-solid fa-crown text-amber-500"></i>
                                    Active Subscription Plans & Included Books ({viewingCustomerFullProfile.plans?.length || 0})
                                </h3>

                                {(!viewingCustomerFullProfile.plans || viewingCustomerFullProfile.plans.length === 0) ? (
                                    <p className="text-xs text-slate-500 italic">Is customer ke paas abhi koi Subscription Plan active nahi hai.</p>
                                ) : (
                                    <div className="space-y-4">
                                        {viewingCustomerFullProfile.plans.map((planItem, pIdx) => {
                                            const startStr = new Date(planItem.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                                            const endStr = new Date(planItem.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                                            return (
                                                <div key={pIdx} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/70">
                                                    <div className="bg-gradient-to-r from-[#0d233a] to-[#1b3b5c] text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base font-black text-amber-400">{planItem.planName}</span>
                                                                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${planItem.isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-red-500/20 text-red-300 border border-red-400/40'}`}>
                                                                    {planItem.isActive ? `Active • ${planItem.remainingDays} Days Left` : 'Expired'}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-300 font-mono mt-0.5">
                                                                Order ID: {planItem.transactionId || 'N/A'} • Paid: ₹{planItem.amountPaid} ({planItem.billingPeriod})
                                                            </p>
                                                        </div>
                                                        <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-4 text-xs">
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 block uppercase font-bold">Active From</span>
                                                                <span className="font-extrabold text-emerald-400">{startStr}</span>
                                                            </div>
                                                            <i className="fa-solid fa-arrow-right text-slate-500"></i>
                                                            <div>
                                                                <span className="text-[9px] text-slate-400 block uppercase font-bold">Valid Till</span>
                                                                <span className="font-extrabold text-amber-300">{endStr}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {planItem.books && planItem.books.length > 0 && (
                                                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                            {planItem.books.map((bk, bIdx) => (
                                                                <div key={bIdx} className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center gap-2.5">
                                                                    <img src={bk.coverImage || '/images/default-cover.png'} alt={bk.itemName} className="w-10 h-14 object-cover rounded border shrink-0" />
                                                                    <div className="min-w-0">
                                                                        <h4 className="font-bold text-xs text-slate-900 truncate">{bk.itemName}</h4>
                                                                        <p className="text-[10px] text-slate-500 truncate">{bk.authorName}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {viewingCustomerFullProfile.bundles && viewingCustomerFullProfile.bundles.length > 0 && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                                    <h3 className="text-base font-black text-[#0d233a] flex items-center gap-2 border-b pb-3">
                                        <i className="fa-solid fa-layer-group text-indigo-600"></i>
                                        Purchased Book Bundles ({viewingCustomerFullProfile.bundles.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {viewingCustomerFullProfile.bundles.map((bnd, idx) => (
                                            <div key={idx} className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30 p-4">
                                                <div className="flex justify-between items-center font-bold text-xs text-indigo-950 mb-2">
                                                    <span><i className="fa-solid fa-box-open text-amber-500 me-1.5"></i>{bnd.bundleName}</span>
                                                    <span className="font-mono">Paid: ₹{bnd.amountPaid}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                                    {(bnd.books || []).map((bk, bIdx) => (
                                                        <div key={bIdx} className="bg-white border rounded p-2 text-xs font-bold truncate">
                                                            {bk.itemName}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                                <div className="flex items-center justify-between border-b pb-3">
                                    <h3 className="text-base font-black text-[#0d233a] flex items-center gap-2">
                                        <i className="fa-solid fa-book-bookmark text-[#be1e2d]"></i>
                                        My Library & Continue Reading ({viewingCustomerFullProfile.library?.length || 0})
                                    </h3>
                                </div>

                                {(!viewingCustomerFullProfile.library || viewingCustomerFullProfile.library.length === 0) ? (
                                    <p className="text-xs text-slate-500 italic">Customer ne abhi tak koi book padhna shuru nahi kiya hai.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {viewingCustomerFullProfile.library.map((item, idx) => {
                                            const totalPg = item.totalPages || 1;
                                            const lastPg = item.lastReadPage || 1;
                                            const progressPct = Math.min(Math.round((lastPg / totalPg) * 100), 100);

                                            return (
                                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                                                    <div className="flex gap-3">
                                                        <img src={item.coverImage || '/images/default-cover.png'} alt={item.itemName} className="w-12 h-16 object-cover rounded border shrink-0" />
                                                        <div className="min-w-0 flex-1">
                                                            <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">{item.categoryCode || 'HOMEO'}</span>
                                                            <h4 className="font-bold text-xs text-slate-900 truncate mt-1">{item.itemName}</h4>
                                                            <p className="text-[10px] text-slate-500 truncate">by {item.authorName}</p>
                                                            <p className="text-[10px] font-bold text-[#be1e2d] mt-1">Page {lastPg} of {totalPg}</p>
                                                        </div>
                                                    </div>
                                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progressPct}%` }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
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
            alert("There must be at least 1 row.");
            return;
        }
        setRows(rows.filter((_, i) => i !== index));
    };

    const handleDownloadExcelTemplate = () => {
        if (!window.XLSX) {
            alert("The Excel library is loading. Please try again in 2 seconds.");
            return;
        }

        const sampleCat = categoriesList.length > 0
            ? (categoriesList[0].categoryName || categoriesList[0].CategoryName || 'Homoeopathy')
            : 'Homoeopathy';
        const sampleAuth = authorsList.length > 0
            ? (authorsList[0].name || 'Dr. Samuel Hahnemann')
            : 'Dr. Samuel Hahnemann';
        const sampleLang = languagesList.length > 0
            ? (languagesList[0].name || languagesList[0].languageName || 'English')
            : 'English';

        const sampleData = [
            {
                "ISBN Number": "9788131901234",
                "Book Name": "Organon of Medicine",
                "Author Name": sampleAuth,
                "Language Name": sampleLang,
                "Categories Name": sampleCat,
                "Page": 320,
                "Vendor Name": "B. Jain Group",
                "Price": 499
            }
        ];

        const ws = window.XLSX.utils.json_to_sheet(sampleData);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "BooksBulkTemplate");
        window.XLSX.writeFile(wb, "BJain_Bulk_Books_Template.xlsx");
    };

    const handleExcelFileUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!window.XLSX) {
            alert("The Excel library has not loaded. Please refresh the page with Ctrl+Shift+R.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonRows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

                if (!jsonRows || jsonRows.length === 0) {
                    alert("The Excel sheet is empty! Please fill in at least 1 book row.");
                    return;
                }

                const getCol = (row, possibleHeaders) => {
                    const keys = Object.keys(row);
                    for (const h of possibleHeaders) {
                        const matchKey = keys.find(k => k.trim().toLowerCase() === h.toLowerCase());
                        if (matchKey !== undefined && String(row[matchKey]).trim() !== "") {
                            return String(row[matchKey]).trim();
                        }
                    }
                    return "";
                };

                const defaultCatCode = categoriesList.length > 0
                    ? (categoriesList[0].categoryCode || categoriesList[0].CategoryCode || '')
                    : '';
                const defaultAuthorName = authorsList.length > 0 ? authorsList[0].name : '';
                const defaultLangName = languagesList.length > 0
                    ? (languagesList[0].name || languagesList[0].languageName || 'English')
                    : 'English';

                const importedRows = jsonRows.map((row) => {
                    const itemNo = getCol(row, ["item code", "code", "book code", "itemno"]);
                    const isbn = getCol(row, ["isbn number", "isbn", "isbn no"]);
                    const itemName = getCol(row, ["book name", "item name", "title", "book"]);
                    const authorRaw = getCol(row, ["author name", "auther name", "author", "auther"]);
                    const langRaw = getCol(row, ["language name", "language", "lang"]);
                    const catRaw = getCol(row, ["categories name", "category name", "category", "catgories name", "categories"]);
                    const pagesRaw = getCol(row, ["page", "pages", "no of pages", "total pages"]);
                    const vendorRaw = getCol(row, ["vendor name", "vendor", "publisher"]);
                    const priceRaw = getCol(row, ["price", "mrp", "amount", "price (₹)"]);

                    let matchedCatCode = defaultCatCode;
                    if (catRaw && categoriesList.length > 0) {
                        const foundCat = categoriesList.find(c =>
                            (c.categoryName || c.CategoryName || '').toLowerCase() === catRaw.toLowerCase() ||
                            (c.categoryCode || c.CategoryCode || '').toLowerCase() === catRaw.toLowerCase()
                        );
                        if (foundCat) {
                            matchedCatCode = foundCat.categoryCode || foundCat.CategoryCode;
                        }
                    }

                    let matchedAuthor = defaultAuthorName;
                    if (authorRaw && authorsList.length > 0) {
                        const foundAuth = authorsList.find(a =>
                            (a.name || '').toLowerCase() === authorRaw.toLowerCase()
                        );
                        matchedAuthor = foundAuth ? foundAuth.name : authorRaw;
                    }

                    let matchedLang = defaultLangName;
                    if (langRaw && languagesList.length > 0) {
                        const foundLang = languagesList.find(l =>
                            (l.name || l.languageName || '').toLowerCase() === langRaw.toLowerCase()
                        );
                        matchedLang = foundLang ? (foundLang.name || foundLang.languageName) : langRaw;
                    }

                    return {
                        itemNo: itemNo,
                        isbn: isbn,
                        itemName: itemName,
                        categoryCode: matchedCatCode,
                        authorName: matchedAuthor,
                        vendorName: vendorRaw || '',
                        language: matchedLang,
                        price: priceRaw || '',
                        noOfPages: pagesRaw || '',
                        mainPdf: null,
                        coverImage: null
                    };
                }).filter(r => r.itemName.length > 0 || r.isbn.length > 0);

                if (importedRows.length === 0) {
                    alert("The Excel columns don't match! Please use the column headers from the Sample Excel.");
                    return;
                }

                setRows(importedRows);
                alert(`${importedRows.length} The books have been loaded into the table from the Excel file! Now attach the PDF files and click 'Upload All Books.`);
            } catch (err) {
                console.error("Excel read error:", err);
                alert("There was an error reading the Excel file. Please upload a valid .xlsx or .csv file.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    const handleParseExcelPaste = () => {
        if (!pasteText || !pasteText.trim()) {
            alert("Please paste the data copied from Excel into the text area.");
            return;
        }

        const lines = pasteText.trim().split(/\r\n|\n|\r/);
        const parsedRows = [];

        lines.forEach(line => {
            if (!line.trim()) return;
            const cols = line.split('\t');

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
                vendorName: '',
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
            alert(`${parsedRows.length} Rows have been imported successfully from Excel! You can now upload the files.`);
        }
    };

    const handleSubmitGrid = async (e) => {
        e.preventDefault();

        const validRows = rows.filter(r => r.itemName && r.itemName.trim().length > 0);
        if (validRows.length === 0) {
            alert("Please fill in the Book Name for at least 1 book!");
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
            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) {
                onSuccess(data.message);
            } else {
                alert(data.message || `Bulk Grid Upload Failed (${res.status}).`);
            }
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <form onSubmit={handleSubmitGrid} className="space-y-4 text-xs">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 font-bold text-blue-950 text-xs">
                        <i className="fa-solid fa-file-excel text-emerald-600 text-lg"></i>
                        <span>Attach Excel Sheet (.xlsx / .xls / .csv)</span>
                    </div>
                    <p className="text-[11px] text-blue-800 mt-1">
                        Excel Headers: <strong>ISBN Number | Book Name | Author Name | Language Name | Categories Name | Page | Vendor Name | Price</strong>
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleDownloadExcelTemplate}
                        className="bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold px-3.5 py-2 rounded text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i> Download Sample Excel
                    </button>

                    <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded text-xs shadow transition cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-file-arrow-up"></i> Attach Excel Sheet
                        <input
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleExcelFileUpload}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

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
                        <i className="fa-solid fa-paste"></i>
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
                            <th className="p-2 min-w-[160px]">PDF File (Optional)</th>
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
            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || `Bulk Upload Failed (${res.status}).`);
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadAuthorTemplate = () => {
        if (!window.XLSX) return alert("Excel library load ho rahi hai, 2 second baad try karein.");
        const ws = window.XLSX.utils.json_to_sheet([
            { "Author Name": "Dr. Samuel Hahnemann" },
            { "Author Name": "Dr. William Boericke" }
        ]);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "AuthorsTemplate");
        window.XLSX.writeFile(wb, "BJain_Bulk_Authors_Template.xlsx");
    };

    const handleAuthorExcelUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!window.XLSX) return alert("Excel library load nahi hui hai. Page refresh karein.");

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = window.XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const jsonRows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                const parsed = jsonRows.map(row => {
                    const keys = Object.keys(row);
                    const matchKey = keys.find(k => ["author name", "auther name", "author", "name"].includes(k.trim().toLowerCase())) || keys[0];
                    return { authorName: matchKey ? String(row[matchKey]).trim() : "" };
                }).filter(r => r.authorName.length > 0);

                if (parsed.length === 0) return alert("Excel sheet mein koi valid Author Name nahi mila.");
                setRows(parsed);
                alert(`${parsed.length} Authors Excel se load ho gaye hain! Ab 'Upload All Authors' par click karein.`);
            } catch (err) {
                alert("Excel file padhne mein error aaya.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 font-bold text-blue-950 text-xs">
                        <i className="fa-solid fa-file-excel text-blue-600 text-lg"></i>
                        <span>Attach Authors Excel Sheet (.xlsx / .xls / .csv)</span>
                    </div>
                    <p className="text-[11px] text-blue-800 mt-1">Excel Column Header: <strong>Author Name</strong></p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button type="button" onClick={handleDownloadAuthorTemplate} className="bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold px-3.5 py-2 rounded text-xs shadow-sm cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i> Download Sample Excel
                    </button>
                    <label className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-file-arrow-up"></i> Attach Excel Sheet
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleAuthorExcelUpload} className="hidden" />
                    </label>
                </div>
            </div>
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
            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || `Bulk Upload Failed (${res.status}).`);
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadCategoryTemplate = () => {
        if (!window.XLSX) return alert("Excel library load ho rahi hai, 2 second baad try karein.");
        const ws = window.XLSX.utils.json_to_sheet([
            { "Categories Name": "Homoeopathy", "Description": "Core Homoeopathic Literature" },
            { "Categories Name": "Materia Medica", "Description": "Drug Pictures & Remedies" }
        ]);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "CategoriesTemplate");
        window.XLSX.writeFile(wb, "BJain_Bulk_Categories_Template.xlsx");
    };

    const handleCategoryExcelUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!window.XLSX) return alert("Excel library load nahi hui hai. Page refresh karein.");

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = window.XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const jsonRows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                const parsed = jsonRows.map(row => {
                    const keys = Object.keys(row);
                    const nameKey = keys.find(k => ["categories name", "category name", "catgories name", "category", "name"].includes(k.trim().toLowerCase())) || keys[0];
                    const descKey = keys.find(k => ["description", "desc", "details"].includes(k.trim().toLowerCase()));
                    return {
                        categoryName: nameKey ? String(row[nameKey]).trim() : "",
                        description: descKey ? String(row[descKey]).trim() : ""
                    };
                }).filter(r => r.categoryName.length > 0);

                if (parsed.length === 0) return alert("Excel sheet mein koi valid Category Name nahi mila.");
                setRows(parsed);
                alert(`${parsed.length} Categories Excel se load ho gayi hain! Ab 'Upload All Categories' par click karein.`);
            } catch (err) {
                alert("Excel file padhne mein error aaya.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                        <i className="fa-solid fa-file-excel text-amber-600 text-lg"></i>
                        <span>Attach Categories Excel Sheet (.xlsx / .xls / .csv)</span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1">Excel Column Headers: <strong>Categories Name | Description</strong></p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button type="button" onClick={handleDownloadCategoryTemplate} className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold px-3.5 py-2 rounded text-xs shadow-sm cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i> Download Sample Excel
                    </button>
                    <label className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-file-arrow-up"></i> Attach Excel Sheet
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleCategoryExcelUpload} className="hidden" />
                    </label>
                </div>
            </div>
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
            const data = await window.safeJsonParse(res);
            if (res.ok && data.success) onSuccess(data.message);
            else alert(data.message || `Bulk Upload Failed (${res.status}).`);
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownloadLanguageTemplate = () => {
        if (!window.XLSX) return alert("Excel library load ho rahi hai, 2 second baad try karein.");
        const ws = window.XLSX.utils.json_to_sheet([
            { "Language Name": "English" },
            { "Language Name": "Hindi" },
            { "Language Name": "German" }
        ]);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "LanguagesTemplate");
        window.XLSX.writeFile(wb, "BJain_Bulk_Languages_Template.xlsx");
    };

    const handleLanguageExcelUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!window.XLSX) return alert("Excel library load nahi hui hai. Page refresh karein.");

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const wb = window.XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
                const jsonRows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
                const parsed = jsonRows.map(row => {
                    const keys = Object.keys(row);
                    const matchKey = keys.find(k => ["language name", "language", "lang", "name"].includes(k.trim().toLowerCase())) || keys[0];
                    return { languageName: matchKey ? String(row[matchKey]).trim() : "" };
                }).filter(r => r.languageName.length > 0);

                if (parsed.length === 0) return alert("Excel sheet mein koi valid Language Name nahi mila.");
                setRows(parsed);
                alert(`${parsed.length} Languages Excel se load ho gayi hain! Ab 'Upload All Languages' par click karein.`);
            } catch (err) {
                alert("Excel file padhne mein error aaya.");
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 font-bold text-indigo-950 text-xs">
                        <i className="fa-solid fa-file-excel text-indigo-600 text-lg"></i>
                        <span>Attach Languages Excel Sheet (.xlsx / .xls / .csv)</span>
                    </div>
                    <p className="text-[11px] text-indigo-800 mt-1">Excel Column Header: <strong>Language Name</strong></p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button type="button" onClick={handleDownloadLanguageTemplate} className="bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold px-3.5 py-2 rounded text-xs shadow-sm cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-download"></i> Download Sample Excel
                    </button>
                    <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded text-xs shadow cursor-pointer flex items-center gap-1.5">
                        <i className="fa-solid fa-file-arrow-up"></i> Attach Excel Sheet
                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleLanguageExcelUpload} className="hidden" />
                    </label>
                </div>
            </div>
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