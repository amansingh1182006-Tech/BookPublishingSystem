import React, { useEffect, useState } from 'react';

export const AdminDashboard = () => {
    const [summary, setSummary] = useState({ totalUsers: 0, totalBooks: 0, totalPurchases: 0, totalRevenue: 0 });
    const [users, setUsers] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAdminData = async () => {
            try {
                const [summaryRes, usersRes, purchasesRes] = await Promise.all([
                    fetch('/api/admin/admin/dashboard-summary'),
                    fetch('/api/admin/admin/all-users'),
                    fetch('/api/admin/admin/all-purchases')
                ]);

                if (summaryRes.ok) setSummary(await summaryRes.json());
                if (usersRes.ok) setUsers(await usersRes.json());
                if (purchasesRes.ok) setPurchases(await purchasesRes.json());
            } catch (error) {
                console.error("Error fetching admin data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAdminData();
    }, []);

    if (loading) return <div style={{ padding: '20px' }}>Loading Admin Central Control Panel...</div>;

    return (
        <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2>System Administrator Management Console</h2>
                <span className="badge bg-danger" style={{ padding: '8px 12px', fontSize: '14px' }}>ADMINISTRATOR ACCESS</span>
            </div>

            {/* Metric Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div style={cardStyle}>
                    <h5>Total Users</h5>
                    <h3>{summary.totalUsers}</h3>
                </div>
                <div style={cardStyle}>
                    <h5>Total Books</h5>
                    <h3>{summary.totalBooks}</h3>
                </div>
                <div style={cardStyle}>
                    <h5>Total Purchases</h5>
                    <h3>{summary.totalPurchases}</h3>
                </div>
                <div style={cardStyle}>
                    <h5>Total Revenue</h5>
                    <h3>₹{summary.totalRevenue}</h3>
                </div>
            </div>

            {/* All Profiles Table */}
            <div style={tableContainerStyle}>
                <h4>User Profiles & Access Roles</h4>
                <table className="table table-striped" style={{ marginTop: '12px' }}>
                    <thead>
                        <tr>
                            <th>User ID</th>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Assigned Roles</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u) => (
                            <tr key={u.id}>
                                <td>{u.id}</td>
                                <td>{u.fullName || 'N/A'}</td>
                                <td>{u.email}</td>
                                <td>
                                    {u.roles && u.roles.map(r => (
                                        <span key={r} className="badge bg-primary me-1">{r}</span>
                                    ))}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* All Purchases & Transactions Table */}
            <div style={{ ...tableContainerStyle, marginTop: '24px' }}>
                <h4>Book Purchase & Subscription Audit</h4>
                <table className="table table-hover" style={{ marginTop: '12px' }}>
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Buyer Email</th>
                            <th>Book Details (Item No / Title)</th>
                            <th>Price / Amount</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {purchases.map((p) => (
                            <tr key={p.id}>
                                <td><code>{p.transactionId || 'N/A'}</code></td>
                                <td>{p.user?.email}</td>
                                <td>
                                    <strong>{p.book?.itemName || p.book?.title}</strong><br />
                                    <small className="text-muted">Item No: {p.book?.itemNo} | ISBN: {p.book?.isbn}</small>
                                </td>
                                <td>₹{p.amountPaid}</td>
                                <td>{new Date(p.purchasedAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const cardStyle = {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    borderLeft: '4px solid #0d6efd'
};

const tableContainerStyle = {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
};