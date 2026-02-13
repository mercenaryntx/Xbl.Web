import React, { useState, useCallback, useEffect } from 'react';
import { getHeaders } from '../lastUpdate';
import { PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CodeMirror from '@uiw/react-codemirror';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { kusto } from './KustoLanguage';
import { kustoCompletions } from './KustoAutocomplete';
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
const [viewMode, setViewMode] = useState('table'); // table, pie, line, bar, stackedColumn, stackedArea
const [showHelp, setShowHelp] = useState(false);
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(100);
const [pagination, setPagination] = useState(null);
const [chartDataLimit, setChartDataLimit] = useState(50);
const [chartSettings, setChartSettings] = useState({
  xAxisColumn: 0,
  valueColumns: [],
  groupByColumn: null,
  autoDetect: true
});
const [showChartSettings, setShowChartSettings] = useState(false);
const [rawData, setRawData] = useState(null); // Store raw data separately

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

  const executeCustomQuery = async (page = 1, customPageSize = null) => {
    if (!customQuery.trim()) {
      setError('Please enter a query');
      return;
    }

    const effectivePageSize = customPageSize !== null ? customPageSize : pageSize;

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
          pageSize: effectivePageSize
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Query response:', data); // Debug log
      
      const columnNames = data.columns.map(c => c.name);
      const columnTypes = detectColumnTypes(columnNames, data.rows);
      
      // Auto-detect default settings
      const defaultSettings = {
        xAxisColumn: columnTypes.string.length > 0 ? columnTypes.string[0] : 0,
        valueColumns: columnTypes.numeric.length > 0 ? [columnTypes.numeric[0]] : [],
        groupByColumn: columnTypes.string.length > 1 ? columnTypes.string[1] : null,
        autoDetect: true
      };
      
      setChartSettings(defaultSettings);
      
      // Store raw data separately
      setRawData({
        columns: columnNames,
        rows: data.rows
      });
      
      setQueryResults({
        columns: columnNames,
        rows: data.rows,
        fullChartData: convertToChartData(columnNames, data.rows, defaultSettings)
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
      executeCustomQuery(1, newSize);
    }
  };

  const updateChartSettings = (newSettings) => {
    setChartSettings(newSettings);
  };

  // Rebuild chart data when settings or viewMode change
  useEffect(() => {
    if (rawData && rawData.rows && rawData.columns) {
      const newChartData = convertToChartData(rawData.columns, rawData.rows, chartSettings);
      setQueryResults(prev => prev ? {
        ...prev,
        fullChartData: newChartData
      } : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartSettings, viewMode, rawData]);

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
          fullChartData: data.profiles.map(p => ({ name: p.name, value: p.gamerscore }))
        };
      
      case 'rarity':
        return {
          columns: ['Title', 'Achievement', 'Rarity %'],
          rows: data.map(r => [r.title, r.achievement, r.percentage.toFixed(2) + '%']),
          fullChartData: data.map(r => ({ 
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
          fullChartData: data.map(c => ({ 
            name: c.title.substring(0, 20) + (c.title.length > 20 ? '...' : ''), 
            value: c.progressPercentage 
          }))
        };
      
      case 'time':
        return {
          columns: ['Title', 'Time Played'],
          rows: data.map(t => [t.Title || t.title || 'Unknown', formatMinutes(t.Minutes || t.minutes || 0)]),
          fullChartData: data.map(t => ({ 
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
          fullChartData: data.map(w => ({ 
            name: ((w.title || w.Title) || 'Unknown').substring(0, 20) + (((w.title || w.Title) || '').length > 20 ? '...' : ''), 
            value: w.weight || w.Weight || 0
          }))
        };
      
      case 'categories':
        return {
          columns: ['Category', 'Count'],
          rows: data.map(c => [c.category, c.count]),
          fullChartData: data.map(c => ({ name: c.category, value: c.count }))
        };
      
      default:
        return { columns: [], rows: [], chartData: [] };
    }
  };

  const detectColumnTypes = (columns, rows) => {
    if (rows.length === 0) return { numeric: [], string: [] };
    
    const numeric = [];
    const string = [];
    
    columns.forEach((col, idx) => {
      const sampleValues = rows.slice(0, Math.min(10, rows.length)).map(row => row[idx]);
      const hasNumeric = sampleValues.some(val => typeof val === 'number');
      
      if (hasNumeric) {
        numeric.push(idx);
      } else {
        string.push(idx);
      }
    });
    
    return { numeric, string };
  };

  const convertToChartData = (columns, rows, settings = null) => {
    if (rows.length === 0) return [];
    
    const currentSettings = settings || chartSettings;
    
    if (currentSettings.autoDetect) {
      // Auto-detect mode
      const columnTypes = detectColumnTypes(columns, rows);
      const xAxisCol = columnTypes.string.length > 0 ? columnTypes.string[0] : 0;
      const valueCol = columnTypes.numeric.length > 0 ? columnTypes.numeric[0] : -1;
      const groupCol = columnTypes.string.length > 1 ? columnTypes.string[1] : null;
      
      if (valueCol === -1) return [];

      // If we have a grouping column and are in stacked mode, use grouping
      if (groupCol !== null && (viewMode === 'stackedColumn' || viewMode === 'stackedArea')) {
        return convertToMultiSeriesData(columns, rows, {
          xAxisColumn: xAxisCol,
          valueColumns: [valueCol],
          groupByColumn: groupCol,
          autoDetect: true
        });
      }

      // Simple mode: no grouping
      return rows.map((row) => ({
        name: String(row[xAxisCol]).substring(0, 20) + (String(row[xAxisCol]).length > 20 ? '...' : ''),
        value: row[valueCol]
      }));
    } else {
      // Manual mode: use configured settings
      return convertToMultiSeriesData(columns, rows, currentSettings);
    }
  };

  const convertToMultiSeriesData = (columns, rows, settings = null) => {
    if (rows.length === 0) return [];
    
    const currentSettings = settings || chartSettings;
    const { xAxisColumn, valueColumns, groupByColumn } = currentSettings;
    
    if (groupByColumn !== null && groupByColumn >= 0) {
      // Group data by the grouping column
      const grouped = {};
      
      rows.forEach(row => {
        const xValue = String(row[xAxisColumn]);
        const groupValue = String(row[groupByColumn]);
        
        if (!grouped[xValue]) {
          grouped[xValue] = { name: xValue.substring(0, 20) + (xValue.length > 20 ? '...' : '') };
        }
        
        // When grouping, use just the group value as the series key
        // This ensures each unique group becomes a separate series
        valueColumns.forEach(colIdx => {
          const value = typeof row[colIdx] === 'number' ? row[colIdx] : 0;
          // Use just the group value as the key so all groups appear as separate series
          grouped[xValue][groupValue] = (grouped[xValue][groupValue] || 0) + value;
        });
      });
      
      return Object.values(grouped);
    } else {
      // No grouping - each value column becomes a series
      return rows.map(row => {
        const dataPoint = {
          name: String(row[xAxisColumn]).substring(0, 20) + (String(row[xAxisColumn]).length > 20 ? '...' : '')
        };
        
        valueColumns.forEach(colIdx => {
          const value = typeof row[colIdx] === 'number' ? row[colIdx] : 0;
          dataPoint[columns[colIdx]] = value;
        });
        
        return dataPoint;
      });
    }
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
    if (!queryResults?.fullChartData || queryResults.fullChartData.length === 0) {
      return <div className="no-chart">No chart data available for this query</div>;
    }

    const data = queryResults.fullChartData.slice(0, chartDataLimit);
    
    // Get all series keys (excluding 'name') from ALL data points
    // This is important because some series might not appear in every data point
    const seriesKeysSet = new Set();
    data.forEach(dataPoint => {
      Object.keys(dataPoint).forEach(key => {
        if (key !== 'name') {
          seriesKeysSet.add(key);
        }
      });
    });
    const seriesKeys = Array.from(seriesKeysSet);
    
    const isSingleSeries = seriesKeys.length === 1 && seriesKeys[0] === 'value';

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
              {seriesKeys.map((key, idx) => (
                <Line 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stroke={COLORS[idx % COLORS.length]} 
                  strokeWidth={2}
                  name={key}
                />
              ))}
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
              {seriesKeys.map((key, idx) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  fill={COLORS[idx % COLORS.length]}
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'stackedColumn':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              {seriesKeys.map((key, idx) => (
                <Bar 
                  key={key} 
                  dataKey={key} 
                  stackId="a" 
                  fill={COLORS[idx % COLORS.length]} 
                  name={key}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'stackedArea':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#fff" />
              <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #444' }} />
              <Legend />
              {seriesKeys.map((key, idx) => (
                <Area 
                  key={key} 
                  type="monotone" 
                  dataKey={key} 
                  stackId="1" 
                  stroke={COLORS[idx % COLORS.length]} 
                  fill={COLORS[idx % COLORS.length]}
                  name={key}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const loadSampleQuery = (sample) => {
    setCustomQuery(sample.query);
  };

  const handleQueryChange = useCallback((value) => {
    setCustomQuery(value);
  }, []);

  const handleKeyDown = useCallback((event) => {
    // Execute query on Ctrl+Enter or Cmd+Enter
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      executeCustomQuery();
    }
  }, [customQuery, executeCustomQuery]);

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
          <div className="query-editor-container">
            <CodeMirror
              value={customQuery}
              height="200px"
              theme="dark"
              extensions={[
                kusto(),
                autocompletion({
                  override: [kustoCompletions],
                  activateOnTyping: true,
                  closeOnBlur: true
                }),
                keymap.of(defaultKeymap)
              ]}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Enter your Kusto query here...

Available tables: titles, achievements, stats

Example:
titles
| where ProgressPercentage > 50
| project Name, ProgressPercentage
| order by ProgressPercentage desc

Press Ctrl+Enter to execute"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightSpecialChars: true,
                foldGutter: true,
                drawSelection: true,
                dropCursor: true,
                allowMultipleSelections: true,
                indentOnInput: true,
                syntaxHighlighting: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                crosshairCursor: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                closeBracketsKeymap: true,
                searchKeymap: true,
                foldKeymap: true,
                completionKeymap: true,
                lintKeymap: true
              }}
            />
          </div>
          <button
            className="execute-btn"
            onClick={() => executeCustomQuery()}
            disabled={loadingState || !customQuery.trim()}
          >
            Execute Query <span className="shortcut-hint">(Ctrl+Enter)</span>
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
              className={`view-btn ${viewMode === 'stackedColumn' ? 'active' : ''}`}
              onClick={() => setViewMode('stackedColumn')}
            >
              <span className="btn-icon">&#128207;</span> Stacked Column
            </button>
            <button
              className={`view-btn ${viewMode === 'stackedArea' ? 'active' : ''}`}
              onClick={() => setViewMode('stackedArea')}
            >
              <span className="btn-icon">&#128200;</span> Stacked Area
            </button>
          </div>

          {viewMode !== 'table' && (
            <>
              <div className="chart-controls">
                <label>Chart data points:</label>
                <select
                  value={chartDataLimit}
                  onChange={(e) => setChartDataLimit(parseInt(e.target.value))}
                  disabled={loadingState}
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="250">250</option>
                  <option value="500">500</option>
                </select>
                <span className="chart-info">
                  {queryResults?.fullChartData && `(${Math.min(chartDataLimit, queryResults.fullChartData.length)} of ${queryResults.fullChartData.length} shown)`}
                </span>
                <button
                  className="settings-toggle-btn"
                  onClick={() => setShowChartSettings(!showChartSettings)}
                >
                  <span className="settings-icon"></span> {showChartSettings ? 'Hide' : 'Show'} Settings
                </button>
              </div>

              {showChartSettings && (
                <div className="chart-settings-panel">
                  <h3>Chart Configuration</h3>
                  
                  <div className="settings-group">
                    <label className="settings-checkbox">
                      <input
                        type="checkbox"
                        checked={chartSettings.autoDetect}
                        onChange={(e) => updateChartSettings({ ...chartSettings, autoDetect: e.target.checked })}
                      />
                      <span>Auto-detect columns</span>
                    </label>
                  </div>

                  {!chartSettings.autoDetect && (
                    <>
                      <div className="settings-group">
                        <label>X-Axis Column:</label>
                        <select
                          value={chartSettings.xAxisColumn}
                          onChange={(e) => updateChartSettings({ ...chartSettings, xAxisColumn: parseInt(e.target.value) })}
                        >
                          {queryResults.columns.map((col, idx) => (
                            <option key={idx} value={idx}>{col}</option>
                          ))}
                        </select>
                      </div>

                      <div className="settings-group">
                        <label>Value Column(s):</label>
                        <div className="column-checkboxes">
                          {queryResults.columns.map((col, idx) => (
                            <label key={idx} className="column-checkbox">
                              <input
                                type="checkbox"
                                checked={chartSettings.valueColumns.includes(idx)}
                                onChange={(e) => {
                                  const newValueColumns = e.target.checked
                                    ? [...chartSettings.valueColumns, idx]
                                    : chartSettings.valueColumns.filter(i => i !== idx);
                                  updateChartSettings({ ...chartSettings, valueColumns: newValueColumns });
                                }}
                              />
                              <span>{col}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {(viewMode === 'stackedColumn' || viewMode === 'stackedArea') && (
                        <div className="settings-group">
                          <label>Group By Column (for stacking):</label>
                          <select
                            value={chartSettings.groupByColumn === null ? '' : chartSettings.groupByColumn}
                            onChange={(e) => updateChartSettings({ 
                              ...chartSettings, 
                              groupByColumn: e.target.value === '' ? null : parseInt(e.target.value)
                            })}
                          >
                            <option value="">None</option>
                            {queryResults.columns.map((col, idx) => (
                              <option key={idx} value={idx}>{col}</option>
                            ))}
                          </select>
                          <p className="settings-hint">
                            Select a column to group and stack data. Each unique value becomes a separate series.
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {chartSettings.autoDetect && (
                    <div className="settings-info">
                      <p>Auto-detect mode uses:</p>
                      <ul>
                        <li>First column as X-axis</li>
                        <li>First numeric column as values</li>
                        <li>Second string column for grouping (if available)</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

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

          {pagination && (
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
