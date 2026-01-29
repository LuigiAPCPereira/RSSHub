import type { MiddlewareHandler } from 'hono';
import xxhash from 'xxhash-wasm';

import { config } from '@/config';
import RequestInProgressError from '@/errors/types/request-in-progress';
import type { Data } from '@/types';
import cacheModule from '@/utils/cache/index';

const bypassList = new Set(['/', '/robots.txt', '/logo.png', '/favicon.ico']);

/**
 * Espera por uma requisição em andamento para evitar "cache stampede".
 * Extraído para manter a função principal pequena e focada.
 */
const waitForRequest = async (controlKey: string) => {
    let retryTimes = process.env.NODE_ENV === 'test' ? 1 : 10;
    while (retryTimes > 0) {
        await new Promise((resolve) => setTimeout(resolve, process.env.NODE_ENV === 'test' ? 3000 : 6000)); // eslint-disable-line no-await-in-loop
        const isRequesting = await cacheModule.globalCache.get(controlKey); // eslint-disable-line no-await-in-loop
        if (isRequesting !== '1') {
            return;
        }
        retryTimes--;
    }
    throw new RequestInProgressError('This path is currently fetching, please come back later!');
};

const middleware: MiddlewareHandler = async (ctx, next) => {
    if (!cacheModule.status.available || bypassList.has(ctx.req.path)) {
        await next();
        return;
    }

    // Otimização do cálculo de hash (executado apenas uma vez)
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
