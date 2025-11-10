import { AnalyzerError } from './errors';

export interface AnalyzerOptions {
  // Enable/Disable Controls
  enabled?: boolean;                     // Master switch (default: true for backward compatibility)
  environment?: string;                  // Only enable in specific environment (e.g., 'development', 'staging')
  
  // Error Handling Callbacks
  onError?: (error: AnalyzerError) => void | Promise<void>;    // Called when analysis fails
  onSlowQuery?: (payload: Payload) => void | Promise<void>;     // Called for slow queries
  slowQueryThreshold?: number;           // Threshold in ms to trigger onSlowQuery (default: 1000)
  
  // EXPLAIN Options
  verbose?: boolean;
  costs?: boolean;
  settings?: boolean;
  buffers?: boolean;
  serialize?: 'NONE' | 'TEXT' | 'BINARY';
  wal?: boolean;
  timing?: boolean;
  summary?: boolean;
}

export interface Payload {
  query: string;
  actualExecutionTime: number;
  queryPlan: string;
  planningTime: string;
  executionTime: string;
  startCost: string;
  endCost: string;
  params: string | undefined;
}

export interface QueryPlanRow {
  'QUERY PLAN': string;
}