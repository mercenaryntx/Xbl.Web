// src/components/AchievementDetails.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TimeDisplay from './TimeDisplay';
import { getHeaders } from '../lastUpdate';
import gamerscoreIcon from '../assets/images/gamerscore.svg';
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

  useEffect(() => {
    fetchAchievements();
  }, [source, titleId]);

	const fetchAchievements = async () => {
		setLoadingState(true);
		try {
			const headers = await getHeaders(API_BASE_URL);
			const response = await fetch(`${API_BASE_URL}/Titles/${source}/${titleId}`, { headers: headers });
			const data = await response.json();
			setAchievements(data.achievements || []);
			setMinutes(data.minutes);
		} catch (error) {
			console.error('Error fetching achievement details:', error);
		} finally {
			setLoadingState(false);
		}
	};
  
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

  return (
	<div className="achievement-details">
		{title &&
		<div className="title">
			<button id="back" onClick={() => navigate(-1)}>&#129168;</button>
			<img src={titleImage(title.titleId)} alt={title.name} className="game-image" />
			<div className="game-details">
				<div className="game-title">
					<h3>{title.name}</h3>
					{minutes > 0 && <TimeDisplay value={minutes}/>}
				</div>
				<div className="stat">
					<span className="nums">
						<span className="gamerscore"><img src={gamerscoreIcon} alt="gamerscore" className="icon" /> {title.currentGamerscore}/{title.totalGamerscore}</span>
						<span className="achievements"><img src={trophyIcon} alt="trophy" className="icon" /> {title.currentAchievements}</span>
					</span>
					<span className="percentage">{title.progressPercentage.toFixed(2)}%</span>
				</div>
				<div className="progress-bar">
					<div className="progress" style={{ width: `${title.progressPercentage}%` }}></div>
				</div>
			</div>
		</div>
		}
		{loadingState && (
			<div className="loading-centered">
				<img src={loading} alt="Loading..." />
			</div>
		)}
		<div className="achievement-wrap grid-container">
		{!loadingState && achievements.length === 0 && (
			<div className="no-achievements">No achievements available for this game.</div>
		)}
		{!loadingState && achievements.map((achievement) => (
			<div key={achievement.id} className="achievement-item grid-row-item-d4-t8-m4">
			<div className="achievement-container">
				<div className="achievement-image-wrapper">
					<img src={achievementImage(achievement)} alt={achievement.name} className={`${source} ${!achievement.isUnlocked ? 'locked' : ''}`} />
					{!achievement.isUnlocked && <div className="lock-overlay">&#x1F512;</div>}
				</div>
				<div className="achievement-text">
					<div className="achievement-header">
						<h4 className={achievement.isSecret ? 'secret' : ''}>{achievement.name}</h4>
						<span className="gamerscore">
							{achievement.isRare && <img src={diamondIcon} alt="rare" className="icon" />}
							<img src={gamerscoreIcon} alt="gamerscore" className="icon" />
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
