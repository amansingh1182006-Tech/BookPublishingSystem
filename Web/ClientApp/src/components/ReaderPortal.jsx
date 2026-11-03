import React from 'react';

export default function ReaderPortal({ onSelectBook }) {
    const catalog = [
        { id: 1, title: "Domain Driven Design in .NET 10", price: 49.99 },
        { id: 2, title: "Enterprise DRM & Canvas Watermarking", price: 29.99 }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Reader Access Store</h1>
                <p className="text-slate-400 text-sm">Access DRM encrypted publications with dynamic streaming guards.</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {catalog.map(b => (
                    <div key={b.id} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-between">
                        <div className="space-y-2">
                            <div className="text-xs font-mono text-emerald-400">VERIFIED AUTHORIZATION</div>
                            <h3 className="text-xl font-bold text-white">{b.title}</h3>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between">
                            <div className="text-xl font-extrabold text-white">${b.price}</div>
                            <button
                                onClick={() => onSelectBook(b)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
                            >
                                🔒 Stream in DRM Reader
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}