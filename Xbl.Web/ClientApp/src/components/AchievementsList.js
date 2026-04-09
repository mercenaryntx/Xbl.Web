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

	useEffect(() => {
		fetchMoreData();
	}, [order, source, searchQuery]);

	function replaceOrderPostfix(str) {
		return str.replace(/(.*)-(asc|desc)$/, (match, p1, p2) => {
			return `${p1}&orderDir=${p2.toUpperCase()}`;
		});
	}

	async function fetchPage() {
		const o = replaceOrderPostfix(order);
		const headers = await getHeaders(API_BASE_URL);
		const response = await fetch(`${API_BASE_URL}/api/Titles/${source}?page=${page}&orderBy=${o}&title=${searchQuery}`, { headers: headers });
		return await response.json();
	}

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
				</select>
				<select id="source" value={source} onChange={handleSourceChange}>
					<option value="live">Live</option>
					<option value="x360">Xbox 360</option>
				</select>
			</div>
			<InfiniteScroll
				dataLength={games.length}
				next={fetchMoreData}
				hasMore={hasMore}
				loader={<div className="loading"><img src={loading}></img></div>}
				endMessage={<p>No more games</p>}
			>
				{games.map((game) => (
					<AchievementItem key={game.titleId} game={game} source={source} />
				))}
			</InfiniteScroll>
		</div>
	);
};

export default AchievementsList;
