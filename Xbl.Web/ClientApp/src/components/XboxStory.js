import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import placeholderIcon from '../assets/images/placeholder.png';
import { ReactComponent as GamerscoreIcon } from '../assets/images/gamerscore.svg';
import './XboxStory.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://localhost:7238';

function toHttps(url) {
  if (!url) return url;
  return url.replace(/^http:\/\//i, 'https://');
}

function titleBlobUrl(titleId) {
  return titleId ? `https://xblcdn.blob.core.windows.net/titles/${titleId}.png` : null;
}

function achievementBlobUrl(titleId, achievementId) {
  return titleId && achievementId
    ? `https://xblcdn.blob.core.windows.net/achievements/${titleId}.${achievementId}.png`
    : null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatMonthYear(dateStr) {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  if (!month) return year;
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function formatMinutes(minutes) {
  if (!minutes) return '0h';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getHeatmapColor(count, maxCount) {
  if (!count || count === 0) return '#2a2a2a';
  const ratio = Math.min(count / maxCount, 1);
  if (ratio < 0.2) return '#0b4a0b';
  if (ratio < 0.4) return '#0d6c0d';
  if (ratio < 0.6) return '#107C10';
  if (ratio < 0.8) return '#18a018';
  return '#22cc22';
}

// Issue 1: Monthly heatmap matrix (rows=years, columns=months)
const MonthlyMatrix = ({ activityCalendar, startYear, endYear }) => {
  const monthMap = useMemo(() => {
    const map = {};
    activityCalendar.forEach(d => {
      const ym = d.date.substring(0, 7);
      map[ym] = (map[ym] || 0) + d.count;
    });
    return map;
  }, [activityCalendar]);

  const maxCount = useMemo(() =>
    Math.max(...Object.values(monthMap), 1),
    [monthMap]);

  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  return (
    <div className="monthly-matrix">
      <div className="monthly-matrix-header">
        <div className="monthly-matrix-year-col" />
        {MONTH_NAMES.map((m, i) => (
          <div key={i} className="monthly-matrix-month-label">{m}</div>
        ))}
      </div>
      {years.map(year => (
        <div key={year} className="monthly-matrix-row">
          <div className="monthly-matrix-year-label">{year}</div>
          {MONTH_NAMES.map((_, mi) => {
            const ym = `${year}-${String(mi + 1).padStart(2, '0')}`;
            const count = monthMap[ym] || 0;
            return (
              <div
                key={mi}
                className="monthly-matrix-cell"
                style={{ backgroundColor: getHeatmapColor(count, maxCount) }}
                title={count > 0 ? `${ym}: ${count} achievement${count !== 1 ? 's' : ''}` : ym}
              />
            );
          })}
        </div>
      ))}
      <div className="monthly-matrix-legend">
        <span className="legend-label">Less</span>
        {['#2a2a2a', '#0b4a0b', '#0d6c0d', '#107C10', '#18a018', '#22cc22'].map((c, i) => (
          <div key={i} className="legend-cell" style={{ backgroundColor: c }} />
        ))}
        <span className="legend-label">More</span>
      </div>
    </div>
  );
};

const AchievementCard = ({ title, achievement, badge }) => {
  if (!achievement) return null;
  return (
    <div className="story-card achievement-card">
      <div className="story-card-title">{title}</div>
      <div className="achievement-card-content">
        <div className="achievement-card-images">
          <img
            className="achievement-game-thumb"
            src={titleBlobUrl(achievement.titleId) || toHttps(achievement.gameImage) || placeholderIcon}
            alt={achievement.gameName}
            onError={e => { e.target.src = placeholderIcon; }}
          />
          <img
            className="achievement-icon-overlay"
            src={achievementBlobUrl(achievement.titleId, achievement.achievementId) || toHttps(achievement.icon) || placeholderIcon}
            alt={achievement.name}
            onError={e => { e.target.src = placeholderIcon; }}
          />
        </div>
        <div className="achievement-card-info">
          {badge && <div className="achievement-badge">{badge}</div>}
          <div className="achievement-name" title={achievement.name}>{achievement.name}</div>
          <div className="achievement-game" title={achievement.gameName}>{achievement.gameName}</div>
          <div className="achievement-desc" title={achievement.description}>{achievement.description}</div>
          {achievement.timeUnlocked && (
            <div className="achievement-date">{formatDate(achievement.timeUnlocked)}</div>
          )}
          <div className="achievement-gs">{achievement.gamerscore}<GamerscoreIcon className="gs-icon" /></div>
        </div>
      </div>
    </div>
  );
};

const GameCard = ({ title, game, subtitle }) => {
  if (!game) return null;
  return (
    <div className="story-card game-card">
      <div className="story-card-title">{title}</div>
      <div className="game-card-content">
        <img
          className="game-card-thumb"
          src={titleBlobUrl(game.titleId) || toHttps(game.gameImage) || placeholderIcon}
          alt={game.gameName}
          onError={e => { e.target.src = placeholderIcon; }}
        />
        <div className="game-card-info">
          <div className="game-card-name" title={game.gameName}>{game.gameName}</div>
          <div className="game-card-subtitle">{subtitle}</div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, sub }) => (
  <div className="story-stat-card">
    <div className="story-stat-value">{value}</div>
    <div className="story-stat-label">{label}</div>
    {sub && <div className="story-stat-sub">{sub}</div>}
  </div>
);

const GENRE_COLORS = [
  '#107C10', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
  '#00BCD4', '#FFEB3B', '#4CAF50', '#E91E63', '#009688'
];

// Issue 5: Vertical timeline era component showing all per-era stats
const TimelineEra = ({ era }) => {
  const fastestSubtitle = era.fastestCompletion
    ? (() => {
        const m = era.fastestCompletion.minutesToComplete || 0;
        if (m === 0) return 'Instant';
        if (m < 1440) return `${formatMinutes(m)} to complete`;
        const days = Math.floor(m / 1440);
        return `${days} day${days !== 1 ? 's' : ''} to complete`;
      })()
    : '';

  const firstCompSubtitle = era.firstCompletion?.completionDate
    ? formatDate(era.firstCompletion.completionDate)
    : '';

  const mostPlayedSubtitle = era.mostPlayedGame?.minutes
    ? formatMinutes(era.mostPlayedGame.minutes)
    : '';

  return (
    <div className="timeline-era">
      <div className="timeline-era-header">
        <div className="timeline-era-dot" />
        <div className="timeline-era-title">{era.label}</div>
        <div className="timeline-era-date">
          {new Date(era.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      <div className="timeline-era-body">
        <div className="timeline-era-stats">
          <div className="timeline-stat">
            <div className="timeline-stat-value">{(era.gamerscore || 0).toLocaleString()}<GamerscoreIcon className="gs-icon" /></div>
            <div className="timeline-stat-label">Gamerscore</div>
          </div>
          <div className="timeline-stat">
            <div className="timeline-stat-value">{(era.achievementsUnlocked || 0).toLocaleString()}</div>
            <div className="timeline-stat-label">Achievements</div>
          </div>
          <div className="timeline-stat">
            <div className="timeline-stat-value">{(era.gamesPlayed || 0).toLocaleString()}</div>
            <div className="timeline-stat-label">Games</div>
          </div>
        </div>
        <div className="timeline-era-cards">
          <AchievementCard title="First Achievement" achievement={era.firstAchievement} />
          <AchievementCard
            title="Rarest Achievement"
            achievement={era.rarestAchievement}
            badge={era.rarestAchievement
              ? `${era.rarestAchievement.rarityPercentage?.toFixed(2)}% unlocked`
              : null}
          />
          <GameCard title="First Completion" game={era.firstCompletion} subtitle={firstCompSubtitle} />
          <GameCard title="Fastest Completion" game={era.fastestCompletion} subtitle={fastestSubtitle} />
          <GameCard title="Most Played" game={era.mostPlayedGame} subtitle={mostPlayedSubtitle} />
        </div>
      </div>
    </div>
  );
};

const XboxStory = () => {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/Story`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        setStory(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="story-loading">Loading your Xbox Story...</div>;
  if (error) return <div className="story-error">Error loading story: {error}</div>;
  if (!story) return null;

  const genreData = (story.topGenres || []).map(g => ({
    ...g,
    displayValue: g.minutes > 0 ? g.minutes : g.gameCount,
    displayLabel: g.minutes > 0 ? formatMinutes(g.minutes) : `${g.gameCount} games`,
  }));

  const totalGamerscore = (story.timeline || []).reduce((s, e) => s + (e.gamerscore || 0), 0);
  const totalAchievements = (story.timeline || []).reduce((s, e) => s + (e.achievementsUnlocked || 0), 0);

  return (
    <div className="xbox-story">
      {/* Header */}
      <div className="story-header">
        <div className="story-header-bg" />
        <div className="story-header-content">
          <div className="story-profile-image">
            <img src={placeholderIcon} alt="Profile" />
          </div>
          <div className="story-header-text">
            <div className="story-title">My Xbox Story</div>
            <div className="story-subtitle">
              <span className="subtitle-stat">{totalGamerscore.toLocaleString()}<GamerscoreIcon className="gs-icon" /></span>
              <span className="subtitle-sep">·</span>
              <span className="subtitle-stat">{totalAchievements.toLocaleString()} achievements</span>
              <span className="subtitle-sep">·</span>
              <span className="subtitle-stat">{(story.totalGames || 0).toLocaleString()} games</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issue 5: Vertical timeline with per-era grouping */}
      {story.timeline && story.timeline.length > 0 && (
        <div className="story-section">
          <h2 className="section-heading">My Gaming Timeline</h2>
          <div className="story-timeline-vertical">
            {story.timeline.map((era, i) => (
              <TimelineEra key={i} era={era} />
            ))}
          </div>
        </div>
      )}

      {/* Issue 1: Monthly heatmap matrix */}
      {story.activityCalendar && story.activityCalendar.length > 0 && (
        <div className="story-section">
          <h2 className="section-heading">Activity Heatmap</h2>
          <div className="story-card calendar-container">
            <MonthlyMatrix
              activityCalendar={story.activityCalendar}
              startYear={story.calendarStartYear}
              endYear={story.calendarEndYear}
            />
          </div>
        </div>
      )}

      {/* Overall stats */}
      <div className="story-section">
        <h2 className="section-heading">Overall Stats</h2>
        <div className="story-stats-row">
          <StatCard
            label="Games Completed"
            value={story.gamesCompleted}
            sub={`of ${story.totalGames} games`}
          />
          <StatCard label="Demos Played" value={story.demosPlayed} />
          <StatCard
            label="Completion"
            value={`${story.completionPercentage}%`}
            sub="of all achievements"
          />
        </div>
      </div>

      {/* Issue 2: Top genres as pie chart */}
      {genreData.length > 0 && (
        <div className="story-section">
          <h2 className="section-heading">Top Played Genres</h2>
          <div className="story-card genre-chart-card">
            <div className="genre-chart-layout">
              <div className="genre-chart-area">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={genreData}
                      dataKey="displayValue"
                      nameKey="genre"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                    >
                      {genreData.map((entry, index) => (
                        <Cell key={index} fill={GENRE_COLORS[index % GENRE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="genre-labels">
                {genreData.map((g, i) => (
                  <div key={i} className="genre-label-row">
                    <div className="genre-color-dot" style={{ backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] }} />
                    <span className="genre-name">{g.genre}</span>
                    <span className="genre-value">{g.displayLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default XboxStory;
