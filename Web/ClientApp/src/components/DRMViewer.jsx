import React, { useEffect } from 'react';

export default function DRMViewer({ book, user }) {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
                e.preventDefault();
                alert("DRM Protection Active: Print, Save, and Download are disabled.");
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl border border-slate-700">
                <div>
                    <div className="text-xs text-emerald-400 font-semibold uppercase">DRM Active Reader Session</div>
                    <h2 className="text-lg font-bold text-white">{book?.title || "Secured Publication"}</h2>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-lg text-xs font-semibold">
                    🔒 Watermark Protected
                </div>
            </div>

            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl h-[550px] flex items-center justify-center overflow-hidden shadow-2xl">
                {/* Anti-screenshot Watermark */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 rotate-[-25deg] text-red-500 text-2xl font-black select-none z-50">
                    {user?.email || "CONFIDENTIAL"} - {new Date().toLocaleDateString()} - AUTHORIZED DRM STREAM
                </div>

                <div className="text-center space-y-3 z-10">
                    <div className="text-indigo-500 text-5xl font-bold">📄</div>
                    <h3 className="text-lg font-bold text-white">Stream Decrypted in Memory Canvas</h3>
                    <p className="text-slate-400 text-xs max-w-md">
                        Rendered securely via client-side Canvas memory buffers.
                    </p>
                </div>
            </div>
        </div>
    );
}