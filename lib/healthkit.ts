import { HealthKit } from '@healthkit/sdk';

import { config } from '@/config';
import logger from '@/utils/logger';

let healthkit: HealthKit | null = null;
let healthkitStatus: {
    state: 'disabled' | 'initializing' | 'connected' | 'failed';
    message?: string;
    lastCheck?: string;
} = { state: 'disabled' };

export function getHealthKitConfig() {
    return {
        ingestUrl: config.healthkit.ingestUrl,
        serviceId: config.healthkit.serviceId,
        status: healthkitStatus,
        configPresent: {
            hasIngestUrl: !!config.healthkit.ingestUrl,
            hasApiKey: !!config.healthkit.apiKey,
        },
    };
}

export function initHealthKit() {
    logger.info('[HealthKit] Tentando inicializar HealthKit...');
    logger.info(`[HealthKit] Config detectada: URL=${!!config.healthkit.ingestUrl}, APIKey=${!!config.healthkit.apiKey}`);

    if (healthkit) {
        logger.info('[HealthKit] Instância já existe. Pulando.');
        return;
    }

    if (!config.healthkit.ingestUrl || !config.healthkit.apiKey) {
        const missing = [];
        if (!config.healthkit.ingestUrl) {
            missing.push('ingestUrl');
        }
        if (!config.healthkit.apiKey) {
            missing.push('apiKey');
        }
        const msg = `Missing configuration (${missing.join(', ')})`;
        logger.info(`[HealthKit] DISABLED: ${msg}`);
        healthkitStatus = { state: 'disabled', message: msg };
        return;
    }

    try {
        healthkitStatus = { state: 'initializing' };
        logger.info('[HealthKit] Inicializando SDK...');

        healthkit = new HealthKit({
            serviceId: config.healthkit.serviceId || 'rsshub',
            group: config.healthkit.group || 'production',
            mode: 'push',
            endpoint: config.healthkit.ingestUrl,
            apiKey: config.healthkit.apiKey,
            // NOTA: collectInterval não funciona em Vercel serverless (funções efêmeras).
            // O Dashboard HealthKit fará pull no endpoint /api/health quando não receber push.
        });

        logger.info('[HealthKit] SDK Inicializado. Enviando heartbeat inicial...');

        // Immediate verification: Send a heartbeat to confirm connectivity
        healthkit
            .push()
            .then(() => {
                logger.info('[HealthKit] Heartbeat enviado com SUCESSO! 💓');
                healthkitStatus = { state: 'connected', lastCheck: new Date().toISOString() };
            })
            .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error(`[HealthKit] FALHA no heartbeat inicial: ${errorMsg}`);
                healthkitStatus = { state: 'failed', message: `Failed to send initial heartbeat. Error: ${errorMsg}` };
            });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[HealthKit] ERRO FATAL na inicialização: ${errorMsg}`);
        healthkitStatus = { state: 'failed', message: errorMsg };
    }
}
