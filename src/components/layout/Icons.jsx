import React from 'react';

// Basic SVG icons mapped for TopBar compatibility
export const Icons = {
    Candles: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="6" width="4" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 3V6M5 12V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="11" y="8" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <path d="M13 5V8M13 13V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    Line: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 13L7.5 7.5L11.5 10.5L15 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Area: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 13L7.5 7.5L11.5 10.5L15 4V15H3V13Z" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Indicators: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 15C3 15 5.5 8 9 8C12.5 8 15 3 15 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="8" r="1.5" fill="currentColor" />
        </svg>
    ),
    Bell: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15 11.5C15 12.3284 14.3284 13 13.5 13H4.5C3.67157 13 3 12.3284 3 11.5C3 10.9576 3 9.17255 3 8C3 4.68629 5.68629 2 9 2C12.3137 2 15 4.68629 15 8C15 9.17255 15 10.9576 15 11.5Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 15C11 16.1046 10.1046 17 9 17C7.89543 17 7 16.1046 7 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    Settings: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 4L9 2M9 16L9 14M14 9H16M2 9H4M12.5355 5.46447L13.9497 4.05025M4.05025 13.9497L5.46447 12.5355M12.5355 12.5355L13.9497 13.9497M4.05025 4.05025L5.46447 5.46447" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    Fullscreen: () => (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 3H3V6M12 3H15V6M6 15H3V12M12 15H15V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
};
