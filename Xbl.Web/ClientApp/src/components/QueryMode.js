import React, { useState } from 'react';
import { getHeaders } from '../lastUpdate';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import loading from '../assets/images/loading.svg';
import './QueryMode.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

const PREDEFINED_QUERIES = [
  { id: 'summary', name: 'Profile Summary', description: 'Quick summary about your profiles' },
  { id: 'rarity', name: 'Rarest Achievements', description: 'Your rarest unlocked achievements' },
  { id: 'completeness', name: 'Most Complete Games', description: 'Games with highest completion percentage' },
  { id: 'time', name: 'Time Spent', description: 'Games you spent the most time with' },
  { id: 'weighted-rarity', name: 'Weighted Rarity', description: 'Games with the most rarest achievements' },
  { id: 'categories', name: 'Categories', description: 'Game distribution by category' }
];

const SAMPLE_KUSTO_QUERIES = [
  { 
    name: 'Top 10 Games by Gamerscore', 
    query: 'titles\n| project Name, Gamerscore = CurrentGamerscore\n| order by Gamerscore desc\n| take 10'
  },
  { 
    name: 'Achievements Under 1% Rarity', 
    query: 'achievements\n| where IsUnlocked == true and RarityPercentage < 1.0\n| project TitleName, Name, RarityPercentage\n| order by RarityPercentage asc'
  },
  { 
    name: 'Completion Rate Distribution', 
    query: 'titles\n| summarize Count = count() by bin(ProgressPercentage, 10)\n| order by ProgressPercentage asc'
  }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

const TABLE_SCHEMAS = {
  titles: {
    description: 'Game titles and their achievement progress',
    columns: [
      { name: 'Name', type: 'string', description: 'Game title' },
      { name: 'TitleId', type: 'int', description: 'Unique title identifier' },
      { name: 'Platform', type: 'string', description: 'Platform name' },
      { name: 'Category', type: 'string', description: 'Game category' },
      { name: 'CurrentAchievements', type: 'int', description: 'Unlocked achievements count' },
      { name: 'TotalAchievements', type: 'int', description: 'Total achievements available' },
      { name: 'CurrentGamerscore', type: 'int', description: 'Current gamerscore earned' },
      { name: 'TotalGamerscore', type: 'int', description: 'Total gamerscore available' },
      { name: 'ProgressPercentage', type: 'double', description: 'Completion percentage' },
      { name: 'LastTimePlayed', type: 'datetime', description: 'Last play date' }
    ]
  },
  achievements: {
    description: 'Individual achievements and their details',
    columns: [
      { name: 'Name', type: 'string', description: 'Achievement name' },
      { name: 'TitleId', type: 'string', description: 'Associated title ID' },
      { name: 'TitleName', type: 'string', description: 'Associated game name' },
      { name: 'IsUnlocked', type: 'bool', description: 'Whether unlocked' },
      { name: 'TimeUnlocked', type: 'datetime', description: 'When unlocked' },
      { name: 'Platform', type: 'string', description: 'Platform name' },
      { name: 'IsSecret', type: 'bool', description: 'Is secret achievement' },
      { name: 'Description', type: 'string', description: 'Achievement description' },
      { name: 'Gamerscore', type: 'int', description: 'Points awarded' },
      { name: 'IsRare', type: 'bool', description: 'Is rare achievement' },
      { name: 'RarityPercentage', type: 'double', description: 'Unlock percentage' }
    ]
  },
  stats: {
    description: 'Game statistics (currently only time played)',
    columns: [
      { name: 'Minutes', type: 'int', description: 'Minutes played' }
    ]
  }
};

const QueryMode = () => {
const [selectedQuery, setSelectedQuery] = useState('');
const [customQuery, setCustomQuery] = useState('');
const [queryResults, setQueryResults] = useState(null);
const [loadingState, setLoadingState] = useState(false);
const [error, setError] = useState(null);
const [viewMode, setViewMode] = useState('table'); // table, pie, line, bar, stacked
const [showHelp, setShowHelp] = useState(false);
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(100);
const [pagination, setPagination] = useState(null);

  const executeBuiltInQuery = async (queryType) => {
    setLoadingState(true);
    setError(null);
    setQueryResults(null);
    
    try {
      const headers = await getHeaders(API_BASE_URL);
      const response = await fetch(`${API_BASE_URL}/Queries/built-in/${queryType}?limit=50`, { headers });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setQueryResults(processBuiltInQueryResults(queryType, data));
      setSelectedQuery(queryType);
    } catch (err) {
      setError(`Failed to execute query: ${err.message}`);
    } finally {
      setLoadingState(false);
    }
  };

  const executeCustomQuery = async (page = 1) => {
    if (!customQuery.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoadingState(true);
    setError(null);
    if (page === 1) {
      setQueryResults(null);
      setPagination(null);
    }
    
    try {
      const baseHeaders = await getHeaders(API_BASE_URL);
      const headers = {
        ...baseHeaders,
        'Content-Type': 'application/json'
      };
      
      const response = await fetch(`${API_BASE_URL}/Queries/kusto`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          query: customQuery,
          page: page,
          pageSize: pageSize
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Query response:', data); // Debug log
      setQueryResults({
        columns: data.columns.map(c => c.name),
        rows: data.rows,
        chartData: convertToChartData(data.columns.map(c => c.name), data.rows)
      });
      setPagination(data.pagination);
      console.log('Pagination data:', data.pagination); // Debug log
      setCurrentPage(page);
      setSelectedQuery('custom');
    } catch (err) {
      setError(`Failed to execute query: ${err.message}`);
    } finally {
      setLoadingState(false);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || (pagination && page > pagination.totalPages)) return;
    executeCustomQuery(page);
  };

  const changePageSize = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    if (selectedQuery === 'custom' && customQuery.trim()) {
      executeCustomQuery(1);
    }
  };

  const processBuiltInQueryResults = (queryType, data) => {
    switch (queryType) {
      case 'summary':
        return {
          columns: ['Name', 'Games', 'Achievements', 'Gamerscore', 'Time Played'],
          rows: data.profiles.map(p => [
            p.name,
            p.games,
            p.achievements,
            p.gamerscore,
            formatTimeSpan(p.minutesPlayed)
          ]),
          summary: `Total unique games: ${data.uniqueGames}`,
          chartData: data.profiles.map(p => ({ name: p.name, value: p.gamerscore }))
        };
      
      case 'rarity':
        return {
          columns: ['Title', 'Achievement', 'Rarity %'],
          rows: data.map(r => [r.title, r.achievement, r.percentage.toFixed(2) + '%']),
          chartData: data.slice(0, 10).map(r => ({ 
            name: r.achievement.substring(0, 20) + (r.achievement.length > 20 ? '...' : ''), 
            value: r.percentage 
          }))
        };
      
      case 'completeness':
        return {
          columns: ['Title', 'Platform', 'Progress %', 'Gamerscore'],
          rows: data.map(c => [
            c.title,
            c.platform,
            c.progressPercentage.toFixed(2) + '%',
            `${c.currentGamerscore}/${c.totalGamerscore}`
          ]),
          chartData: data.slice(0, 10).map(c => ({ 
            name: c.title.substring(0, 20) + (c.title.length > 20 ? '...' : ''), 
            value: c.progressPercentage 
          }))
        };
      
      case 'time':
        return {
          columns: ['Title', 'Time Played'],
          rows: data.map(t => [t.Title || t.title || 'Unknown', formatMinutes(t.Minutes || t.minutes || 0)]),
          chartData: data.slice(0, 10).map(t => ({ 
            name: ((t.Title || t.title) || 'Unknown').substring(0, 20) + (((t.Title || t.title) || '').length > 20 ? '...' : ''), 
            value: t.Minutes || t.minutes || 0
          }))
        };
      
      case 'weighted-rarity':
        return {
          columns: ['Title', 'Total Achievements', 'Unlocked', 'Rare Unlocked', 'Weight Score'],
          rows: data.map(w => [
            w.title || w.Title || 'Unknown',
            w.totalCount || w.totalAchievements || w.TotalCount || 0,
            w.achievedCount || w.unlockedCount || w.AchievedCount || 0,
            w.rareCount || w.rareUnlockedCount || w.RareCount || 0,
            (w.weight || w.Weight || 0).toFixed(2)
          ]),
          chartData: data.slice(0, 10).map(w => ({ 
            name: ((w.title || w.Title) || 'Unknown').substring(0, 20) + (((w.title || w.Title) || '').length > 20 ? '...' : ''), 
            value: w.weight || w.Weight || 0
          }))
        };
      
      case 'categories':
        return {
          columns: ['Category', 'Count'],
          rows: data.map(c => [c.category, c.count]),
          chartData: data.map(c => ({ name: c.category, value: c.count }))
        };
      
      default:
        return { columns: [], rows: [], chartData: [] };
    }
  };

  const convertToChartData = (columns, rows) => {
    if (rows.length === 0) return [];
    
    // Try to find numeric columns for charting
    const firstRow = rows[0];
    const numericColumnIndex = firstRow.findIndex(val => typeof val === 'number');
    
    if (numericColumnIndex === -1) return [];

    return rows.slice(0, 10).map((row, idx) => ({
      name: String(row[0]).substring(0, 20) + (String(row[0]).length > 20 ? '...' : ''),
      value: row[numericColumnIndex]
    }));
  };

  const formatTimeSpan = (timeSpan) => {
    if (!timeSpan) return '0h';
    const match = timeSpan.match(/(\d+)\.(\d+):(\d+):(\d+)/);
    if (!match) return timeSpan;
    const days = parseInt(match[1]);
    const hours = parseInt(match[2]);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  const renderChart = () => {
    if (!queryResults?.chartData || queryResults.chartData.length === 0) {
      return <div className="no-chart">No chart data available for this query</div>;
    }

    const data = queryResults.chartData;

    switch (viewMode) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#00C49F" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              <Bar dataKey="value" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'stacked':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              <Bar dataKey="value" stackId="a" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const loadSampleQuery = (sample) => {
    setCustomQuery(sample.query);
  };

  return (
    <div className="query-mode">
      <h1>Query Mode</h1>

      <div className="query-sections">
        <div className="predefined-section">
          <h2>Pre-defined Queries</h2>
          <div className="query-buttons">
            {PREDEFINED_QUERIES.map(q => (
              <button
                key={q.id}
                className={`query-btn ${selectedQuery === q.id ? 'active' : ''}`}
                onClick={() => executeBuiltInQuery(q.id)}
                disabled={loadingState}
              >
                <div className="query-btn-name">{q.name}</div>
                <div className="query-btn-desc">{q.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="custom-section">
          <h2>Custom Kusto Query</h2>
          
          <div className="help-toggle">
            <button 
              className="help-btn" 
              onClick={() => setShowHelp(!showHelp)}
            >
              <span className={`toggle-icon ${showHelp ? 'open' : ''}`}>{showHelp ? '-' : '+'}</span> 
              {showHelp ? 'Hide' : 'Show'} Table Schema
            </button>
          </div>

          {showHelp && (
            <div className="schema-help">
              {Object.entries(TABLE_SCHEMAS).map(([tableName, schema]) => (
                <div key={tableName} className="schema-table">
                  <h3>{tableName}</h3>
                  <p className="schema-description">{schema.description}</p>
                  <div className="schema-columns">
                    {schema.columns.map((col, idx) => (
                      <div key={idx} className="schema-column">
                        <span className="col-name">{col.name}</span>
                        <span className="col-type">{col.type}</span>
                        <span className="col-desc">{col.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="schema-examples">
                <h3>Common Operators</h3>
                <ul>
                  <li><code>where</code> - Filter rows (e.g., <code>where IsUnlocked == true</code>)</li>
                  <li><code>project</code> - Select columns (e.g., <code>project Name, Gamerscore</code>)</li>
                  <li><code>order by</code> - Sort results (e.g., <code>order by Gamerscore desc</code>)</li>
                  <li><code>take</code> - Limit results (e.g., <code>take 10</code>)</li>
                  <li><code>summarize</code> - Aggregate data (e.g., <code>summarize count() by Category</code>)</li>
                </ul>
              </div>
            </div>
          )}

          <div className="sample-queries">
            <label>Sample queries:</label>
            <div className="sample-buttons">
              {SAMPLE_KUSTO_QUERIES.map((sample, idx) => (
                <button key={idx} onClick={() => loadSampleQuery(sample)} className="sample-btn">
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
          <textarea
            className="query-input"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Enter your Kusto query here...&#10;&#10;Available tables: titles, achievements, stats&#10;&#10;Example:&#10;titles&#10;| where ProgressPercentage > 50&#10;| project Name, ProgressPercentage&#10;| order by ProgressPercentage desc"
            rows={10}
          />
          <button
            className="execute-btn"
            onClick={() => executeCustomQuery()}
            disabled={loadingState || !customQuery.trim()}
          >
            Execute Query
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">&#9888;</span> {error}
        </div>
      )}

      {loadingState && (
        <div className="loading-centered">
          <img src={loading} alt="Loading..." />
        </div>
      )}

      {queryResults && !loadingState && (
        <div className="results-section">
          <div className="view-controls">
            <button
              className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              <span className="btn-icon">&#128203;</span> Table
            </button>
            <button
              className={`view-btn ${viewMode === 'pie' ? 'active' : ''}`}
              onClick={() => setViewMode('pie')}
            >
              <span className="btn-icon">&#9677;</span> Pie Chart
            </button>
            <button
              className={`view-btn ${viewMode === 'line' ? 'active' : ''}`}
              onClick={() => setViewMode('line')}
            >
              <span className="btn-icon">&#128200;</span> Line Chart
            </button>
            <button
              className={`view-btn ${viewMode === 'bar' ? 'active' : ''}`}
              onClick={() => setViewMode('bar')}
            >
              <span className="btn-icon">&#128202;</span> Bar Chart
            </button>
            <button
              className={`view-btn ${viewMode === 'stacked' ? 'active' : ''}`}
              onClick={() => setViewMode('stacked')}
            >
              <span className="btn-icon">&#128207;</span> Stacked
            </button>
          </div>

          {queryResults.summary && (
            <div className="summary-info">{queryResults.summary}</div>
          )}

          {pagination && (
            <div className="pagination-info">
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, pagination.totalRows)} of {pagination.totalRows} results
            </div>
          )}

          {viewMode === 'table' ? (
            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    {queryResults.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResults.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx}>{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="chart-container">
              {renderChart()}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-buttons">
                <button
                  className="pagination-btn"
                  onClick={() => goToPage(1)}
                  disabled={!pagination.hasPreviousPage || loadingState}
                >
                  First
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={!pagination.hasPreviousPage || loadingState}
                >
                  Previous
                </button>
                
                <div className="pagination-pages">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => goToPage(pageNum)}
                        disabled={loadingState}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  className="pagination-btn"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!pagination.hasNextPage || loadingState}
                >
                  Next
                </button>
                <button
                  className="pagination-btn"
                  onClick={() => goToPage(pagination.totalPages)}
                  disabled={!pagination.hasNextPage || loadingState}
                >
                  Last
                </button>
              </div>

              <div className="page-size-selector">
                <label>Rows per page:</label>
                <select
                  value={pageSize}
                  onChange={(e) => changePageSize(parseInt(e.target.value))}
                  disabled={loadingState}
                >
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QueryMode;
