# Query Analyzer

A Node.js utility for analyzing Sequelize queries with PostgreSQL EXPLAIN. Provides detailed insights into query performance and logs results to CSV files.

[![npm version](https://img.shields.io/npm/v/query-analyzer.svg)](https://www.npmjs.com/package/query-analyzer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Features

- ✅ Automatic query interception and analysis
- ✅ Full PostgreSQL EXPLAIN ANALYZE support
- ✅ Production safety controls (enable/disable by environment)
- ✅ Slow query detection with callbacks
- ✅ Structured error handling
- ✅ Daily CSV reports with performance metrics
- ✅ TypeScript support with full type definitions

---

## Installation

```bash
npm install query-analyzer --save-dev
```

---

## Quick Start

```typescript
import { enableAnalyzer } from 'query-analyzer';

// Enable only in development
await enableAnalyzer(sequelize, {
  environment: 'development'
});
```

That's it! All queries are now analyzed and logged to `analyzer/report-YYYY-MM-DD.csv`

---

## Compatibility

| Component | Version | Notes |
|-----------|---------|-------|
| **PostgreSQL** | 13-17 | Recommended (all features) |
| | 10-12 | Supported (some features unavailable) |
| **Sequelize** | 6.x | Tested and supported |
| | 7.x | Likely works (untested) |
| **Node.js** | 16-22 | LTS versions |

<details>
<summary>PostgreSQL Feature Support by Version</summary>

| PostgreSQL | Available Options | Missing |
|------------|-------------------|---------|
| 17, 16 | All (ANALYZE, BUFFERS, WAL, TIMING, SUMMARY, SETTINGS, SERIALIZE) | - |
| 15, 14, 13 | All except SERIALIZE | SERIALIZE |
| 12 | All except WAL, SERIALIZE | WAL, SERIALIZE |
| 10, 11 | All except SETTINGS, WAL, SERIALIZE | SETTINGS, WAL, SERIALIZE |

</details>

---

## Usage

### Development Only (Recommended)

```typescript
import { enableAnalyzer } from 'query-analyzer';

await enableAnalyzer(sequelize, {
  environment: 'development'
});
```

### With EXPLAIN Options

```typescript
await enableAnalyzer(sequelize, {
  environment: 'development',
  verbose: true,
  buffers: true,
  timing: true,
  summary: true
});
```

### Disable in Production

```typescript
await enableAnalyzer(sequelize, {
  enabled: process.env.NODE_ENV !== 'production'
});
```

### Slow Query Monitoring

```typescript
import { enableAnalyzer, AnalyzerError } from 'query-analyzer';

await enableAnalyzer(sequelize, {
  environment: 'development',
  slowQueryThreshold: 500,  // ms
  onSlowQuery: (payload) => {
    console.warn(`⚠️  Slow query: ${payload.actualExecutionTime}ms`);
    console.warn(`Query: ${payload.query}`);
  },
  onError: (error: AnalyzerError) => {
    console.error(`Error: ${error.code} - ${error.message}`);
  }
});
```

---

## Configuration Options

```typescript
interface AnalyzerOptions {
  // Enable/Disable
  enabled?: boolean;                // Default: true
  environment?: string;             // Only enable in specific env
  
  // Monitoring
  onError?: (error: AnalyzerError) => void | Promise<void>;
  onSlowQuery?: (payload: Payload) => void | Promise<void>;
  slowQueryThreshold?: number;      // In ms, default: 1000, set to 0 for all queries
  
  // PostgreSQL EXPLAIN Options
  verbose?: boolean;
  costs?: boolean;
  settings?: boolean;
  buffers?: boolean;
  serialize?: 'NONE' | 'TEXT' | 'BINARY';
  wal?: boolean;
  timing?: boolean;
  summary?: boolean;
}
```

---

## Output

Results are saved to CSV files in the `analyzer/` directory:

```
analyzer/
└── report-2025-11-10.csv
```

### CSV Columns

| Column | Description |
|--------|-------------|
| `query` | SQL query executed |
| `actualExecutionTime` | Wall-clock time (ms) |
| `queryPlan` | Full EXPLAIN output |
| `planningTime` | PostgreSQL planning time (ms) |
| `executionTime` | PostgreSQL execution time (ms) |
| `startCost` | Estimated startup cost |
| `endCost` | Estimated total cost |
| `params` | Query parameters |

---

## Error Handling

The package exports structured error classes:

```typescript
import { 
  AnalyzerError,      // Base error class
  ExplainError,       // EXPLAIN failed
  CsvError,           // CSV write failed
  QueryExecutionError // Query execution failed
} from 'query-analyzer';
```

### Error Properties
- `code`: Error code (e.g., 'EXPLAIN_FAILED')
- `query`: SQL query that caused the error
- `originalError`: Underlying error (if any)
- `timestamp`: When error occurred
- `getFormattedMessage()`: Human-readable message
- `toJSON()`: For logging services

---

## ⚠️ Production Safety

**Important:** The analyzer runs `EXPLAIN ANALYZE` which **executes queries twice**. Always use environment controls:

```typescript
// ✅ SAFE - Only in development
await enableAnalyzer(sequelize, {
  environment: 'development'
});

// ✅ SAFE - Explicit control
await enableAnalyzer(sequelize, {
  enabled: process.env.NODE_ENV !== 'production'
});

// ❌ UNSAFE - Always enabled (doubles query time!)
await enableAnalyzer(sequelize);
```

---

## Examples

### Basic Usage

```typescript
import { Sequelize } from 'sequelize';
import { enableAnalyzer } from 'query-analyzer';

const sequelize = new Sequelize(/* config */);

await enableAnalyzer(sequelize, {
  environment: 'development'
});

// All queries are now analyzed automatically
const users = await User.findAll({ where: { active: true } });
```

### With Monitoring Integration

```typescript
import { enableAnalyzer, AnalyzerError } from 'query-analyzer';

await enableAnalyzer(sequelize, {
  environment: 'development',
  slowQueryThreshold: 1000,
  
  onSlowQuery: async (payload) => {
    // Send to monitoring service
    await sendMetric('slow_query', {
      duration: payload.actualExecutionTime,
      query: payload.query,
      cost: payload.endCost
    });
  },
  
  onError: async (error: AnalyzerError) => {
    // Send to error tracking
    await Sentry.captureException(error.toJSON());
  }
});
```

### Environment-Based Configuration

```typescript
const analyzerConfig = {
  enabled: process.env.ENABLE_QUERY_ANALYZER === 'true',
  environment: process.env.NODE_ENV,
  verbose: true,
  buffers: true,
  timing: true,
  slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000')
};

await enableAnalyzer(sequelize, analyzerConfig);
```

---

## API Reference

### `enableAnalyzer(sequelize, options)`

Enables query analysis for a Sequelize instance.

**Parameters:**
- `sequelize` (Sequelize): Sequelize instance
- `options` (AnalyzerOptions): Configuration options

**Returns:** `Promise<void>`

**Example:**
```typescript
await enableAnalyzer(sequelize, {
  environment: 'development',
  verbose: true
});
```

---

## Development

### Running Tests
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Building
```bash
npm run build
```

### Project Stats
- **Tests:** 68 passing (100%)
- **Type Safety:** Full TypeScript support
- **Security:** 0 vulnerabilities

---

## Roadmap

### Current Support
- ✅ Sequelize ORM
- ✅ PostgreSQL database
- ✅ Node.js 16-22 LTS

### Future (Based on Demand)
- ⏸️ TypeORM support
- ⏸️ Prisma support
- ⏸️ MySQL/MariaDB support

**Want support for another ORM or database?**  
[Open an issue](https://github.com/Sohaib-Abid/query-analyzer/issues) and let us know!

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

**Quick contribution checklist:**
1. Fork the repo
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Submit a Pull Request

---

## License

MIT © Sohaib Abid

---

## Links

- **GitHub:** [Sohaib-Abid/query-analyzer](https://github.com/Sohaib-Abid/query-analyzer)
- **npm:** [query-analyzer](https://www.npmjs.com/package/query-analyzer)
- **Issues:** [Report a bug](https://github.com/Sohaib-Abid/query-analyzer/issues)

---

## Acknowledgments

Built with ❤️ for the Node.js and PostgreSQL community.
