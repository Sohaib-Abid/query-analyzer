/**
 * Custom error classes for Query Analyzer
 */

/**
 * Base error class for all analyzer errors
 */
export class AnalyzerError extends Error {
    public readonly code: string;
    public readonly query: string;
    public readonly originalError?: Error;
    public readonly timestamp: Date;

    constructor(
        message: string,
        code: string,
        query: string,
        originalError?: Error
    ) {
        super(message);
        this.name = 'AnalyzerError';
        this.code = code;
        this.query = query;
        this.originalError = originalError;
        this.timestamp = new Date();

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }

    /**
     * Get a formatted error message
     */
    getFormattedMessage(): string {
        return `[${this.code}] ${this.message}\n\tQuery: ${this.query}\n\tTime: ${this.timestamp.toISOString()}`;
    }

    /**
     * Convert error to JSON
     */
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            query: this.query,
            timestamp: this.timestamp.toISOString(),
            originalError: this.originalError?.message,
            stack: this.stack
        };
    }
}

/**
 * Error thrown when EXPLAIN analysis fails
 */
export class ExplainError extends AnalyzerError {
    constructor(query: string, originalError?: Error) {
        super(
            'Failed to analyze query with EXPLAIN',
            'EXPLAIN_FAILED',
            query,
            originalError
        );
        this.name = 'ExplainError';
    }
}

/**
 * Error thrown when CSV logging fails
 */
export class CsvError extends AnalyzerError {
    constructor(query: string, originalError?: Error) {
        super(
            'Failed to log query analysis to CSV',
            'CSV_WRITE_FAILED',
            query,
            originalError
        );
        this.name = 'CsvError';
    }
}

/**
 * Error thrown when query execution fails
 */
export class QueryExecutionError extends AnalyzerError {
    constructor(query: string, originalError?: Error) {
        super(
            'Query execution failed',
            'QUERY_EXECUTION_FAILED',
            query,
            originalError
        );
        this.name = 'QueryExecutionError';
    }
}

/**
 * Error thrown when query plan parsing fails
 */
export class ParseError extends AnalyzerError {
    constructor(query: string, field: string, originalError?: Error) {
        super(
            `Failed to parse ${field} from query plan`,
            'PARSE_FAILED',
            query,
            originalError
        );
        this.name = 'ParseError';
    }
}

