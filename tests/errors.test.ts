import { 
  AnalyzerError, 
  ExplainError, 
  CsvError, 
  QueryExecutionError,
  ParseError 
} from '../src/errors';

describe('Error Classes', () => {
  describe('AnalyzerError', () => {
    it('should create error with all properties', () => {
      const originalError = new Error('Original error');
      const error = new AnalyzerError(
        'Test error',
        'TEST_CODE',
        'SELECT * FROM users',
        originalError
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AnalyzerError);
      expect(error.name).toBe('AnalyzerError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.originalError).toBe(originalError);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should generate formatted error message', () => {
      const error = new AnalyzerError(
        'Test error',
        'TEST_CODE',
        'SELECT * FROM users'
      );

      const formatted = error.getFormattedMessage();
      
      expect(formatted).toContain('[TEST_CODE]');
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Query: SELECT * FROM users');
      expect(formatted).toContain('Time:');
    });

    it('should convert to JSON', () => {
      const originalError = new Error('Original');
      const error = new AnalyzerError(
        'Test error',
        'TEST_CODE',
        'SELECT 1',
        originalError
      );

      const json = error.toJSON();

      expect(json.name).toBe('AnalyzerError');
      expect(json.code).toBe('TEST_CODE');
      expect(json.message).toBe('Test error');
      expect(json.query).toBe('SELECT 1');
      expect(json.timestamp).toBeDefined();
      expect(json.originalError).toBe('Original');
      expect(json.stack).toBeDefined();
    });

    it('should handle missing original error', () => {
      const error = new AnalyzerError(
        'Test error',
        'TEST_CODE',
        'SELECT 1'
      );

      expect(error.originalError).toBeUndefined();
      
      const json = error.toJSON();
      expect(json.originalError).toBeUndefined();
    });
  });

  describe('ExplainError', () => {
    it('should create ExplainError with correct properties', () => {
      const originalError = new Error('EXPLAIN failed');
      const error = new ExplainError('SELECT * FROM users', originalError);

      expect(error).toBeInstanceOf(AnalyzerError);
      expect(error.name).toBe('ExplainError');
      expect(error.code).toBe('EXPLAIN_FAILED');
      expect(error.message).toBe('Failed to analyze query with EXPLAIN');
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.originalError).toBe(originalError);
    });

    it('should work without original error', () => {
      const error = new ExplainError('SELECT 1');

      expect(error.name).toBe('ExplainError');
      expect(error.originalError).toBeUndefined();
    });
  });

  describe('CsvError', () => {
    it('should create CsvError with correct properties', () => {
      const originalError = new Error('Disk full');
      const error = new CsvError('SELECT * FROM users', originalError);

      expect(error).toBeInstanceOf(AnalyzerError);
      expect(error.name).toBe('CsvError');
      expect(error.code).toBe('CSV_WRITE_FAILED');
      expect(error.message).toBe('Failed to log query analysis to CSV');
      expect(error.query).toBe('SELECT * FROM users');
    });
  });

  describe('QueryExecutionError', () => {
    it('should create QueryExecutionError with correct properties', () => {
      const originalError = new Error('Connection lost');
      const error = new QueryExecutionError('SELECT * FROM users', originalError);

      expect(error).toBeInstanceOf(AnalyzerError);
      expect(error.name).toBe('QueryExecutionError');
      expect(error.code).toBe('QUERY_EXECUTION_FAILED');
      expect(error.message).toBe('Query execution failed');
      expect(error.query).toBe('SELECT * FROM users');
    });
  });

  describe('ParseError', () => {
    it('should create ParseError with correct properties', () => {
      const error = new ParseError('SELECT * FROM users', 'execution time');

      expect(error).toBeInstanceOf(AnalyzerError);
      expect(error.name).toBe('ParseError');
      expect(error.code).toBe('PARSE_FAILED');
      expect(error.message).toBe('Failed to parse execution time from query plan');
      expect(error.query).toBe('SELECT * FROM users');
    });
  });

  describe('Error Stack Traces', () => {
    it('should capture stack trace', () => {
      const error = new AnalyzerError('Test', 'CODE', 'SELECT 1');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AnalyzerError');
    });

    it('should have proper stack trace for extended errors', () => {
      const error = new ExplainError('SELECT 1');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ExplainError');
    });
  });

  describe('Error Message Formatting', () => {
    it('should include timestamp in formatted message', () => {
      const error = new AnalyzerError('Test', 'CODE', 'SELECT 1');
      const formatted = error.getFormattedMessage();

      expect(formatted).toMatch(/Time: \d{4}-\d{2}-\d{2}T/);
    });

    it('should include query in formatted message', () => {
      const error = new ExplainError('SELECT * FROM very_long_table_name WHERE complex_condition = true');
      const formatted = error.getFormattedMessage();

      expect(formatted).toContain('SELECT * FROM very_long_table_name');
    });
  });
});

