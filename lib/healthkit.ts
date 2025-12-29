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
    // RAW LOG para garantir visibilidade no Vercel
    console.log('[HealthKit] Tentando inicializar HealthKit...');
    console.log(`[HealthKit] Config detectada: URL=${!!config.healthkit.ingestUrl}, APIKey=${!!config.healthkit.apiKey}`);

    if (healthkit) {
        console.log('[HealthKit] Instância já existe. Pulando.');
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
        console.log(`[HealthKit] DISABLED: ${msg}`);
        logger.info(`HealthKit disabled: ${msg}`);
        healthkitStatus = { state: 'disabled', message: msg };
        return;
    }

    try {
        healthkitStatus = { state: 'initializing' };
        console.log('[HealthKit] Inicializando SDK...');

        healthkit = new HealthKit({
            serviceId: config.healthkit.serviceId || 'rsshub',
            group: config.healthkit.group || 'production',
            mode: 'push',
            endpoint: config.healthkit.ingestUrl,
            apiKey: config.healthkit.apiKey,
            collectInterval: 60000, // 60 seconds
        });

        console.log('[HealthKit] SDK Inicializado. Enviando heartbeat inicial...');
        logger.info('HealthKit initialized in push mode');

        // Immediate verification: Send a heartbeat to confirm connectivity
        healthkit
            .push()
            .then(() => {
                console.log('[HealthKit] Heartbeat enviado com SUCESSO! 💓');
                logger.info('HealthKit: Initial heartbeat sent successfully 💓');
                healthkitStatus = { state: 'connected', lastCheck: new Date().toISOString() };
            })
            .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`[HealthKit] FALHA no heartbeat inicial: ${errorMsg}`);
                const msg = `Failed to send initial heartbeat. Error: ${errorMsg}`;
                logger.error(`HealthKit: ${msg}`);
                healthkitStatus = { state: 'failed', message: msg };
            });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[HealthKit] ERRO FATAL na inicialização: ${errorMsg}`);
        logger.error(`HealthKit initialization failed: ${errorMsg}`);
        healthkitStatus = { state: 'failed', message: errorMsg };
    }
}
