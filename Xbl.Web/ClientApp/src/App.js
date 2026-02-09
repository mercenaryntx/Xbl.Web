import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AchievementsList from './components/AchievementsList';
import AchievementDetails from './components/AchievementDetails';
import QueryMode from './components/QueryMode';
import ProgressDashboard from './components/ProgressDashboard';
import HamburgerMenu from './components/HamburgerMenu';
import './App.css';

function App() {
  return (
	<Router>
		<div className="app">
			<HamburgerMenu />
			<Routes>
				<Route path="/" element={<AchievementsList />} />
				<Route path="/details/:source/:titleId" element={<AchievementDetails />} />
				<Route path="/query" element={<QueryMode />} />
				<Route path="/progress" element={<ProgressDashboard />} />
			</Routes>
		</div>
	</Router>
  );
}

export default App;
