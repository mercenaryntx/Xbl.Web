import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HamburgerMenu.css';

const HamburgerMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const navigateTo = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <>
      <button className={`hamburger ${isOpen ? 'open' : ''}`} onClick={toggleMenu} aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      
      {isOpen && <div className="menu-overlay" onClick={toggleMenu}></div>}
      
      <nav className={`menu ${isOpen ? 'open' : ''}`}>
        <button className="menu-close" onClick={toggleMenu} aria-label="Close menu">&times;</button>
        <ul>
          <li className={location.pathname === '/' ? 'active' : ''}>
            <button onClick={() => navigateTo('/')}>
              <span className="menu-icon">&#127942;</span> Achievements
            </button>
          </li>
          <li className={location.pathname === '/progress' ? 'active' : ''}>
            <button onClick={() => navigateTo('/progress')}>
              <span className="menu-icon">&#128200;</span> Progress Dashboard
            </button>
          </li>
          <li className={location.pathname === '/query' ? 'active' : ''}>
            <button onClick={() => navigateTo('/query')}>
              <span className="menu-icon">&#128202;</span> Query Mode
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
};

export default HamburgerMenu;
