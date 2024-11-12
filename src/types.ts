export interface AnalyzerOptions {
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