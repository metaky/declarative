import { useState, useEffect, useCallback } from 'react';
import type { View } from '../App';

const HASH_TO_VIEW: Record<string, View> = {
    '#/': 'translator',
    '#/learn': 'learn',
    '#/other-tools': 'other-tools',
    '#/coffee': 'coffee',
    '#/coffee/donate': 'coffee',
};

const VIEW_TO_HASH: Record<View, string> = {
    'translator': '#/',
    'learn': '#/learn',
    'other-tools': '#/other-tools',
    'coffee': '#/coffee',
};

function getViewFromHash(): View {
    const hash = window.location.hash || '#/';
    return HASH_TO_VIEW[hash] || 'translator';
}

export function useHashRouter() {
    const [currentView, setCurrentView] = useState<View>(getViewFromHash);

    useEffect(() => {
        const handleHashChange = () => {
            setCurrentView(getViewFromHash());
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const navigate = useCallback((view: View) => {
        const hash = VIEW_TO_HASH[view];
        if (window.location.hash !== hash) {
            window.location.hash = hash;
        }
        // Also set state directly for immediate UI update
        setCurrentView(view);
    }, []);

    // Set initial hash if none exists
    useEffect(() => {
        if (!window.location.hash) {
            window.location.hash = '#/';
        }
    }, []);

    return { currentView, navigate };
}
