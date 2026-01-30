import type { MiddlewareHandler } from 'hono';
import xxhash from 'xxhash-wasm';

import { config } from '@/config';
import RequestInProgressError from '@/errors/types/request-in-progress';
import type { Data } from '@/types';
import cacheModule from '@/utils/cache/index';

const bypassList = new Set(['/', '/robots.txt', '/logo.png', '/favicon.ico']);

/**
 * BOLT: Waits for an in-flight request to avoid cache stampede.
 * MONOZUKURI: Extracted to keep the main function small and focused.
 */
const waitForRequest = async (controlKey: string) => {
    const waitTime = process.env.NODE_ENV === 'test' ? 1000 : 500;
    // config.cache.requestTimeout is in seconds, convert to ms
    const maxRetries = Math.ceil((config.cache.requestTimeout * 1000) / waitTime);
    let retryTimes = maxRetries;

    while (retryTimes > 0) {
        const isRequesting = await cacheModule.globalCache.get(controlKey); // eslint-disable-line no-await-in-loop
        if (isRequesting !== '1') {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime)); // eslint-disable-line no-await-in-loop
        retryTimes--;
    }
    throw new RequestInProgressError('This path is currently fetching, please come back later!');
};

const middleware: MiddlewareHandler = async (ctx, next) => {
    if (!cacheModule.status.available || bypassList.has(ctx.req.path)) {
        await next();
        return;
    }

    // Optimize hash calculation (execute once)
    const { h64ToString } = await xxhash();
    const requestKey = ctx.req.path + `:${ctx.req.query('format') || 'rss'}` + (ctx.req.query('limit') ? `:${ctx.req.query('limit')}` : '');
    const hash = h64ToString(requestKey);
    const key = 'rsshub:koa-redis-cache:' + hash;
    const controlKey = 'rsshub:path-requested:' + hash;

    if ((await cacheModule.globalCache.get(controlKey)) === '1') {
        await waitForRequest(controlKey);
    }

    const value = await cacheModule.globalCache.get(key);
    if (value) {
        ctx.status(200);
        ctx.header('RSSHub-Cache-Status', 'HIT');
        ctx.set('data', JSON.parse(value));
        await next();
        return;
    }

    await cacheModule.globalCache.set(controlKey, '1', config.cache.requestTimeout);
    ctx.set('cacheKey', key);
    ctx.set('cacheControlKey', controlKey);

    try {
        await next();
    } catch (error) {
        await cacheModule.globalCache.set(controlKey, '0', config.cache.requestTimeout);
        throw error;
    }

    const data: Data = ctx.get('data');
    if (ctx.res.headers.get('Cache-Control') !== 'no-cache' && data) {
        data.lastBuildDate = new Date().toUTCString();
        ctx.set('data', data);
        await cacheModule.globalCache.set(key, JSON.stringify(data), config.cache.routeExpire);
    }

    await cacheModule.globalCache.set(controlKey, '0', config.cache.requestTimeout);
};

export default middleware;
