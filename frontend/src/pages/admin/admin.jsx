import React from 'react';
import './admin.css';

export default function Admin() {
    return (
        <div className="admin-container">
            <header className="header">
                <nav className="navbar">
                    <h1>My Site</h1>
                    <ul>
                        <li><a href="/home">Home</a></li>
                        <li><a href="/about">About</a></li>
                        <li><a href="/contact">Contact</a></li>
                    </ul>
                </nav>
            </header>

            <main className="main-content">
                <section className="hero">
                    <h2>Welcome Admin!</h2>
                    <p>Admins can do whatever they want! 🤣🤣</p>
                </section>

                <section className="features">
                    <div className="feature-card">
                        <h3>Manage Users</h3>
                        <p>Manage all users in the system.</p>
                        <button onClick={() => window.location.href = '/admin/users'}>Get Started</button>
                    </div>
                    <div className="feature-card">
                        <h3>Feature Two</h3>
                        <p>Another great thing.</p>
                    </div>
                    <div className="feature-card">
                        <h3>Feature Three</h3>
                        <p>More awesome stuff.</p>
                    </div>
                </section>
            </main>
            <button  className="logout-btn" onClick={() => window.location.href = '/home'}>
                Back to Home
            </button>
            <button className="logout-btn" onClick={() => {
                if (!window.confirm('Are you sure you want to logout?')) {
                    return
                }
                localStorage.removeItem('usernameB&T');
                window.location.reload();
            }}>Logout</button>
            <footer className="footer">
                <p>&copy; 2024 My Site. All rights reserved.</p>
            </footer>
        </div>
    );
}
