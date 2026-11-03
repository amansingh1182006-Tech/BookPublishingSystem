import React, { useState } from 'react';

export default function AuthorStudio() {
    const [books, setBooks] = useState([
        { id: 1, title: "Domain Driven Design in .NET 10", price: 49.99, chapters: 4, sales: 1240 },
        { id: 2, title: "Enterprise DRM & Canvas Watermarking", price: 29.99, chapters: 2, sales: 520 }
    ]);
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState(19.99);

    const handleAddBook = (e) => {
        e.preventDefault();
        if (!title) return;
        setBooks([...books, { id: Date.now(), title, price: parseFloat(price), chapters: 0, sales: 0 }]);
        setTitle('');
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-white">Author Publishing Studio</h1>
                <p className="text-slate-400 text-sm">Manage dynamic pricing, PDF upload pipelines, and DRM settings.</p>
            </div>

            <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl">
                <h2 className="text-base font-bold text-white mb-4">Create New Book Entity</h2>
                <form onSubmit={handleAddBook} className="grid grid-cols-4 gap-4">
                    <div className="col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Book Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Advanced .NET 10 Security Architecture"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">Price ($)</label>
                        <input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            step="0.01"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex items-end">
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition">
                            Create Entity
                        </button>
                    </div>
                </form>
            </div>

            <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-300">Your Published Books</h2>
                {books.map(b => (
                    <div key={b.id} className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className="font-bold text-lg text-white">{b.title}</div>
                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
                                <span>Price: <strong className="text-indigo-400">${b.price}</strong></span>
                                <span>Sales: <strong className="text-emerald-400">{b.sales} units</strong></span>
                            </div>
                        </div>
                        <button className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold">
                            + Add Chapter PDF
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}