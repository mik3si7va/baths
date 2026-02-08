import React from 'react';
import './home.css';

export default function Home() {
    return (
        <div className="home-container">
            <header className="header">
                <nav className="navbar">
                    <h1>My Site</h1>
                    <ul>
                        <li><a href="/">Home</a></li>
                        <li><a href="/about">About</a></li>
                        <li><a href="/contact">Contact</a></li>
                    </ul>
                </nav>
            </header>

            <main className="main-content">
                <section className="hero">
                    <h2>Welcome!</h2>
                    <p>This is a typical home page.</p>
                    <button>Get Started</button>
                </section>

                <section className="features">
                    <div className="feature-card">
                        <h3>Feature One</h3>
                        <p>Something cool goes here.</p>
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
            <button className="logout-btn" onClick={() => {
                localStorage.removeItem('usernameB&T');
                window.location.reload();
            }}>Logout</button>
            <footer className="footer">
                <p>&copy; 2024 My Site. All rights reserved.</p>
            </footer>
        </div>
    );
}
