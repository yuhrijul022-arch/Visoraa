import React, { useEffect, useRef } from 'react';

/**
 * Landing page rendered as a React component.
 * Loads the static landing-page.html into an iframe-free container
 * by fetching and injecting it.
 */
export const LandingPage: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch the landing page HTML and inject it
        fetch('/landing-page.html')
            .then(res => res.text())
            .then(html => {
                if (!containerRef.current) return;

                // Create a shadow-like container to isolate styles
                const doc = new DOMParser().parseFromString(html, 'text/html');

                // Extract styles
                const styles = doc.querySelectorAll('style');
                const links = doc.querySelectorAll('link[rel="stylesheet"], link[href*="fonts"]');
                const bodyContent = doc.body.innerHTML;
                const scripts = doc.querySelectorAll('script');

                // Clear and inject
                containerRef.current.innerHTML = '';

                // Add font links
                links.forEach(link => {
                    const clone = document.createElement('link');
                    Array.from(link.attributes).forEach(attr => clone.setAttribute(attr.name, attr.value));
                    if (!document.querySelector(`link[href="${clone.getAttribute('href')}"]`)) {
                        document.head.appendChild(clone);
                    }
                });

                // Add styles
                styles.forEach(style => {
                    const el = document.createElement('style');
                    el.textContent = style.textContent;
                    containerRef.current!.appendChild(el);
                });

                // Add body content
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = bodyContent;
                containerRef.current.appendChild(contentDiv);

                // Execute scripts
                scripts.forEach(script => {
                    if (script.src && script.src.includes('fbevents')) return; // Skip pixel (handled by metaPixel.ts)
                    const el = document.createElement('script');
                    el.textContent = script.textContent || '';
                    document.body.appendChild(el);
                });
            })
            .catch(err => {
                console.error('Failed to load landing page:', err);
                if (containerRef.current) {
                    containerRef.current.innerHTML = '<div style="text-align:center;padding:60px;font-family:Inter,sans-serif;"><h2>Loading...</h2></div>';
                }
            });

        // Cleanup: remove injected styles on unmount
        return () => {
            // Styles will be cleaned up when component unmounts
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ minHeight: '100vh' }}
        >
            {/* Loading state */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', fontFamily: 'Inter, sans-serif',
            }}>
                <div style={{ width: 32, height: 32, border: '2px solid #0071e3', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};
