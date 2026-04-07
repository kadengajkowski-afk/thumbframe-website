import { useEffect } from 'react';

/**
 * useSEO — sets all head meta tags for a page.
 * Works via direct DOM manipulation (no react-helmet dependency needed).
 */
export function useSEO({ title, description, image, url, type = 'website', jsonLd } = {}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const BASE_URL = 'https://thumbframe.com';
    const DEFAULT_IMAGE = `${BASE_URL}/og-default.png`;

    if (title) document.title = title;

    function setMeta(attrKey, attrVal, content) {
      if (!content) return;
      let el = document.querySelector(`meta[${attrKey}="${attrVal}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrKey, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    }

    setMeta('name',     'description',       description);
    setMeta('property', 'og:title',          title);
    setMeta('property', 'og:description',    description);
    setMeta('property', 'og:image',          image || DEFAULT_IMAGE);
    setMeta('property', 'og:url',            url   || window.location.href);
    setMeta('property', 'og:type',           type);
    setMeta('property', 'og:site_name',      'ThumbFrame');
    setMeta('name',     'twitter:card',      'summary_large_image');
    setMeta('name',     'twitter:site',      '@thumbframe');
    setMeta('name',     'twitter:title',     title);
    setMeta('name',     'twitter:description', description);
    setMeta('name',     'twitter:image',     image || DEFAULT_IMAGE);

    // Canonical
    if (url) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = url;
    }

    // JSON-LD
    const SCRIPT_ID = '__page_jsonld__';
    if (jsonLd) {
      let script = document.getElementById(SCRIPT_ID);
      if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = SCRIPT_ID;
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      const s = document.getElementById(SCRIPT_ID);
      if (s) s.remove();
    };
  }, [title, description, image, url, type, jsonLd]);
}
