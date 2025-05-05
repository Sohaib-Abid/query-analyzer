import { format } from "date-fns";
import { appendCsv } from './csvUtil';
import { AnalyzerOptions, Payload, QueryPlanRow } from './types';

export async function enableAnalyzer(sequelize: any, options: AnalyzerOptions = {}) {
    const originalQuery = sequelize.query;
    sequelize.query = async function (...args: any[]) {
        let query = '';
        if (typeof args[0] === 'object' && args[0].query) {
            query = args[0].query;
        } else if (typeof args[0] === 'string') {
            query = args[0];
        }
        try {
            if (query.startsWith('EXPLAIN') || query.startsWith('START') || query.startsWith('ROLLBACK') || query.startsWith('COMMIT')) {
                return originalQuery.apply(sequelize, args);
            }

            const queryStartTime = Date.now();
            const results: any = await originalQuery.apply(sequelize, args);
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


                    const queryResult = (await originalQuery.apply(sequelize, args)) as QueryPlanRow[];
                    payload.queryPlan = queryResult.flat().map(item => item['QUERY PLAN']).join('\n');
                    const costMatches = ((payload.queryPlan.match(/cost=([\d.]+)/) || [])[1] || '').split('..');
                    payload.startCost = costMatches[0] || 'N/A';
                    payload.endCost = costMatches[1] || 'N/A';

                    const execTimeMatch = payload.queryPlan.match(/Execution Time: (\d+\.\d+) /);
                    payload.executionTime = execTimeMatch ? parseFloat(execTimeMatch[1]).toFixed(2) : 'N/A';

                    const planningTimeMatch = payload.queryPlan.match(/Planning Time: (\d+\.\d+) /);
                    payload.planningTime = planningTimeMatch ? parseFloat(planningTimeMatch[1]).toFixed(2) : 'N/A';
                }
                await appendCsv(`analyzer/report-${format(new Date(), 'yyyy-MM-dd')}.csv`, payload);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    console.error(`EXPLAIN error: ${e.message}\n\tQUERY: ${query}`);
                } else {
                    console.error(`EXPLAIN error: An unknown error occurred\n\tQUERY: ${query}`);
                }
            }
            return results;
        } catch (error) {
            console.error('Error executing or parsing query:', error);
            throw error;
        }
    };
}
