// src/components/StarRating.js
import React from 'react';
import './StarRating.css';

const STAR_COUNT = 5;

function fillPercentForStar(starIndex, ratingValue) {
	if (!ratingValue) return 0;
	const starsValue = ratingValue / 2;
	const diff = starsValue - starIndex;
	if (diff >= 1) return 100;
	if (diff <= 0) return 0;
	return 50;
}

const StarRating = ({ value, readOnly = true, onChange }) => {
	const stars = Array.from({ length: STAR_COUNT }, (_, i) => i);

	const handleHalfClick = (e, starIndex, half) => {
		e.stopPropagation();
		if (readOnly || !onChange) return;
		const newValue = starIndex * 2 + (half === 'left' ? 1 : 2);
		onChange(newValue === value ? null : newValue);
	};

	return (
		<div className={`star-rating${readOnly ? ' read-only' : ' editable'}`} title={value ? `${value / 2} / 5` : 'Not rated'}>
			{stars.map((starIndex) => (
				<span className="star" key={starIndex}>
					<span className="star-empty">&#9734;</span>
					<span className="star-filled" style={{ width: `${fillPercentForStar(starIndex, value)}%` }}>&#9733;</span>
					{!readOnly && (
						<>
							<span className="star-hit-left" onClick={(e) => handleHalfClick(e, starIndex, 'left')} />
							<span className="star-hit-right" onClick={(e) => handleHalfClick(e, starIndex, 'right')} />
						</>
					)}
				</span>
			))}
		</div>
	);
};

export default StarRating;
