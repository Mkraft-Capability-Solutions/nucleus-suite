"use client";
import { useAppearance } from './AppearanceContext';
import React, { createContext, useContext, useState, useCallback } from 'react';

const HRMSContext = createContext();

export const useHRMS = () => useContext(HRMSContext);

export const HRMSProvider = ({ children }) => {
    // Appearance belongs to the root provider, so auth and route changes cannot reset it.
    const { appearance, setAppearance } = useAppearance();
    const theme = appearance.mode;
    const setTheme = setAppearance;
    const toggleTheme = () => setAppearance(theme === 'dark' ? 'light' : 'dark');

    // --- TOAST NOTIFICATIONS ---
    const [toasts, setToasts] = useState([]);
    const showToast = (title, message, type = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, title, message, type }].slice(-3));
    };
    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <HRMSContext.Provider value={{
            theme,
            setTheme,
            toggleTheme,
            toasts,
            showToast,
            removeToast,
        }}>
            {children}
        </HRMSContext.Provider>
    );
};
