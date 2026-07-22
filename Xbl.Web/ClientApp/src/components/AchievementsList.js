import React, { useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import AchievementItem from './AchievementItem';
import { LAST_UPDATE_KEY, getHeaders, setLastUpdate } from '../lastUpdate';
import searchIcon from '../assets/images/icons8-search-16.png';
import loading from '../assets/images/loading.svg';
import './AchievementsList.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AchievementsList = () => {
	const [games, setGames] = useState([]);
	const [hasMore, setHasMore] = useState(true);
	const [page, setPage] = useState(0);
	const [order, setOrder] = useState(() => sessionStorage.getItem('orderSelection') || 'lastPlayed-desc');
	const [source, setSource] = useState(() => sessionStorage.getItem('sourceSelection') || 'live');
	const [searchQuery, setSearchQuery] = useState('');
	const [genreFilter, setGenreFilter] = useState(() => sessionStorage.getItem('genreSelection') || '');
	const [genres, setGenres] = useState([]);
	const [editMode, setEditMode] = useState(() => sessionStorage.getItem('editMode') === 'true');

	useEffect(() => {
		fetchMoreData();
	}, [order, source, searchQuery, genreFilter]);

	useEffect(() => {
		fetchGenres();
	}, []);

	function replaceOrderPostfix(str) {
		return str.replace(/(.*)-(asc|desc)$/, (match, p1, p2) => {
			return `${p1}&orderDir=${p2.toUpperCase()}`;
		});
	}

	async function fetchPage() {
		const o = replaceOrderPostfix(order);
		const headers = await getHeaders(API_BASE_URL);
		const genreParam = genreFilter ? `&genre=${genreFilter}` : '';
		// The server response is cached (VaryByHeader: X-Titles-Last-Update), and bumping that
		// header value on edit correctly busts the SERVER's cache - but the browser's own HTTP
		// cache can still serve a request for this URL out of its local cache without the request
		// ever reaching the network, regardless of the header value sent. cache: 'no-store' forces
		// every list fetch to hit the network, so freshness only ever depends on the server cache.
		const response = await fetch(`${API_BASE_URL}/api/Titles/${source}?page=${page}&orderBy=${o}&title=${searchQuery}${genreParam}`, { headers: headers, cache: 'no-store' });
		return await response.json();
	}

	const fetchGenres = async () => {
		const response = await fetch(`${API_BASE_URL}/api/genres`);
		setGenres(await response.json());
	};

	const fetchFirstPage = async () => {
		const data = await fetchPage();
		setGames(data);
		setPage(1);
		setHasMore(data.length >= 50);
	};

	const fetchMoreData = async () => {
		const data = await fetchPage();
		setGames([...games, ...data]);
		setPage(page + 1);
		if (data.length < 50) {
			setHasMore(false);
		}
	};

	const handleOrderChange = (e) => {
		const newOrder = e.target.value;
		setOrder(newOrder);
		sessionStorage.setItem('orderSelection', newOrder);
		setPage(0);
		setHasMore(true);
		setGames([]);
	};

	const handleSourceChange = (e) => {
		const newSource = e.target.value;
		setSource(newSource);
		sessionStorage.setItem('sourceSelection', newSource);
		setPage(0);
		setHasMore(true);
		setGames([]);
	};

	const handleSearchChange = (e) => {
		setSearchQuery(e.target.value);
		setPage(0);
		setHasMore(true);
		setGames([]);
	};

	const handleGenreFilterChange = (e) => {
		const newGenre = e.target.value;
		setGenreFilter(newGenre);
		sessionStorage.setItem('genreSelection', newGenre);
		setPage(0);
		setHasMore(true);
		setGames([]);
	};

	const handleEditModeToggle = () => {
		setEditMode((prev) => {
			const next = !prev;
			sessionStorage.setItem('editMode', String(next));
			return next;
		});
	};

	const updateGame = (titleId, updater) => {
		setGames((prev) => prev.map((g) => (g.titleId === titleId ? updater(g) : g)));
	};

	// The server response cache is keyed in part by the X-Titles-Last-Update header, and the
	// client caches whatever value it last saw in localStorage indefinitely (see lastUpdate.js) -
	// it never re-checks the server on its own. Without bumping it here, navigating away and back
	// resends the same stale header, hits the pre-edit cached response, and the rating/genre
	// changes appear to have vanished.
	const bumpLastUpdate = () => setLastUpdate(new Date().toISOString());

	const handleRatingChange = async (titleId, value) => {
		updateGame(titleId, (g) => ({ ...g, rating: value }));
		if (value == null) {
			await fetch(`${API_BASE_URL}/api/ratings/${source}/${titleId}`, { method: 'DELETE' });
		} else {
			await fetch(`${API_BASE_URL}/api/ratings/${source}/${titleId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ value }),
			});
		}
		bumpLastUpdate();
	};

	const handleAssignGenre = async (titleId, genreId, genreObj) => {
		updateGame(titleId, (g) => ({ ...g, genres: [...g.genres, genreObj] }));
		await fetch(`${API_BASE_URL}/api/genres/${genreId}/games/${source}/${titleId}`, { method: 'PUT' });
		bumpLastUpdate();
		fetchGenres();
	};

	const handleUnassignGenre = async (titleId, genreId) => {
		updateGame(titleId, (g) => ({ ...g, genres: g.genres.filter((x) => x.id !== genreId) }));
		await fetch(`${API_BASE_URL}/api/genres/${genreId}/games/${source}/${titleId}`, { method: 'DELETE' });
		bumpLastUpdate();
		fetchGenres();
	};

	const handleCreateGenre = async (titleId, name) => {
		const response = await fetch(`${API_BASE_URL}/api/genres`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name }),
		});
		const genreObj = await response.json();
		setGenres((prev) => (prev.some((g) => g.id === genreObj.id) ? prev : [...prev, { ...genreObj, gameCount: 0 }]));
		await handleAssignGenre(titleId, genreObj.id, genreObj);
	};

	return (
		<div>
			<div className="order-selection">
				<div className="search-wrapper">
					<img src={searchIcon} className="search-icon-inline" alt="" aria-hidden="true" />
					<input
						type="text"
						value={searchQuery}
						onChange={handleSearchChange}
						placeholder="Search game title"
					/>
				</div>
				<select id="order" value={order} onChange={handleOrderChange}>
					<option value="lastPlayed-desc">Recently played</option>
					<option value="name-asc">A-Z</option>
					<option value="name-desc">Z-A</option>
					<option value="progress-desc">Most completed</option>
					<option value="progress-asc">Least completed</option>
					<option value="rating-desc">Rating (high to low)</option>
					<option value="rating-asc">Rating (low to high)</option>
				</select>
				<select id="source" value={source} onChange={handleSourceChange}>
					<option value="live">Live</option>
					<option value="x360">Xbox 360</option>
				</select>
				<select id="genre" value={genreFilter} onChange={handleGenreFilterChange}>
					<option value="">All genres</option>
					{genres.map((g) => (
						<option key={g.id} value={g.id}>{g.name} ({g.gameCount})</option>
					))}
				</select>
				<button
					type="button"
					className={`edit-mode-toggle${editMode ? ' active' : ''}`}
					onClick={handleEditModeToggle}
				>
					{editMode ? 'Done' : 'Edit'}
				</button>
			</div>
			<InfiniteScroll
				dataLength={games.length}
				next={fetchMoreData}
				hasMore={hasMore}
				loader={<div className="loading"><img src={loading}></img></div>}
				endMessage={<p>No more games</p>}
			>
				{games.map((game) => (
					<AchievementItem
						key={game.titleId}
						game={game}
						source={source}
						editMode={editMode}
						genres={genres}
						onRatingChange={handleRatingChange}
						onAssignGenre={handleAssignGenre}
						onUnassignGenre={handleUnassignGenre}
						onCreateGenre={handleCreateGenre}
					/>
				))}
			</InfiniteScroll>
		</div>
	);
};

export default AchievementsList;
