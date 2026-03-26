import { useEffect } from 'react';
import { SEO_METADATA } from '../constants/seo';
import type { View } from '../App';

interface UseSEOProps {
  currentView: View;
  showPrivacy: boolean;
  showTerms: boolean;
}

export function useSEO({ currentView, showPrivacy, showTerms }: UseSEOProps) {
  useEffect(() => {
    let seoKey: string = currentView;
    
    if (showPrivacy) seoKey = 'privacy';
    else if (showTerms) seoKey = 'terms';

    const metadata = SEO_METADATA[seoKey] || SEO_METADATA.translator;

    // Update title
    document.title = metadata.title;

    // Update description
    let descriptionTag = document.querySelector('meta[name="description"]');
    if (!descriptionTag) {
      descriptionTag = document.createElement('meta');
      descriptionTag.setAttribute('name', 'description');
      document.head.appendChild(descriptionTag);
    }
    descriptionTag.setAttribute('content', metadata.description);

    // Update keywords
    let keywordsTag = document.querySelector('meta[name="keywords"]');
    if (!keywordsTag) {
      keywordsTag = document.createElement('meta');
      keywordsTag.setAttribute('name', 'keywords');
      document.head.appendChild(keywordsTag);
    }
    keywordsTag.setAttribute('content', metadata.keywords);
    
    // Update canonical if needed (though hash routing usually stays on one base URL)
    // For now, let's just stick to title, description, and keywords as requested.
  }, [currentView, showPrivacy, showTerms]);
}
