// src/components/GenrePicker.js
import React, { useState } from 'react';
import './GenrePicker.css';

const GenrePicker = ({ genres, assignedGenres, onAssign, onUnassign, onCreateGenre }) => {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState('');

	const assignedIds = new Set(assignedGenres.map((g) => g.id));
	const trimmedQuery = query.trim();
	const filteredGenres = (trimmedQuery
		? genres.filter((g) => g.name.toLowerCase().includes(trimmedQuery.toLowerCase()))
		: genres
	)
		// Stable sort (spec-guaranteed): assigned genres float to the top, otherwise keeping the
		// existing alphabetical order within each group - so already-selected ones are visible
		// without scrolling, rather than mixed in wherever they happen to sort by name.
		.slice()
		.sort((a, b) => (assignedIds.has(b.id) ? 1 : 0) - (assignedIds.has(a.id) ? 1 : 0));
	const exactMatch = genres.find((g) => g.name.toLowerCase() === trimmedQuery.toLowerCase());
	const canCreate = trimmedQuery.length > 0 && !exactMatch;

	const toggleOpen = (e) => {
		e.stopPropagation();
		setOpen((o) => !o);
	};

	const handleToggleGenre = (genre, e) => {
		e.stopPropagation();
		if (assignedIds.has(genre.id)) {
			onUnassign(genre.id);
		} else {
			onAssign(genre.id, { id: genre.id, name: genre.name });
		}
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!trimmedQuery) return;
		// Typing a name that already exists (e.g. after seeing "No matches" for a stale filter,
		// or just not noticing the checkbox below) should assign that genre rather than silently
		// do nothing - it shouldn't ever create a same-named duplicate.
		if (exactMatch) {
			if (!assignedIds.has(exactMatch.id)) onAssign(exactMatch.id, { id: exactMatch.id, name: exactMatch.name });
			setQuery('');
			return;
		}
		onCreateGenre(trimmedQuery);
		setQuery('');
	};

	return (
		<div className="genre-picker" onClick={(e) => e.stopPropagation()}>
			<button type="button" className="genre-picker-trigger" onClick={toggleOpen}>
				+ Genre
			</button>
			{open && (
				<>
					<div className="genre-picker-overlay" onClick={() => setOpen(false)} />
					<div className="genre-picker-popover">
						<form className="genre-picker-search" onSubmit={handleSubmit}>
							<input
								type="text"
								placeholder="Search or create genre"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								onClick={(e) => e.stopPropagation()}
								autoFocus
							/>
						</form>
						{canCreate && (
							<button type="button" className="genre-picker-create-btn" onClick={handleSubmit}>
								+ Create "{trimmedQuery}"
							</button>
						)}
						<div className="genre-picker-list">
							{genres.length === 0 && <div className="genre-picker-empty">No genres yet</div>}
							{genres.length > 0 && filteredGenres.length === 0 && (
								<div className="genre-picker-empty">No matches</div>
							)}
							{filteredGenres.map((genre) => (
								<label key={genre.id} className="genre-picker-item">
									<input
										type="checkbox"
										checked={assignedIds.has(genre.id)}
										onChange={(e) => handleToggleGenre(genre, e)}
									/>
									{genre.name}
								</label>
							))}
						</div>
					</div>
				</>
			)}
		</div>
	);
};

export default GenrePicker;
