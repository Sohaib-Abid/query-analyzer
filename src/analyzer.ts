import { format } from "date-fns";
import { Sequelize } from 'sequelize';
import { appendCsv } from './csvUtil';
import { AnalyzerOptions, Payload, QueryPlanRow } from './types';
import { ExplainError, CsvError, QueryExecutionError } from './errors';

/**
 * Enable query analyzer for a Sequelize instance
 * @param sequelize Sequelize instance to analyze
 * @param options Configuration options
 */
export async function enableAnalyzer(sequelize: Sequelize, options: AnalyzerOptions = {}): Promise<void> {
    // Check if analyzer should be enabled
    const isEnabled = shouldEnableAnalyzer(options);

    const originalQuery = (sequelize.query as any).bind(sequelize);

    (sequelize as any).query = async function (...args: any[]): Promise<any> {
        // Skip analysis if disabled
        if (!isEnabled) {
            return originalQuery.apply(null, args);
        }

        let query = '';
        if (typeof args[0] === 'object' && args[0].query) {
            query = args[0].query;
        } else if (typeof args[0] === 'string') {
            query = args[0];
        }
        try {
            if (query.startsWith('EXPLAIN') || query.startsWith('START') || query.startsWith('ROLLBACK') || query.startsWith('COMMIT')) {
                return originalQuery.apply(null, args);
            }

            const queryStartTime = Date.now();
            const results: any = await originalQuery.apply(null, args);
            const actualExecutionTime = Date.now() - queryStartTime;

            try {
                const payload: Payload = {
                    query,
                    actualExecutionTime,
                    queryPlan: '',
                    planningTime: '',
                    executionTime: '',
                    startCost: '',
                    endCost: '',
                    params: undefined,
                };

                let reportType = 'EXPLAIN (ANALYZE)';
                if (query.match(/\b(CALL)\b/)) {
                    reportType = 'NONE';
                } else if (query.match(/\b(UPDATE|DELETE|INSERT)\b/i)) {
                    reportType = 'EXPLAIN';
                    if (args[0]) {
                        payload.params = JSON.stringify(args[0].bind || {}, null, 2);
                    }
                } else {
                    if (args[1]) {
                        args[1].type = 'RAW';
                        payload.params = JSON.stringify(args[1].replacements || {}, null, 2);
                    }

                    const explainOptions = ['ANALYZE'];
                    if (options.verbose) explainOptions.push('VERBOSE');
                    if (options.costs) explainOptions.push('COSTS');
                    if (options.settings) explainOptions.push('SETTINGS');
                    if (options.buffers) explainOptions.push('BUFFERS');
                    if (options.serialize) explainOptions.push(`SERIALIZE ${options.serialize}`);
                    if (options.wal) explainOptions.push('WAL');
                    if (options.timing) explainOptions.push('TIMING');
                    if (options.summary) explainOptions.push('SUMMARY');

                    reportType = `EXPLAIN (${explainOptions.join(', ')})`;
                }

                if (reportType.startsWith('EXPLAIN')) {
                    if (typeof args[0] === 'object') {
                        args[0].query = reportType + ' ' + query;
                    } else if (typeof args[0] === 'string') {
                        args[0] = reportType + ' ' + query;
                    }


                    const queryResult = (await originalQuery.apply(null, args)) as QueryPlanRow[];
                    payload.queryPlan = queryResult.flat().map(item => item['QUERY PLAN']).join('\n');
                    const costMatch = payload.queryPlan.match(/cost=([\d.]+)\.\.([\d.]+)/);
                    payload.startCost = costMatch ? costMatch[1] : 'N/A';
                    payload.endCost = costMatch ? costMatch[2] : 'N/A';

                    const execTimeMatch = payload.queryPlan.match(/Execution Time: (\d+\.\d+) /);
                    payload.executionTime = execTimeMatch ? parseFloat(execTimeMatch[1]).toFixed(2) : 'N/A';

                    const planningTimeMatch = payload.queryPlan.match(/Planning Time: (\d+\.\d+) /);
                    payload.planningTime = planningTimeMatch ? parseFloat(planningTimeMatch[1]).toFixed(2) : 'N/A';
                }
                try {
                    await appendCsv(`analyzer/report-${format(new Date(), 'yyyy-MM-dd')}.csv`, payload);
                } catch (csvError) {
                    const error = new CsvError(query, csvError instanceof Error ? csvError : undefined);
                    console.error(error.getFormattedMessage());
                    if (options.onError) {
                        await Promise.resolve(options.onError(error));
                    }
                }

                if (options.onSlowQuery) {
                    const threshold = options.slowQueryThreshold ?? 1000;  // Default: 1000ms
                    if (actualExecutionTime >= threshold) {
                        await Promise.resolve(options.onSlowQuery(payload));
                    }
                }
            } catch (e: unknown) {
                const error = new ExplainError(query, e instanceof Error ? e : undefined);
                console.error(error.getFormattedMessage());
                if (options.onError) {
                    await Promise.resolve(options.onError(error));
                }
            }
            return results;
        } catch (error) {
            const queryError = new QueryExecutionError(
                query,
                error instanceof Error ? error : undefined
            );
            console.error(queryError.getFormattedMessage());
            throw error;  // Re-throw original error to maintain backward compatibility
        }
    };
}

/**
 * Determines if the analyzer should be enabled based on configuration options
 * @param options AnalyzerOptions configuration
 * @returns true if analyzer should run, false otherwise
 */
function shouldEnableAnalyzer(options: AnalyzerOptions): boolean {
    // Check explicit enabled flag first
    if (options.enabled === false) {
        return false;
    }
    
    // If enabled is explicitly true, enable regardless of environment
    if (options.enabled === true) {
        return true;
    }

    if (options.environment) {
        const currentEnv = process.env.NODE_ENV || 'development';
        if (currentEnv !== options.environment) {
            return false;
        }
    }

    return true;
}
