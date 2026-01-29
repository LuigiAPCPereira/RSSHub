import crypto from 'node:crypto';

import type { MiddlewareHandler } from 'hono';

import { config } from '@/config';
import RejectError from '@/errors/types/reject';
import md5 from '@/utils/md5';

const reject = (requestPath: string) => {
    throw new RejectError(`Authentication failed. Access denied.\n${requestPath}`);
};

/**
 * Comparação segura de tempo constante.
 * Evita ataques de temporização (Timing Attacks) onde o atacante
 * deduz a chave baseando-se no tempo de resposta.
 * @param a - Valor esperado (segredo)
 * @param b - Valor fornecido pelo usuário
 */
const safeCompare = (a: string | undefined, b: string | undefined): boolean => {
    if (!a || !b) {
        return false;
    }
    const hashA = crypto.createHash('sha256').update(a).digest();
    const hashB = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
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
