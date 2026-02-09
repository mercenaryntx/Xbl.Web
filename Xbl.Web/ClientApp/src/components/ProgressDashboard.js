import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ProgressDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://localhost:7238';

const ProgressDashboard = ({ profile }) => {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('yearly');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartType, setChartType] = useState('gamerscore');
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    fetchTrends();
  }, [profile]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/Progress/trends`;
      console.log('Fetching progress data from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch progress data: ${response.status} ${response.statusText}. ${errorText}`);
      }
      const data = await response.json();
      setTrends(data);
      
      // Extract available years from yearly data
      if (data.yearly && data.yearly.length > 0) {
        const years = data.yearly
          .map(d => parseInt(d.period))
          .filter(y => !isNaN(y))
          .sort((a, b) => b - a); // Descending order
        setAvailableYears(years);
        if (years.length > 0 && !years.includes(selectedYear)) {
          setSelectedYear(years[0]); // Set to most recent year
        }
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="progress-dashboard loading">Loading progress data...</div>;
  }

  if (error) {
    return <div className="progress-dashboard error">Error: {error}</div>;
  }

  if (!trends) {
    return <div className="progress-dashboard">No progress data available</div>;
  }

  // Get data based on selected period and year
  const getFilteredData = () => {
    if (!trends) return [];
    
    if (selectedPeriod === 'yearly') {
      return trends.yearly || [];
    } else if (selectedPeriod === 'monthly') {
      // Backend now provides data grouped by year
      return trends.monthlyByYear && trends.monthlyByYear[selectedYear] 
        ? trends.monthlyByYear[selectedYear] 
        : [];
    } else if (selectedPeriod === 'weekly') {
      // Backend now provides data grouped by year
      return trends.weeklyByYear && trends.weeklyByYear[selectedYear]
        ? trends.weeklyByYear[selectedYear]
        : [];
    }
    return [];
  };
  
  const data = getFilteredData();
  
  const renderChart = () => {
    const dataKey = chartType === 'gamerscore' ? 'gamerscore' : 'achievements';
    const name = chartType === 'gamerscore' ? 'Gamerscore' : 'Achievements';
    const color = chartType === 'gamerscore' ? '#82ca9d' : '#8884d8';
    
    // Chart area: 339px for all views
    // Weekly needs taller X-axis for vertical labels
    const chartHeight = selectedPeriod === 'weekly' ? 420 : 400;
    const xAxisHeight = selectedPeriod === 'weekly' ? 50 : 30;

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="period" 
            stroke="#aaa"
            tick={{ fill: '#aaa', fontSize: 11 }}
            angle={selectedPeriod === 'weekly' ? -90 : 0}
            textAnchor={selectedPeriod === 'weekly' ? 'end' : 'middle'}
            height={xAxisHeight}
            interval={selectedPeriod === 'weekly' ? 0 : 'preserveStartEnd'}
            dy={selectedPeriod === 'weekly' ? 15 : 0}
          />
          <YAxis 
            stroke="#aaa"
            tick={{ fill: '#aaa' }}
            label={{ value: name, angle: -90, position: 'insideLeft', fill: '#aaa' }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend />
          <Bar 
            dataKey={dataKey}
            fill={color}
            name={name}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const calculateStats = () => {
    if (!data.length) return { totalAchievements: 0, totalGamerscore: 0, avgPerPeriod: 0, avgLabel: '' };
    
    const totalAchievements = data.reduce((sum, d) => sum + d.achievements, 0);
    const totalGamerscore = data.reduce((sum, d) => sum + d.gamerscore, 0);
    
    const periodName = selectedPeriod === 'weekly' ? 'Week' : selectedPeriod === 'monthly' ? 'Month' : 'Year';
    
    let avgPerPeriod, avgLabel;
    if (chartType === 'gamerscore') {
      avgPerPeriod = (totalGamerscore / data.length).toFixed(1);
      avgLabel = `Avg GS per ${periodName}`;
    } else {
      avgPerPeriod = (totalAchievements / data.length).toFixed(1);
      avgLabel = `Avg Ach. per ${periodName}`;
    }
    
    return {
      totalAchievements: totalAchievements,
      totalGamerscore: totalGamerscore,
      avgPerPeriod: avgPerPeriod,
      avgLabel: avgLabel
    };
  };

  const stats = calculateStats();

  return (
    <div className="progress-dashboard">
      <div className="dashboard-header">
        <h2>&#127942; Achievement Progress Dashboard</h2>
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalAchievements.toLocaleString()}</div>
            <div className="stat-label">Total Achievements</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalGamerscore.toLocaleString()}</div>
            <div className="stat-label">Total Gamerscore</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.avgPerPeriod}</div>
            <div className="stat-label">{stats.avgLabel}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="control-group">
          <label>Time Period:</label>
          <div className="button-group">
            <button 
              className={selectedPeriod === 'yearly' ? 'active' : ''}
              onClick={() => setSelectedPeriod('yearly')}
            >
              Yearly
            </button>
            <button 
              className={selectedPeriod === 'monthly' ? 'active' : ''}
              onClick={() => setSelectedPeriod('monthly')}
            >
              Monthly
            </button>
            <button 
              className={selectedPeriod === 'weekly' ? 'active' : ''}
              onClick={() => setSelectedPeriod('weekly')}
            >
              Weekly
            </button>
          </div>
        </div>

        {(selectedPeriod === 'monthly' || selectedPeriod === 'weekly') && availableYears.length > 0 && (
          <div className="control-group">
            <label>Year:</label>
            <select 
              className="year-selector"
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        )}

        <div className="control-group">
          <label>View:</label>
          <div className="button-group">
            <button 
              className={chartType === 'gamerscore' ? 'active' : ''}
              onClick={() => setChartType('gamerscore')}
            >
              Gamerscore
            </button>
            <button 
              className={chartType === 'achievements' ? 'active' : ''}
              onClick={() => setChartType('achievements')}
            >
              Achievements
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-chart">
        {renderChart()}
      </div>

      <div className="dashboard-info">
        <p>
          {selectedPeriod === 'yearly' 
            ? `Showing ${chartType} earned per year.`
            : `Showing ${chartType} earned per ${selectedPeriod === 'monthly' ? 'month' : 'week'} in ${selectedYear}.`
          }
        </p>
      </div>
    </div>
  );
};

export default ProgressDashboard;
