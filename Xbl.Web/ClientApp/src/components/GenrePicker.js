// src/components/GenrePicker.js
import React, { useState } from 'react';
import './GenrePicker.css';

const GenrePicker = ({ genres, assignedGenres, onAssign, onUnassign, onCreateGenre }) => {
	const [open, setOpen] = useState(false);
	const [newGenreName, setNewGenreName] = useState('');

	const assignedIds = new Set(assignedGenres.map((g) => g.id));

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

	const handleCreate = (e) => {
		e.preventDefault();
		e.stopPropagation();
		const name = newGenreName.trim();
		if (!name) return;
		onCreateGenre(name);
		setNewGenreName('');
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
						<div className="genre-picker-list">
							{genres.length === 0 && <div className="genre-picker-empty">No genres yet</div>}
							{genres.map((genre) => (
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
						<form className="genre-picker-create" onSubmit={handleCreate}>
							<input
								type="text"
								placeholder="Create new genre"
								value={newGenreName}
								onChange={(e) => setNewGenreName(e.target.value)}
								onClick={(e) => e.stopPropagation()}
							/>
							<button type="submit">Add</button>
						</form>
					</div>
				</>
			)}
		</div>
	);
};

export default GenrePicker;
