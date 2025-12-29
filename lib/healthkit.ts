import { HealthKit } from '@healthkit/sdk';

import { config } from '@/config';
import logger from '@/utils/logger';

let healthkit: HealthKit | null = null;

export function initHealthKit() {
    if (healthkit) {
        return;
    }

    if (!config.healthkit.ingestUrl || !config.healthkit.apiKey) {
        logger.info('HealthKit disabled: Missing ingestUrl or apiKey');
        return;
    }

    try {
        healthkit = new HealthKit({
            serviceId: config.healthkit.serviceId || 'rsshub',
            group: config.healthkit.group || 'production',
            mode: 'push',
            endpoint: config.healthkit.ingestUrl,
            apiKey: config.healthkit.apiKey,
            collectInterval: 60000, // 60 seconds
        });
        logger.info('HealthKit initialized in push mode');
    } catch (error) {
        logger.error(`HealthKit initialization failed: ${error}`);
    }
}
