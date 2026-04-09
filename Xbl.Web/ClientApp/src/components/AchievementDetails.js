// src/components/AchievementDetails.js
// src/components/AchievementDetails.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import TimeDisplay from './TimeDisplay';
import { getHeaders } from '../lastUpdate';
import { ReactComponent as GamerscoreIcon } from '../assets/images/gamerscore.svg';
import trophyIcon from '../assets/images/icons8-trophy-16.png';
import diamondIcon from '../assets/images/icons8-diamond-16.png';
import placeholderIcon from '../assets/images/placeholder.png';
import loading from '../assets/images/loading.svg';
import './AchievementDetails.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const AchievementDetails = () => {
  const { source, titleId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const title = location.state?.game;
  const [minutes, setMinutes] = useState(null);
  const [achievements, setAchievements] = useState([]);
	const [loadingState, setLoadingState] = useState(true);
	const [statDelta, setStatDelta] = useState([]);
	const [showChart, setShowChart] = useState(false);
	const [chartLoading, setChartLoading] = useState(false);
	const [activeFilters, setActiveFilters] = useState([]);
	const [showFilterMenu, setShowFilterMenu] = useState(false);
	const filterMenuRef = useRef(null);

	const FILTER_OPTIONS = ['Locked', 'Unlocked', 'Rare', 'Common'];

  useEffect(() => {
	fetchAchievements();
	fetchStatDelta();
  }, [source, titleId]);

	useEffect(() => {
		const handleClickOutside = (e) => {
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
				setShowFilterMenu(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	const fetchStatDelta = async () => {
		if (source !== 'live') return;
		try {
			setChartLoading(true);
			const headers = await getHeaders(API_BASE_URL);
			const response = await fetch(`${API_BASE_URL}/api/Titles/${source}/${titleId}/statdelta`, { headers });
			const data = await response.json();
			const chartData = data.map(entry => {
				const d = new Date(entry.updatedOn);
				d.setDate(d.getDate() - 1);
				return {
					date: d.toISOString().split('T')[0],
					minutes: entry.minutes
				};
			});
			setStatDelta(chartData);
		} catch (error) {
			console.error('Error fetching stat delta:', error);
		} finally {
			setChartLoading(false);
		}
	};

	const fetchAchievements = async () => {
		setLoadingState(true);
		try {
			const headers = await getHeaders(API_BASE_URL);
			const response = await fetch(`${API_BASE_URL}/api/Titles/${source}/${titleId}`, { headers: headers });
			const data = await response.json();
			setAchievements(data.achievements || []);
			setMinutes(data.minutes);
		} catch (error) {
			console.error('Error fetching achievement details:', error);
		} finally {
			setLoadingState(false);
		}
	};
  
	const toggleFilter = (filter) => {
		setActiveFilters(prev =>
			prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
		);
	};

	const filteredAchievements = achievements.filter(a => {
		if (activeFilters.length === 0) return true;
		return activeFilters.some(f => {
			if (f === 'Locked') return !a.isUnlocked;
			if (f === 'Unlocked') return a.isUnlocked;
			if (f === 'Rare') return a.isRare;
			if (f === 'Common') return !a.isRare;
			return true;
		});
	});

	function achievementImage(achievement) {
		if (achievement.displayImage) {
			if (source === 'live') return `https://xblcdn.blob.core.windows.net/achievements/${titleId}.${achievement.id}.png`;
			return achievement.displayImage;
		}
		return placeholderIcon;
	}

	function titleImage(id) {
		return `https://xblcdn.blob.core.windows.net/titles/${id}.png`;
	}

	// Handle achievement click - searches and redirects to TrueAchievements via backend
	async function handleAchievementClick(achievement) {
		if (title) {
			try {
				const params = new URLSearchParams({
					game: title.name,
					achievement: achievement.name
				});
				const response = await fetch(`${API_BASE_URL}/api/Search/trueachievements?${params}`);
				const data = await response.json();
				
				if (data.url) {
					window.open(data.url, '_blank', 'noopener,noreferrer');
				}
			} catch (error) {
				console.error('Error searching for achievement:', error);
				// Fallback: open TrueAchievements search
				const searchUrl = `https://www.trueachievements.com/searchresults.aspx?search=${encodeURIComponent(`${achievement.name} ${title.name}`)}`;
				window.open(searchUrl, '_blank', 'noopener,noreferrer');
			}
		}
	}

  return (
	<div className="achievement-details">
		{title &&
		<>
		<div className="title">
			<button id="back" onClick={() => navigate(-1)}>&#129168;</button>
			<img src={titleImage(title.titleId)} alt={title.name} className="game-image" />
			<div className="game-details">
				<div className="game-title">
					<h3>{title.name}</h3>
				</div>
				<div className="stat">
					<span className="nums">
						<span className="gamerscore"><GamerscoreIcon className="icon" /> {title.currentGamerscore}/{title.totalGamerscore}</span>
						<span className="achievements"><img src={trophyIcon} alt="trophy" className="icon" /> {title.currentAchievements}</span>
					</span>
					<span className="percentage">{title.progressPercentage.toFixed(2)}%</span>
				</div>
				<div className="progress-bar">
					<div className="progress" style={{ width: `${title.progressPercentage}%` }}></div>
				</div>
			</div>
		</div>
		<div className="title-actions">
			{minutes > 0 && <TimeDisplay value={minutes}/>}
			<button
				className={`icon-btn${showChart ? ' active' : ''}`}
				title="Toggle play time chart"
				onClick={() => setShowChart(v => !v)}
				disabled={statDelta.length === 0 && !chartLoading}
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
					<rect x="0" y="6" width="3" height="8"/>
					<rect x="4" y="3" width="3" height="11"/>
					<rect x="8" y="0" width="3" height="14"/>
					<rect x="12" y="4" width="2" height="10"/>
				</svg>
			</button>
			<div className="filter-wrapper" ref={filterMenuRef}>
				<button
					className={`icon-btn${activeFilters.length > 0 ? ' active' : ''}`}
					title="Filter achievements"
					onClick={() => setShowFilterMenu(v => !v)}
				>
					&#x2263;
				</button>
				{showFilterMenu && (
					<div className="filter-menu">
						{FILTER_OPTIONS.map(f => (
							<label key={f} className="filter-option">
								<input
									type="checkbox"
									checked={activeFilters.includes(f)}
									onChange={() => toggleFilter(f)}
								/>
								{f}
							</label>
						))}
					</div>
				)}
			</div>
		</div>
		</>
		}
		{showChart && statDelta.length > 0 && (
			<div className="stat-delta-chart">
				<ResponsiveContainer width="100%" height={220}>
					<BarChart data={statDelta} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
						<CartesianGrid strokeDasharray="3 3" stroke="#444" />
						<XAxis dataKey="date" tick={{ fill: '#ccc', fontSize: 11 }} interval="preserveStartEnd" />
						<YAxis tick={{ fill: '#ccc', fontSize: 11 }} />
						<Tooltip
							contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', color: '#fff' }}
							formatter={(value) => [`${value} min`, 'Play time']}
						/>
						<Bar dataKey="minutes" fill="#008746" radius={[3, 3, 0, 0]} />
					</BarChart>
				</ResponsiveContainer>
			</div>
		)}
		{loadingState && (
			<div className="loading-centered">
				<img src={loading} alt="Loading..." />
			</div>
		)}
		<div className="achievement-wrap grid-container">
		{!loadingState && filteredAchievements.length === 0 && (
			<div className="no-achievements">{achievements.length === 0 ? 'No achievements available for this game.' : 'No achievements match the selected filters.'}</div>
		)}
		{!loadingState && filteredAchievements.map((achievement) => (
			<div key={achievement.id} className="achievement-item grid-row-item-d4-t8-m4">
			<div 
				className="achievement-container clickable" 
				onClick={() => handleAchievementClick(achievement)}
				role="button"
				tabIndex={0}
				onKeyPress={(e) => e.key === 'Enter' && handleAchievementClick(achievement)}
				title="View on TrueAchievements"
			>
				<div className="achievement-image-wrapper">
					<img src={achievementImage(achievement)} alt={achievement.name} className={`${source} ${!achievement.isUnlocked ? 'locked' : ''}`} />
					{!achievement.isUnlocked && <div className="lock-overlay">&#x1F512;</div>}
				</div>
				<div className="achievement-text">
					<div className="achievement-header">
						<h4 className={achievement.isSecret ? 'secret' : ''}>{achievement.name}</h4>
						<span className="gamerscore">
							{achievement.isRare && <img src={diamondIcon} alt="rare" className="icon" />}
							<GamerscoreIcon className="icon" />
							{achievement.gamerscore}
						</span>
					</div>
					<div className="achievement-description">
						{achievement.isUnlocked ? achievement.description : (achievement.isSecret ? achievement.lockedDescription : achievement.description)}
					</div>
					<div className="achievement-rarity">
						{achievement.rarityPercentage.toFixed(2)}% of gamers unlocked this
					</div>
					<div className={`achievement-divider ${achievement.isUnlocked ? 'unlocked' : 'locked'}`}></div>
					<div className="achievement-status">
						{achievement.isUnlocked 
							? `Unlocked ${new Date(achievement.timeUnlocked).toISOString().split('T')[0]}`
							: '0% complete'
						}
					</div>
				</div>
			</div>
		</div>
		))}
		</div>
	</div>
  );
};

export default AchievementDetails;
