# Query Analyzer

## Overview
`query-analyzer` is a Node.js utility designed to enhance Sequelize queries by enabling detailed SQL analysis using `EXPLAIN` options. It provides in-depth insights into query performance and logs the query plan into a CSV report.

## Installation

```bash
npm install query-analyzer --save-dev

## Compatibility

| Query-Analyzer |   Postgres   | Sequelize |
| -------------- |  ----------  | --------- |
|     0.0.1      |     14-16    |    6.x    |


##Options
  verbose: boolean;
  costs: boolean;
  settings: boolean;
  buffers: boolean;
  serialize: 'NONE' | 'TEXT' | 'BINARY';
  wal: boolean;
  timing: boolean;
  summary: boolean;

## Usage

```ts
import {enableAnalyzer} from 'query-analyzer'

(async () => {
  try {
    await enableAnalyzer(sequelize,options: analyzerOptions);  //call this in server.ts

    const server = app.listen(app.get('port'), () => {
      console.log(`App  is running at port ${app.get('port')}.`]);
    });
    return server;
  }
  catch (err) {
    process.exit(1);
  }
})();
```