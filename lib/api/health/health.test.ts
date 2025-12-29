import { describe, expect, it, vi } from 'vitest';
import app from '@/api';

// Mock HealthKit
vi.mock('@healthkit/sdk', () => {
    return {
        HealthKit: class {
            constructor(options: any) {
                // Mock implementation
            }
            addCheck(name: string, check: () => Promise<any>) {
                // Mock implementation
            }
            async collect() {
                return {
                    status: 'ok',
                    checks: {
                        redis: { status: 'ok', latency_ms: 10 },
                    },
                    system: {
                        memory: {},
                        cpu: {},
                    },
                };
            }
            async push() {
                // Mock implementation
            }
        },
    };
});

describe('Health API', () => {
    it('should return 200 OK and health data', async () => {
        const res = await app.request('/health');
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.status).toBe('ok');
        expect(data.checks.redis.status).toBe('ok');
    });
});
