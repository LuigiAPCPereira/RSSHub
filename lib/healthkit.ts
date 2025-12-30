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
        dashboardUrl: config.healthkit.dashboardUrl,
        ingestUrl: config.healthkit.ingestUrl,
        serviceId: config.healthkit.serviceId,
        status: healthkitStatus,
        configPresent: {
            hasDashboardUrl: !!config.healthkit.dashboardUrl,
            hasIngestUrl: !!config.healthkit.ingestUrl,
            hasApiKey: !!config.healthkit.apiKey,
        },
    };
}

export function initHealthKit() {
    logger.info('[HealthKit] Tentando inicializar HealthKit...');

    // Determinar qual URL usar: dashboardUrl (novo) ou ingestUrl (legado)
    const dashboardUrl = config.healthkit.dashboardUrl || config.healthkit.ingestUrl;

    logger.info(`[HealthKit] Config detectada: DashboardURL=${!!dashboardUrl}, APIKey=${!!config.healthkit.apiKey}`);

    if (healthkit) {
        logger.info('[HealthKit] Instância já existe. Pulando.');
        return;
    }

    if (!dashboardUrl) {
        const msg = 'Missing configuration (dashboardUrl or ingestUrl)';
        logger.info(`[HealthKit] DISABLED: ${msg}`);
        healthkitStatus = { state: 'disabled', message: msg };
        return;
    }

    try {
        healthkitStatus = { state: 'initializing' };
        logger.info('[HealthKit] Inicializando SDK com auto-registration...');

        // Nova API do SDK com auto-registration
        healthkit = new HealthKit({
            serviceId: config.healthkit.serviceId || 'rsshub',
            group: config.healthkit.group || 'production',
            mode: 'pull', // Modo pull com auto-registration
            dashboardUrl,
            apiKey: config.healthkit.apiKey,
            healthEndpointPath: '/api/health', // Path padrão
            autoRegister: true, // Habilita auto-registration
        });

        logger.info('[HealthKit] SDK Inicializado. Fazendo auto-registration no Dashboard...');

        // O SDK agora faz auto-registration no boot
        healthkit
            .collect()
            .then(() => {
                logger.info('[HealthKit] Auto-registration concluído com SUCESSO! 💓');
                logger.info(`[HealthKit] Pull fallback configurado para /api/health`);
                healthkitStatus = { state: 'connected', lastCheck: new Date().toISOString() };
            })
            .catch((error) => {
                const errorMsg = error instanceof Error ? error.message : String(error);
                logger.error(`[HealthKit] FALHA no auto-registration: ${errorMsg}`);
                healthkitStatus = { state: 'failed', message: `Failed to auto-register. Error: ${errorMsg}` };
            });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[HealthKit] ERRO FATAL na inicialização: ${errorMsg}`);
        healthkitStatus = { state: 'failed', message: errorMsg };
    }
}
