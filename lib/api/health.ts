import { HealthKit } from '@healthkit/sdk';
import type { RouteHandler } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';

import { config } from '@/config';

// Schema para resposta do health check (formato HealthKit)
const HealthResponseSchema = z.object({
    id: z.string(),
    group: z.string(),
    status: z.enum(['pass', 'warn', 'fail']),
    version: z.string().optional(),
    timestamp: z.string(),
    components: z.array(z.unknown()),
    metadata: z.record(z.unknown()).optional(),
});

const route = createRoute({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: HealthResponseSchema,
                },
            },
            description: 'Health check response in HealthKit format',
        },
        503: {
            content: {
                'application/json': {
                    schema: HealthResponseSchema,
                },
            },
            description: 'Service is unhealthy',
        },
    },
});

const handler: RouteHandler<typeof route> = async (ctx) => {
    // Usar SDK em modo Pull conforme documentação do HealthKit
    const healthkit = new HealthKit({
        serviceId: config.healthkit.serviceId || 'rsshub',
        group: config.healthkit.group || 'production',
        mode: 'pull', // Modo Pull para endpoints /health
    });

    // O SDK coleta automaticamente:
    // - Memória: heapUsed, heapTotal, rss, external
    // - Event Loop Lag: min, max, mean, p99
    // - CPU: user, system, loadAvg
    // - Metadados: platform (vercel/aws/docker), region, etc.

    const report = await healthkit.collect();
    const httpStatus = report.status === 'fail' ? 503 : 200;

    return ctx.json(report, httpStatus, {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-HealthKit-Version': '1.0',
    });
};

export { handler, route };
