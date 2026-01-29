import crypto from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

import { config } from '@/config';
import RejectError from '@/errors/types/reject';
import md5 from '@/utils/md5';

const reject = (requestPath: string) => {
    throw new RejectError(`Authentication failed. Access denied.\n${requestPath}`);
};

/**
 * SENTINEL: Constant-time safe comparison.
 * Prevents timing attacks by ensuring comparison time does not vary with input.
 * @param a - expected value (secret)
 * @param b - user-supplied value
 */
const safeCompare = (a: string | undefined, b: string | undefined): boolean => {
    if (!a || !b) {
        return false;
    }
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
};

const middleware: MiddlewareHandler = async (ctx, next) => {
    const requestPath = new URL(ctx.req.url).pathname;
    const accessKey = ctx.req.query('key');
    const accessCode = ctx.req.query('code');

    if (requestPath === '/' || requestPath === '/robots.txt' || requestPath === '/favicon.ico' || requestPath === '/logo.png') {
        await next();
    } else {
        if (config.accessKey) {
            const isKeyValid = safeCompare(config.accessKey, accessKey);
            const isCodeValid = safeCompare(accessCode, md5(requestPath + config.accessKey));

            if (!isKeyValid && !isCodeValid) {
                return reject(requestPath);
            }
        }
        await next();
    }
};

export default middleware;
