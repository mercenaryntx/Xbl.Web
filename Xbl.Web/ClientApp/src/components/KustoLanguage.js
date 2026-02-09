import { LanguageSupport, StreamLanguage } from '@codemirror/language';

// Kusto/KQL language definition for CodeMirror
const kustoLanguage = StreamLanguage.define({
  startState: () => ({ inComment: false }),
  
  token: (stream, state) => {
    // Handle comments
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }
    
    // Handle strings
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) {
      return 'string';
    }
    if (stream.match(/^'(?:[^'\\]|\\.)*'/)) {
      return 'string';
    }
    
    // Handle numbers
    if (stream.match(/^-?\d+(\.\d+)?/)) {
      return 'number';
    }
    
    // Handle operators
    if (stream.match(/^[+\-*/%<>=!&|]/)) {
      return 'operator';
    }
    
    // Handle pipe operator (special in Kusto)
    if (stream.match('|')) {
      return 'keyword';
    }
    
    // Handle keywords and operators
    const keywords = /^(where|project|order|by|asc|desc|take|limit|summarize|count|extend|join|union|let|as|on|and|or|not|in|contains|startswith|endswith|matches|has|bin|ago|now|datetime|timespan|true|false|null)\b/i;
    if (stream.match(keywords)) {
      return 'keyword';
    }
    
    // Handle table names (titles, achievements, stats)
    if (stream.match(/^(titles|achievements|stats)\b/)) {
      return 'def';
    }
    
    // Handle column names (common ones)
    const columns = /^(Name|TitleId|TitleName|Platform|Category|CurrentAchievements|TotalAchievements|CurrentGamerscore|TotalGamerscore|ProgressPercentage|LastTimePlayed|IsUnlocked|TimeUnlocked|IsSecret|Description|Gamerscore|IsRare|RarityPercentage|Minutes)\b/;
    if (stream.match(columns)) {
      return 'property';
    }
    
    // Handle functions
    if (stream.match(/^\w+(?=\()/)) {
      return 'function';
    }
    
    // Skip whitespace
    if (stream.eatSpace()) {
      return null;
    }
    
    // Default: consume one character
    stream.next();
    return null;
  }
});

export function kusto() {
  return new LanguageSupport(kustoLanguage);
}
