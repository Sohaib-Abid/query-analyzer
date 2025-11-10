import { promises as fs } from 'fs';
import path from 'path';
import { Payload } from '../src/types';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    appendFile: jest.fn(),
  }
}));

// Import after mocking
import { appendCsv } from '../src/csvUtil';

describe('csvUtil - Characterization Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('File Creation', () => {
    it('should create a new CSV file with headers when file does not exist', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT * FROM users',
        actualExecutionTime: 100,
        queryPlan: 'Seq Scan on users',
        planningTime: '0.5',
        executionTime: '99.5',
        startCost: '0.00',
        endCost: '100.00',
        params: undefined
      };

      // Mock file doesn't exist
      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      // Should create directory
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(testFile),
        { recursive: true }
      );

      // Should write header
      expect(fs.writeFile).toHaveBeenCalledWith(
        testFile,
        'query,actualExecutionTime,queryPlan,planningTime,executionTime,startCost,endCost,params\n'
      );

      // Should append data
      expect(fs.appendFile).toHaveBeenCalledWith(
        testFile,
        expect.stringContaining('"SELECT * FROM users"')
      );
    });

    it('should create directory structure recursively if it does not exist', async () => {
      const nestedPath = '/tmp/nested/deep/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      // Mock file doesn't exist
      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(nestedPath, payload);

      // Should create nested directories with recursive option
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(nestedPath),
        { recursive: true }
      );
    });
  });

  describe('Data Appending', () => {
    it('should append data to existing CSV file without adding headers again', async () => {
      const testFile = '/tmp/test.csv';
      
      const payload1: Payload = {
        query: 'SELECT * FROM users',
        actualExecutionTime: 100,
        queryPlan: 'Seq Scan',
        planningTime: '0.5',
        executionTime: '99.5',
        startCost: '0.00',
        endCost: '100.00',
        params: undefined
      };

      const payload2: Payload = {
        query: 'SELECT * FROM orders',
        actualExecutionTime: 200,
        queryPlan: 'Index Scan',
        planningTime: '1.0',
        executionTime: '199.0',
        startCost: '0.00',
        endCost: '200.00',
        params: '{"id": 1}'
      };

      // First call: file doesn't exist
      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload1);

      // Second call: file exists
      (fs.access as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload2);

      // writeFile should only be called once (for headers)
      expect(fs.writeFile).toHaveBeenCalledTimes(1);

      // appendFile should be called twice (once for each payload)
      expect(fs.appendFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('CSV Escaping', () => {
    it('should escape double quotes in values by doubling them', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT "name" FROM "users"',
        actualExecutionTime: 50,
        queryPlan: 'Plan with "quoted" text',
        planningTime: '0.2',
        executionTime: '49.8',
        startCost: '0.00',
        endCost: '50.00',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const appendCall = (fs.appendFile as jest.Mock).mock.calls[0][1];
      
      // Quotes should be escaped by doubling
      expect(appendCall).toContain('""name""');
      expect(appendCall).toContain('""users""');
      expect(appendCall).toContain('""quoted""');
    });

    it('should wrap all values in double quotes', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const appendCall = (fs.appendFile as jest.Mock).mock.calls[0][1];
      
      // Each value should be wrapped in quotes
      const values = appendCall.trim().split(',');
      expect(values.length).toBe(8); // 8 fields in Payload
      values.forEach((value: string) => {
        expect(value.startsWith('"')).toBe(true);
        expect(value.endsWith('"')).toBe(true);
      });
    });

    it('should handle undefined params by converting to string "undefined"', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const appendCall = (fs.appendFile as jest.Mock).mock.calls[0][1];
      
      // Should contain the string "undefined" for params
      expect(appendCall).toContain('"undefined"');
    });
  });

  describe('Special Characters', () => {
    it('should handle newlines in query text', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT *\nFROM users\nWHERE id = 1',
        actualExecutionTime: 100,
        queryPlan: 'Seq Scan',
        planningTime: '0.5',
        executionTime: '99.5',
        startCost: '0.00',
        endCost: '100.00',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const appendCall = (fs.appendFile as jest.Mock).mock.calls[0][1];
      
      // Newlines should be preserved within quoted values
      expect(appendCall).toContain('SELECT *\nFROM users\nWHERE id = 1');
    });

    it('should handle commas in values', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT name, age, city FROM users',
        actualExecutionTime: 100,
        queryPlan: 'Seq Scan on users (cost=0.00..100.00, rows=1000, width=32)',
        planningTime: '0.5',
        executionTime: '99.5',
        startCost: '0.00',
        endCost: '100.00',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const appendCall = (fs.appendFile as jest.Mock).mock.calls[0][1];
      
      // Commas should be handled correctly within quoted values
      expect(appendCall).toContain('SELECT name, age, city FROM users');
      expect(appendCall).toContain('cost=0.00..100.00, rows=1000, width=32');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when directory creation fails', async () => {
      const testFile = '/root/impossible/path/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      // Mock file doesn't exist
      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      // Mock mkdir fails with permission error
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('EACCES'), { code: 'EACCES' })
      );

      // Should throw the error
      await expect(appendCsv(testFile, payload)).rejects.toThrow();
    });

    it('should throw error when non-ENOENT error occurs during access', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      // Mock access fails with non-ENOENT error
      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('EACCES'), { code: 'EACCES' })
      );

      // Should throw the error
      await expect(appendCsv(testFile, payload)).rejects.toThrow();
    });
  });

  describe('Field Order Consistency', () => {
    it('should maintain consistent field order based on Payload interface', async () => {
      const testFile = '/tmp/test.csv';
      const payload: Payload = {
        query: 'SELECT 1',
        actualExecutionTime: 10,
        queryPlan: 'Result',
        planningTime: '0.1',
        executionTime: '9.9',
        startCost: '0.00',
        endCost: '0.01',
        params: undefined
      };

      (fs.access as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      );
      (fs.mkdir as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);
      (fs.appendFile as jest.Mock).mockResolvedValueOnce(undefined);

      await appendCsv(testFile, payload);

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0][1];
      
      // Verify the exact order of fields
      expect(writeCall).toBe('query,actualExecutionTime,queryPlan,planningTime,executionTime,startCost,endCost,params\n');
    });
  });
});
