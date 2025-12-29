import { HealthKit } from '@healthkit/sdk';
import type { RouteHandler } from '@hono/zod-openapi';
import { createRoute, z } from '@hono/zod-openapi';

import { config } from '@/config';

// Schema para resposta do health check (formato HealthKit)
// Usando z.any() para componentes e metadata porque zod-to-openapi não suporta bem z.record(z.unknown())
const HealthResponseSchema = z.object({
    id: z.string(),
    group: z.string(),
    status: z.enum(['pass', 'warn', 'fail']),
    version: z.string().optional(),
    timestamp: z.string(),
    components: z.any(),
    metadata: z.any().optional(),
});

const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string(),
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
        401: {
            content: {
                'application/json': {
                    schema: ErrorResponseSchema,
                },
            },
            description: 'Unauthorized - Missing or invalid API key',
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
    // Verificar autenticação via HEALTHKIT_API_KEY
    // Aceita: Authorization: Bearer <key> OU x-api-key: <key>
    const authHeader = ctx.req.header('Authorization');
    const xApiKey = ctx.req.header('x-api-key');

    let providedKey: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
        providedKey = authHeader.slice(7); // Remove "Bearer "
    } else if (xApiKey) {
        providedKey = xApiKey;
    }

    // Se a API key está configurada, exigir autenticação
    if (config.healthkit.apiKey) {
        if (!providedKey) {
            return ctx.json(
                {
                    error: 'Unauthorized',
                    message: 'Chave de API necessária. Use header Authorization: Bearer <key> ou x-api-key: <key>',
                },
                401
            );
        }

        if (providedKey !== config.healthkit.apiKey) {
            return ctx.json(
                {
                    error: 'Unauthorized',
                    message: 'Chave de API inválida.',
                },
                401
            );
        }
    }

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
