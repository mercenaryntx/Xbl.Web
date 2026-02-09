import { CompletionContext } from '@codemirror/autocomplete';

// Kusto keywords
const kustoKeywords = [
  'where', 'project', 'order', 'by', 'asc', 'desc', 'take', 'limit',
  'summarize', 'count', 'extend', 'join', 'union', 'let', 'as', 'on',
  'and', 'or', 'not', 'in', 'contains', 'startswith', 'endswith',
  'matches', 'has', 'bin', 'ago', 'now', 'datetime', 'timespan',
  'true', 'false', 'null', 'distinct', 'top', 'sort'
];

// Table definitions with descriptions
const tables = [
  {
    label: 'titles',
    type: 'table',
    info: 'Game titles and their achievement progress',
    detail: 'table'
  },
  {
    label: 'achievements',
    type: 'table',
    info: 'Individual achievements and their details',
    detail: 'table'
  },
  {
    label: 'stats',
    type: 'table',
    info: 'Game statistics (time played)',
    detail: 'table'
  }
];

// Column definitions by table
const columns = {
  titles: [
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
  ],
  achievements: [
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
  ],
  stats: [
    { name: 'Minutes', type: 'int', description: 'Minutes played' }
  ]
};

// Common functions
const functions = [
  { label: 'count()', type: 'function', info: 'Count rows', detail: 'aggregation' },
  { label: 'sum()', type: 'function', info: 'Sum numeric values', detail: 'aggregation' },
  { label: 'avg()', type: 'function', info: 'Average numeric values', detail: 'aggregation' },
  { label: 'min()', type: 'function', info: 'Minimum value', detail: 'aggregation' },
  { label: 'max()', type: 'function', info: 'Maximum value', detail: 'aggregation' },
  { label: 'bin()', type: 'function', info: 'Group values into bins', detail: 'scalar' },
  { label: 'strlen()', type: 'function', info: 'String length', detail: 'scalar' },
  { label: 'substring()', type: 'function', info: 'Extract substring', detail: 'scalar' },
  { label: 'tolower()', type: 'function', info: 'Convert to lowercase', detail: 'scalar' },
  { label: 'toupper()', type: 'function', info: 'Convert to uppercase', detail: 'scalar' }
];

// Operators
const operators = [
  { label: '==', type: 'operator', info: 'Equals', detail: 'comparison' },
  { label: '!=', type: 'operator', info: 'Not equals', detail: 'comparison' },
  { label: '<', type: 'operator', info: 'Less than', detail: 'comparison' },
  { label: '>', type: 'operator', info: 'Greater than', detail: 'comparison' },
  { label: '<=', type: 'operator', info: 'Less than or equal', detail: 'comparison' },
  { label: '>=', type: 'operator', info: 'Greater than or equal', detail: 'comparison' },
  { label: 'contains', type: 'operator', info: 'String contains', detail: 'string' },
  { label: 'startswith', type: 'operator', info: 'String starts with', detail: 'string' },
  { label: 'endswith', type: 'operator', info: 'String ends with', detail: 'string' }
];

// Detect current table context
function getCurrentTable(context) {
  const text = context.state.doc.toString();
  const pos = context.pos;
  const textBefore = text.slice(0, pos);
  
  // Find the last table reference
  const tableMatch = textBefore.match(/(titles|achievements|stats)[\s\S]*$/);
  if (tableMatch) {
    const tableName = tableMatch[1];
    // Check if we're after a pipe operator (suggesting columns)
    if (textBefore.match(/\|\s*\w*$/)) {
      return { table: tableName, afterPipe: true };
    }
    return { table: tableName, afterPipe: false };
  }
  
  return { table: null, afterPipe: false };
}

export function kustoCompletions(context) {
  const word = context.matchBefore(/\w*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  const { table, afterPipe } = getCurrentTable(context);
  const completions = [];

  // If at the beginning or after pipe, suggest tables and keywords
  if (!table || afterPipe) {
    // Add table names
    completions.push(...tables.map(t => ({
      label: t.label,
      type: t.type,
      info: t.info,
      detail: t.detail
    })));

    // Add keywords
    completions.push(...kustoKeywords.map(k => ({
      label: k,
      type: 'keyword',
      detail: 'keyword'
    })));
  }

  // If we have a table context, suggest columns
  if (table && columns[table]) {
    completions.push(...columns[table].map(c => ({
      label: c.name,
      type: 'property',
      info: `${c.type}: ${c.description}`,
      detail: c.type
    })));
  }

  // Always suggest functions and operators
  completions.push(...functions);
  completions.push(...operators);

  return {
    from: word.from,
    options: completions,
    filter: false
  };
}
