// src/components/ScrollManager.js
import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Plain BrowserRouter/Routes (not the data router) does no scroll management on its own, so
// every route change otherwise keeps whatever scrollY the previous page was at - e.g. clicking a
// game partway down the list opens the details page already scrolled to that same pixel offset.
// Restore only on back/forward (POP) navigation; any other navigation (clicking into a page)
// starts at the top.
const scrollPositions = new Map();
const MAX_RESTORE_MS = 3000;

const ScrollManager = () => {
	const location = useLocation();
	const navigationType = useNavigationType();

	useEffect(() => {
		if (navigationType !== 'POP') {
			window.scrollTo(0, 0);
			return;
		}

		const target = scrollPositions.get(location.pathname) ?? 0;
		const deadline = Date.now() + MAX_RESTORE_MS;
		let frame;

		// The achievements list remounts empty and re-fetches page by page (infinite scroll), so
		// the target position may not be reachable yet on the first frame. Nudge toward it each
		// frame - each nudge is a real scroll event, which is what triggers the list's own
		// "load more" fetch - until it's reached or we give up after MAX_RESTORE_MS.
		const restore = () => {
			const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
			const next = Math.min(target, Math.max(maxScroll, 0));
			window.scrollTo(0, next);
			if (next < target && Date.now() < deadline) {
				frame = requestAnimationFrame(restore);
			}
		};
		restore();

		return () => cancelAnimationFrame(frame);
	}, [location, navigationType]);

	useEffect(() => {
		const handleScroll = () => scrollPositions.set(location.pathname, window.scrollY);
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	}, [location.pathname]);

	return null;
};

export default ScrollManager;
