// src/components/AchievementItem.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AchievementItem.css';
import { ReactComponent as GamerscoreIcon } from '../assets/images/gamerscore.svg';
import trophyIcon from '../assets/images/icons8-trophy-16.png';
import StarRating from './StarRating';
import GenrePicker from './GenrePicker';

const AchievementItem = ({ game, source, editMode, genres, onRatingChange, onAssignGenre, onUnassignGenre, onCreateGenre }) => {
  const { name, titleId, currentGamerscore, totalGamerscore, currentAchievements, progressPercentage, rating, genres: gameGenres = [] } = game;
  const navigate = useNavigate();
  const handleClick = () => {
    navigate(`/details/${source}/${titleId}`, { state: { game }});
  };
  const showTagsRow = editMode || rating || gameGenres.length > 0;

  function displayImage(id) {
      return `https://xblcdn.blob.core.windows.net/titles/${id}.png`;
  }

  return (
    <div className="title" onClick={handleClick}>
      <img src={displayImage(titleId)} alt={name} className="game-image" />
      <div className="game-details">
		<div className="game-title">
			<h3>{name}</h3>
		</div>
        <div className="stat">
		  <span className="nums">
			  <span className="gamerscore"><GamerscoreIcon className="icon" /> {currentGamerscore}/{totalGamerscore}</span>
			  <span className="achievements"><img src={trophyIcon} alt="trophy" className="icon" /> {currentAchievements}</span>
		  </span>
          <span className="percentage">{progressPercentage.toFixed(2)}%</span>
        </div>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${progressPercentage}%` }}></div>
        </div>
        {showTagsRow && (
          <div className="tags-row">
            {editMode ? (
              <StarRating value={rating} readOnly={false} onChange={(value) => onRatingChange(titleId, value)} />
            ) : (
              rating ? <StarRating value={rating} readOnly={true} /> : null
            )}
            {editMode ? (
              <GenrePicker
                genres={genres}
                assignedGenres={gameGenres}
                onAssign={(genreId, genreObj) => onAssignGenre(titleId, genreId, genreObj)}
                onUnassign={(genreId) => onUnassignGenre(titleId, genreId)}
                onCreateGenre={(name) => onCreateGenre(titleId, name)}
              />
            ) : (
              gameGenres.length > 0 && (
                <span className="genre-chips">
                  {gameGenres.map((g) => (
                    <span className="genre-chip" key={g.id}>{g.name}</span>
                  ))}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementItem;
