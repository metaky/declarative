import { useState, useEffect, useCallback } from 'react';
import type { View } from '../App';

const HASH_TO_VIEW: Record<string, View> = {
    '#/': 'translator',
    '#/learn': 'learn',
    '#/other-tools': 'other-tools',
    '#/coffee': 'coffee',
    '#/coffee/donate': 'coffee',
    '#/changelog': 'changelog',
};

const VIEW_TO_HASH: Record<View, string> = {
    'translator': '#/',
    'learn': '#/learn',
    'other-tools': '#/other-tools',
    'coffee': '#/coffee',
    'changelog': '#/changelog',
};

const PATH_TO_VIEW: Record<string, View> = {
    '/': 'translator',
    '/learn': 'learn',
    '/other-tools': 'other-tools',
    '/coffee': 'coffee',
    '/coffee/donate': 'coffee',
    '/changelog': 'changelog',
};

function getNormalizedPath(): string {
    return window.location.pathname.replace(/\/+$/, '') || '/';
}

function getViewFromLocation(): View {
    const hash = window.location.hash;
    if (HASH_TO_VIEW[hash]) return HASH_TO_VIEW[hash];

    return PATH_TO_VIEW[getNormalizedPath()] || 'translator';
}

export function useHashRouter() {
    const [currentView, setCurrentView] = useState<View>(getViewFromLocation);

    useEffect(() => {
        const handleHashChange = () => {
            setCurrentView(getViewFromLocation());
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
        if (!window.location.hash && !PATH_TO_VIEW[getNormalizedPath()]) {
            window.location.hash = '#/';
        }
    }, []);

    return { currentView, navigate };
}
