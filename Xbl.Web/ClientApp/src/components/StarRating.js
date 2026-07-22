// src/components/StarRating.js
import React from 'react';
import './StarRating.css';

const STAR_COUNT = 5;

// The backend stores half-star precision (1-10, kept for future use), but half-star tap zones
// were too small to hit reliably on mobile and the half-fill visual wasn't clearly distinguishable
// anyway - so the UI only ever shows/sets whole stars, rounding any stored half-value on display.
function fillPercentForStar(starIndex, wholeStars) {
	return wholeStars > starIndex ? 100 : 0;
}

const StarRating = ({ value, readOnly = true, onChange }) => {
	const wholeStars = value ? Math.round(value / 2) : 0;
	const stars = Array.from({ length: STAR_COUNT }, (_, i) => i);

	const handleClick = (e, starIndex) => {
		e.stopPropagation();
		if (readOnly || !onChange) return;
		const newValue = (starIndex + 1) * 2;
		onChange(newValue === value ? null : newValue);
	};

	return (
		<div className={`star-rating${readOnly ? ' read-only' : ' editable'}`} title={wholeStars ? `${wholeStars} / 5` : 'Not rated'}>
			{stars.map((starIndex) => (
				<span className="star" key={starIndex} onClick={!readOnly ? (e) => handleClick(e, starIndex) : undefined}>
					<span className="star-empty">&#9734;</span>
					<span className="star-filled" style={{ width: `${fillPercentForStar(starIndex, wholeStars)}%` }}>&#9733;</span>
				</span>
			))}
		</div>
	);
};

export default StarRating;
