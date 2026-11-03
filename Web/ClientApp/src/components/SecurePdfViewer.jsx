import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Worker path initialization
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function SecurePdfViewer({ book, user, onClose }) {
    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);
    const [pdfDoc, setPdfDoc] = useState(null);

    const bookIdentifier = book?.id || book?.itemNo || book?.ItemNo;
    const userEmail = user?.email || user?.Email || "AUTHORIZED USER";

    // 1. Fetch PDF Stream from Backend
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setErrorMsg('');

        const loadPdfStream = async () => {
            try {
                if (!bookIdentifier) {
                    throw new Error("Book Identifier Missing!");
                }

                const response = await fetch(`/api/author/Book/view-pdf/${bookIdentifier}`);
                if (!response.ok) {
                    throw new Error(`PDF Stream Load Failed (Status: ${response.status})`);
                }

                const arrayBuffer = await response.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const pdf = await loadingTask.promise;

                if (isMounted) {
                    setPdfDoc(pdf);
                    setNumPages(pdf.numPages);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    console.error("DRM Load Error:", err);
                    setErrorMsg(err.message || "Error decrypting stream.");
                    setLoading(false);
                }
            }
        };

        loadPdfStream();

        return () => {
            isMounted = false;
        };
    }, [bookIdentifier]);

    // 2. Render Page on Canvas + Dynamic Watermark
    const renderPage = useCallback(async (num) => {
        if (!pdfDoc || !canvasRef.current) return;

        try {
            const page = await pdfDoc.getPage(num);
            const viewport = page.getViewport({ scale: 1.3 });
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Render PDF Content
            await page.render({ canvasContext: context, viewport }).promise;

            // Render Dynamic DRM Overlay Watermark on Canvas
            context.save();
            context.font = "bold 16px Arial";
            context.fillStyle = "rgba(190, 30, 45, 0.18)";
            context.rotate((-25 * Math.PI) / 180);

            const watermarkText = `${userEmail} | ${new Date().toLocaleDateString()} | B. JAIN DRM`;
            for (let i = -canvas.height; i < canvas.height * 2; i += 150) {
                for (let j = -canvas.width; j < canvas.width * 2; j += 280) {
                    context.fillText(watermarkText, j, i);
                }
            }
            context.restore();

        } catch (err) {
            console.error("Render Page Error:", err);
        }
    }, [pdfDoc, userEmail]);

    useEffect(() => {
        if (pdfDoc) {
            renderPage(pageNumber);
        }
    }, [pdfDoc, pageNumber, renderPage]);

    // 3. DRM Keyboard & Context Controls
    useEffect(() => {
        const disableContextMenu = (e) => e.preventDefault();

        const handleKeyDown = (e) => {
            if (
                e.key === 'PrintScreen' ||
                (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u' || e.key === 'P' || e.key === 'S' || e.key === 'U')) ||
                e.key === 'F12'
            ) {
                e.preventDefault();
                alert("DRM Protection Active: Print, Save, and Download are disabled.");
            }
        };

        document.addEventListener('contextmenu', disableContextMenu);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('contextmenu', disableContextMenu);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages));

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-[100] flex flex-col select-none overflow-hidden">
            {/* Header Toolbar */}
            <div className="flex items-center justify-between bg-slate-900 px-6 py-3 border-b border-slate-800 shadow-lg">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="bg-[#be1e2d] hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded text-xs transition cursor-pointer">
                        ← Back to App
                    </button>
                    <div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                            🔒 DRM Active Secure Session
                        </span>
                        <h2 className="text-sm font-bold text-white truncate max-w-xs">
                            {book?.itemName || book?.title || "Secured Publication"}
                        </h2>
                    </div>
                </div>

                {/* Page Navigation Controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToPrevPage}
                        disabled={pageNumber <= 1 || loading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold rounded text-xs cursor-pointer border border-slate-700">
                        ◀ Prev
                    </button>
                    <span className="text-xs font-mono font-bold bg-slate-950 px-3 py-1 rounded border border-slate-800 text-amber-400">
                        Page {pageNumber} of {numPages}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={pageNumber >= numPages || loading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold rounded text-xs cursor-pointer border border-slate-700">
                        Next ▶
                    </button>
                </div>

                <div className="hidden sm:block text-right">
                    <span className="text-[11px] text-slate-400 block font-mono">{userEmail}</span>
                </div>
            </div>

            {/* Canvas Memory Stream Viewer Box */}
            <div className="flex-1 overflow-auto p-4 flex justify-center items-center bg-slate-950 select-none">
                {loading ? (
                    <div className="text-center space-y-3">
                        <div className="text-amber-500 text-3xl animate-spin inline-block">⏳</div>
                        <h3 className="text-sm font-bold text-white">Decrypting & Streaming Memory Canvas...</h3>
                        <p className="text-slate-400 text-xs">Fetching chunks from backend controller.</p>
                    </div>
                ) : errorMsg ? (
                    <div className="bg-red-950/60 border border-red-600 text-red-200 p-6 rounded-xl text-xs font-bold max-w-md text-center">
                        ⚠️ {errorMsg}
                    </div>
                ) : (
                    <div className="relative shadow-2xl rounded-lg overflow-hidden bg-white border border-slate-800">
                        <canvas ref={canvasRef} className="block select-none pointer-events-none" />
                    </div>
                )}
            </div>
        </div>
    );
}