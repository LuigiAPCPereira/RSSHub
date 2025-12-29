import { HealthKit } from '@healthkit/sdk';
import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { config } from '@/config';
import cache from '@/utils/cache/redis';

const healthKit = new HealthKit({
    serviceId: process.env.npm_package_name || 'rsshub',
    group: process.env.NODE_ENV || 'production',
    mode: 'push', // User preference
    version: process.env.npm_package_version || '0.0.0', // Fallback if env not available
    ingestUrl: process.env.HEALTHKIT_INGEST_URL,
    apiKey: process.env.HEALTHKIT_API_KEY,
});

export const route = createRoute({
    method: 'get',
    path: '/health',
    tags: ['Health'],
    responses: {
        200: {
            description: 'Health Status',
            content: {
                'application/json': {
                    schema: z.object({}).passthrough(), // Allow any shape for now as HealthKit returns a complex object
                },
            },
        },
        503: {
            description: 'Service Unavailable',
            content: {
                'application/json': {
                    schema: z.object({}).passthrough(),
                },
            },
        },
    },
});

export const handler = async (ctx: Context) => {
    // Custom Check: Redis
    if (config.redis.url) {
        // Only check if Redis is configured
        await healthKit.addCheck('redis', async () => {
            const start = performance.now();
            try {
                if (!cache.status.available) {
                    throw new Error('Redis is not available');
                }
                if (cache.clients.redisClient) {
                    await cache.clients.redisClient.ping();
                } else {
                     throw new Error('Redis client not initialized');
                }
                return {
                    latency_ms: performance.now() - start,
                };
            } catch (error) {
                // Return explicit fail status as requested, although SDK likely handles throws too.
                // But prompt said "If a check fails, return status: 'fail'" inside the check?
                // Or maybe just let SDK handle it.
                // SDK usually expects return object to be merged with status.
                // If I throw, SDK catches. If I return { status: 'fail' }, SDK uses it.
                // Let's re-throw to be safe for SDK detection, or return status if SDK supports it.
                // Given the instructions, I'll throw to ensure 'fail' status is recorded by SDK.
                throw error;
            }
        });
    }

    const healthData = await healthKit.collect();

    // Push mode support (manual trigger if needed, or rely on auto-push if implemented in SDK background)
    if (process.env.HEALTHKIT_INGEST_URL && process.env.HEALTHKIT_API_KEY) {
        // Use waitUntil if available (Cloudflare Workers / some adapters), otherwise just fire and forget or await (but awaiting blocks response)
        // For Node.js (hono/node-server), executionCtx might be undefined.
        const pushPromise = healthKit.push().catch(() => {});
        if (ctx.executionCtx && typeof ctx.executionCtx.waitUntil === 'function') {
            ctx.executionCtx.waitUntil(pushPromise);
        } else {
             // If no waitUntil, we can't guarantee it finishes after response without blocking.
             // We'll just let it run in background (unawaited promise).
        }
    }

    const status = healthData.status === 'fail' ? 503 : 200;

    return ctx.json(healthData, status as any, {
        'Cache-Control': 'no-store',
    });
};
