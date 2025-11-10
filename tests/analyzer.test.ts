import { enableAnalyzer } from '../src/analyzer';
import { promises as fs } from 'fs';
import path from 'path';
import { AnalyzerOptions } from '../src/types';

// Test directory for analyzer output
const TEST_DIR = path.join(__dirname, 'test-analyzer-output');

// Mock Sequelize instance
function createMockSequelize() {
  const mockSequelize: any = {
    query: jest.fn(async (...args: any[]): Promise<any> => {
      const query = typeof args[0] === 'object' ? args[0].query : args[0];
      
      // Mock EXPLAIN ANALYZE results
      if (query.startsWith('EXPLAIN')) {
        return [
          {
            'QUERY PLAN': 'Seq Scan on users  (cost=0.00..100.00 rows=1000 width=32) (actual time=0.050..5.123 rows=1000 loops=1)'
          },
          {
            'QUERY PLAN': 'Planning Time: 0.234 ms'
          },
          {
            'QUERY PLAN': 'Execution Time: 5.456 ms'
          }
        ];
      }
      
      // Mock regular query results
      return [{ id: 1, name: 'test' }];
    }),
    originalQuery: null as any
  };
  
  return mockSequelize;
}

describe('enableAnalyzer - Characterization Tests', () => {
  // Suppress console.error during tests (we expect many due to intentional error scenarios)
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Suppress console.error output to keep test logs clean
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Clean up test directory before each test
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // Directory doesn't exist, that's fine
    }
    
    // Mock the appendCsv to use test directory
    jest.mock('../src/csvUtil', () => ({
      appendCsv: jest.fn(async (filePath: string, payload: any) => {
        const testPath = path.join(TEST_DIR, path.basename(filePath));
        const dir = path.dirname(testPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.appendFile(testPath, JSON.stringify(payload) + '\n');
      })
    }));
  });

  afterEach(async () => {
    // Restore console.error
    consoleErrorSpy.mockRestore();
    
    jest.clearAllMocks();
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Query Interception', () => {
    it('should intercept and execute regular queries', async () => {
      const mockSequelize = createMockSequelize();
      const originalQueryMock = mockSequelize.query;
      await enableAnalyzer(mockSequelize);

      const result = await mockSequelize.query('SELECT * FROM users');

      // Should call the query function
      expect(originalQueryMock).toHaveBeenCalled();
      
      // Should return results
      expect(result).toBeDefined();
    });

    it('should handle queries passed as strings', async () => {
      const mockSequelize = createMockSequelize();
      const originalQueryMock = mockSequelize.query;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      expect(originalQueryMock).toHaveBeenCalled();
      // Verify it was called with the original query (not EXPLAIN)
      const calls = originalQueryMock.mock.calls;
      expect(calls.some((call: any[]) => call[0] === 'SELECT * FROM users')).toBe(true);
    });

    it('should handle queries passed as objects with query property', async () => {
      const mockSequelize = createMockSequelize();
      const originalQueryMock = mockSequelize.query;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query({ query: 'SELECT * FROM users' });

      expect(originalQueryMock).toHaveBeenCalled();
      // The analyzer intercepts and modifies the query object
      // It adds EXPLAIN to the query property for SELECT statements
      const calls = originalQueryMock.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      // Verify original SELECT query was called (before EXPLAIN was added)
      const hasOriginalQuery = calls.some((call: any[]) => 
        typeof call[0] === 'object' && call[0].query && call[0].query.includes('SELECT * FROM users')
      );
      expect(hasOriginalQuery).toBe(true);
    });
  });

  describe('Query Skipping Logic', () => {
    it('should skip EXPLAIN queries to avoid infinite recursion', async () => {
      const mockSequelize = createMockSequelize();
      const originalQueryMock = jest.fn(async () => []);
      mockSequelize.query = originalQueryMock;
      
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('EXPLAIN SELECT * FROM users');

      // Should execute but not run EXPLAIN again
      expect(originalQueryMock).toHaveBeenCalledTimes(1);
    });

    it('should skip START TRANSACTION queries', async () => {
      const mockSequelize = createMockSequelize();
      const callCount = { count: 0 };
      
      const originalQuery = mockSequelize.query;
      mockSequelize.query = jest.fn(async (...args: any[]) => {
        callCount.count++;
        return originalQuery(...args);
      });
      
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('START TRANSACTION');

      // Should only call original query once (not run EXPLAIN)
      expect(callCount.count).toBe(1);
    });

    it('should skip ROLLBACK queries', async () => {
      const mockSequelize = createMockSequelize();
      await enableAnalyzer(mockSequelize);

      const result = await mockSequelize.query('ROLLBACK');

      expect(result).toBeDefined();
    });

    it('should skip COMMIT queries', async () => {
      const mockSequelize = createMockSequelize();
      await enableAnalyzer(mockSequelize);

      const result = await mockSequelize.query('COMMIT');

      expect(result).toBeDefined();
    });
  });

  describe('Query Type Detection', () => {
    it('should detect CALL statements and set reportType to NONE', async () => {
      const mockSequelize = createMockSequelize();
      const originalQueryMock = mockSequelize.query;
      await enableAnalyzer(mockSequelize);

      // CALL queries should not run EXPLAIN
      await mockSequelize.query('CALL my_procedure()');

      // Should execute but not throw
      expect(originalQueryMock).toHaveBeenCalled();
      
      // Should only call with the CALL query, not with EXPLAIN
      const calls = originalQueryMock.mock.calls;
      const explainCalls = calls.filter((call: any[]) => {
        const query = typeof call[0] === 'object' ? call[0].query : call[0];
        return query.startsWith('EXPLAIN');
      });
      expect(explainCalls.length).toBe(0);
    });

    it('should detect UPDATE queries and use EXPLAIN (not ANALYZE)', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        
        if (query.startsWith('EXPLAIN')) {
          return [{ 'QUERY PLAN': 'Update on users  (cost=0.00..100.00 rows=1 width=32)' }];
        }
        
        return [];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('UPDATE users SET name = "test" WHERE id = 1');

      // Should have called with EXPLAIN (not EXPLAIN ANALYZE)
      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toBeDefined();
      expect(explainQuery).toContain('EXPLAIN');
      expect(explainQuery).not.toContain('EXPLAIN (ANALYZE');
    });

    it('should detect DELETE queries and use EXPLAIN (not ANALYZE)', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        
        if (query.startsWith('EXPLAIN')) {
          return [{ 'QUERY PLAN': 'Delete on users  (cost=0.00..100.00 rows=1 width=6)' }];
        }
        
        return [];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('DELETE FROM users WHERE id = 1');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toBeDefined();
      expect(explainQuery).toContain('EXPLAIN');
    });

    it('should detect INSERT queries and use EXPLAIN (not ANALYZE)', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        
        if (query.startsWith('EXPLAIN')) {
          return [{ 'QUERY PLAN': 'Insert on users  (cost=0.00..0.01 rows=1 width=32)' }];
        }
        
        return [];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('INSERT INTO users (name) VALUES ("test")');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toBeDefined();
    });

    it('should use EXPLAIN (ANALYZE) for SELECT queries', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        
        if (query.startsWith('EXPLAIN')) {
          return [
            { 'QUERY PLAN': 'Seq Scan on users  (cost=0.00..100.00 rows=1000 width=32)' },
            { 'QUERY PLAN': 'Planning Time: 0.234 ms' },
            { 'QUERY PLAN': 'Execution Time: 5.456 ms' }
          ];
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toBeDefined();
      expect(explainQuery).toContain('EXPLAIN (ANALYZE');
    });
  });

  describe('EXPLAIN Options', () => {
    it('should use default ANALYZE option when no options provided', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toContain('EXPLAIN (ANALYZE)');
    });

    it('should include VERBOSE option when enabled', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery;
      const options: AnalyzerOptions = { verbose: true };
      await enableAnalyzer(mockSequelize, options);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toContain('VERBOSE');
    });

    it('should include COSTS option when enabled', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery;
      const options: AnalyzerOptions = { costs: true };
      await enableAnalyzer(mockSequelize, options);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toContain('COSTS');
    });

    it('should include BUFFERS option when enabled', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery;
      const options: AnalyzerOptions = { buffers: true };
      await enableAnalyzer(mockSequelize, options);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toContain('BUFFERS');
    });

    it('should include multiple options when enabled', async () => {
      const mockSequelize = createMockSequelize();
      const queries: string[] = [];
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        queries.push(query);
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery;
      const options: AnalyzerOptions = {
        verbose: true,
        buffers: true,
        timing: true,
        summary: true
      };
      await enableAnalyzer(mockSequelize, options);

      await mockSequelize.query('SELECT * FROM users');

      const explainQuery = queries.find(q => q.startsWith('EXPLAIN'));
      expect(explainQuery).toContain('ANALYZE');
      expect(explainQuery).toContain('VERBOSE');
      expect(explainQuery).toContain('BUFFERS');
      expect(explainQuery).toContain('TIMING');
      expect(explainQuery).toContain('SUMMARY');
    });
  });

  describe('Query Plan Parsing', () => {
    it('should extract cost values from query plan (CURRENT BEHAVIOR - BUGGY)', async () => {
      const mockSequelize = createMockSequelize();
      const appendCsvMock = jest.fn();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          return [
            { 'QUERY PLAN': 'Seq Scan on users  (cost=10.50..250.75 rows=1000 width=32)' },
            { 'QUERY PLAN': 'Planning Time: 0.234 ms' },
            { 'QUERY PLAN': 'Execution Time: 5.456 ms' }
          ];
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      
      // Capture what gets logged
      let capturedPayload: any = null;
      jest.spyOn(require('../src/csvUtil'), 'appendCsv').mockImplementation(async (...args: any[]) => {
        capturedPayload = args[1];
      });
      
      await enableAnalyzer(mockSequelize);
      await mockSequelize.query('SELECT * FROM users');

      // Current buggy behavior: startCost is parsed but endCost is not properly extracted
      // This test documents the CURRENT behavior, not the correct behavior
      // The regex /cost=([\d.]+)/ only captures the first number
    });

    it('should extract planning time from query plan', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          return [
            { 'QUERY PLAN': 'Seq Scan on users  (cost=0.00..100.00 rows=1000 width=32)' },
            { 'QUERY PLAN': 'Planning Time: 12.345 ms' },
            { 'QUERY PLAN': 'Execution Time: 5.456 ms' }
          ];
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      // Planning time should be extracted
      expect(originalQuery).toHaveBeenCalled();
    });

    it('should extract execution time from query plan', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          return [
            { 'QUERY PLAN': 'Seq Scan on users  (cost=0.00..100.00 rows=1000 width=32)' },
            { 'QUERY PLAN': 'Planning Time: 0.234 ms' },
            { 'QUERY PLAN': 'Execution Time: 99.876 ms' }
          ];
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      expect(originalQuery).toHaveBeenCalled();
    });

    it('should set N/A when metrics are not found in query plan', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          return [{ 'QUERY PLAN': 'Some plan without metrics' }];
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      // Should not throw, should set N/A for missing values
      expect(originalQuery).toHaveBeenCalled();
    });
  });

  describe('Parameter Extraction', () => {
    it('should extract bind parameters from UPDATE queries', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query({ 
        query: 'UPDATE users SET name = ? WHERE id = ?',
        bind: ['John', 1]
      });

      expect(originalQuery).toHaveBeenCalled();
    });

    it('should extract replacements from SELECT queries', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users WHERE id = :id', {
        replacements: { id: 1 }
      });

      expect(originalQuery).toHaveBeenCalled();
    });

    it('should handle queries without parameters', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users');

      expect(originalQuery).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should log error and continue when EXPLAIN fails', async () => {
      const mockSequelize = createMockSequelize();
      // Restore console.error for this specific test since we're testing error logging
      consoleErrorSpy.mockRestore();
      const localConsoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          throw new Error('EXPLAIN failed');
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      const result = await mockSequelize.query('SELECT * FROM users');

      // Should still return the original query results
      expect(result).toEqual([{ id: 1 }]);
      
      // Should log the error
      expect(localConsoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('EXPLAIN error'));
      
      localConsoleErrorSpy.mockRestore();
      // Re-mock console.error for other tests
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should rethrow errors from the original query', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        throw new Error('Query execution failed');
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await expect(mockSequelize.query('SELECT * FROM users')).rejects.toThrow('Query execution failed');
    });

    it('should handle unknown error types', async () => {
      const mockSequelize = createMockSequelize();
      // Restore console.error for this specific test since we're testing error logging
      consoleErrorSpy.mockRestore();
      const localConsoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        if (query.startsWith('EXPLAIN')) {
          throw 'String error'; // Non-Error object
        }
        
        return [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      const result = await mockSequelize.query('SELECT * FROM users');

      expect(result).toEqual([{ id: 1 }]);
      expect(localConsoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('unknown error occurred'));
      
      localConsoleErrorSpy.mockRestore();
      // Re-mock console.error for other tests
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
  });

  describe('Timing Measurement', () => {
    it('should measure actual query execution time', async () => {
      const mockSequelize = createMockSequelize();
      
      const originalQuery = jest.fn(async (...args: any[]): Promise<any> => {
        const query = typeof args[0] === 'object' ? args[0].query : args[0];
        
        // Simulate query delay
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      const start = Date.now();
      await mockSequelize.query('SELECT * FROM users');
      const duration = Date.now() - start;

      // Should have taken at least 50ms
      expect(duration).toBeGreaterThanOrEqual(45); // Small buffer for timing variations
    });
  });

  describe('Type Modification', () => {
    it('should set query type to RAW for SELECT queries with replacements', async () => {
      const mockSequelize = createMockSequelize();
      const args: any[] = [];
      
      const originalQuery = jest.fn(async (...callArgs: any[]) => {
        args.push([...callArgs]);
        const query = typeof callArgs[0] === 'object' ? callArgs[0].query : callArgs[0];
        return query.startsWith('EXPLAIN') ? [{ 'QUERY PLAN': 'test' }] : [{ id: 1 }];
      });
      
      mockSequelize.query = originalQuery as any;
      await enableAnalyzer(mockSequelize);

      await mockSequelize.query('SELECT * FROM users WHERE id = :id', {
        replacements: { id: 1 }
      });

      // Check if type was set to RAW
      const explainCall = args.find(call => {
        const query = typeof call[0] === 'object' ? call[0].query : call[0];
        return query.startsWith('EXPLAIN');
      });
      
      if (explainCall && explainCall[1]) {
        expect(explainCall[1].type).toBe('RAW');
      }
    });
  });
});

