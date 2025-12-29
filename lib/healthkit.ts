import { HealthKit } from '@healthkit/sdk';

import { config } from '@/config';
import logger from '@/utils/logger';

let healthkit: HealthKit | null = null;

export function initHealthKit() {
    if (healthkit) {
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
        logger.info(`HealthKit disabled: Missing configuration (${missing.join(', ')})`);
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

        // Immediate verification: Send a heartbeat to confirm connectivity
        healthkit
            .push()
            .then(() => {
                logger.info('HealthKit: Initial heartbeat sent successfully 💓');
            })
            .catch((error) => {
                logger.error(`HealthKit: Failed to send initial heartbeat. Check your API Key and Ingest URL. Error: ${error instanceof Error ? error.message : error}`);
            });
    } catch (error) {
        logger.error(`HealthKit initialization failed: ${error}`);
    }
}
