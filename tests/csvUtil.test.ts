import { promises as fs } from 'fs';
import path from 'path';
import { Payload } from '../src/types';

// Test directory for CSV files  
const TEST_DIR = path.join('/tmp', 'query-analyzer-test-output');
const TEST_CSV = path.join(TEST_DIR, 'test.csv');

// Import the compiled version
const { appendCsv } = require('../dist/csvUtil');

describe('csvUtil - Characterization Tests', () => {
  beforeAll(async () => {
    // Ensure clean state
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  afterAll(async () => {
    // Clean up after all tests
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (e) {
      // ignore
    }
  });

  describe('Basic Functionality', () => {
    it('should create CSV file with headers and data', async () => {
      const testFile = path.join(TEST_DIR, 'basic-test.csv');
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

      await appendCsv(testFile, payload);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');

      // Should have header + data
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('query');
      expect(lines[1]).toContain('SELECT * FROM users');
    });

    it('should append multiple entries without duplicating headers', async () => {
      const testFile = path.join(TEST_DIR, 'append-test.csv');
      
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

      await appendCsv(testFile, payload1);
      await appendCsv(testFile, payload2);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');

      // Should have 1 header + 2 data rows
      expect(lines.length).toBe(3);
      
      // Header should appear only once
      const headerLines = lines.filter(l => l.startsWith('query,actualExecutionTime'));
      expect(headerLines.length).toBe(1);
    });

    it('should escape double quotes by doubling them', async () => {
      const testFile = path.join(TEST_DIR, 'quote-test.csv');
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

      await appendCsv(testFile, payload);

      const content = await fs.readFile(testFile, 'utf-8');
      
      // Quotes should be escaped by doubling
      expect(content).toContain('""name""');
      expect(content).toContain('""users""');
    });

    it('should handle undefined params', async () => {
      const testFile = path.join(TEST_DIR, 'undefined-test.csv');
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

      await appendCsv(testFile, payload);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toContain('"undefined"');
    });

    it('should wrap all values in double quotes', async () => {
      const testFile = path.join(TEST_DIR, 'wrapped-test.csv');
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

      await appendCsv(testFile, payload);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');
      const dataLine = lines[1];

      // All CSV values should be quoted
      const values = dataLine.split(/,(?=")/);//split on commas followed by quotes
      expect(values.length).toBeGreaterThan(0);
      values.forEach(value => {
        expect(value.trim().startsWith('"')).toBe(true);
      });
    });

    it('should maintain consistent field order', async () => {
      const testFile = path.join(TEST_DIR, 'order-test.csv');
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

      await appendCsv(testFile, payload);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.trim().split('\n');
      const header = lines[0];

      // Field order should match Payload interface
      expect(header).toBe('query,actualExecutionTime,queryPlan,planningTime,executionTime,startCost,endCost,params');
    });

    it('should create nested directories if they do not exist', async () => {
      const nestedFile = path.join(TEST_DIR, 'nested', 'deep', 'path', 'test.csv');
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

      await appendCsv(nestedFile, payload);

      // File should exist
      const exists = await fs.access(nestedFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
