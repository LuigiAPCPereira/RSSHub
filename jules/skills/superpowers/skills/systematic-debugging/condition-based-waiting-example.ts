// Complete implementation of condition-based waiting utilities
// From: Lace test infrastructure improvements (2025-10-03)
// Context: Fixed 15 flaky tests by replacing arbitrary timeouts

import type { ThreadManager } from '~/threads/thread-manager';
import type { LaceEvent, LaceEventType } from '~/threads/types';

/**
 * Aguarda a ocorrência do primeiro evento de um tipo específico em uma thread.
 *
 * Rejeita com um Error se o evento não for observado dentro do tempo especificado por `timeoutMs`.
 *
 * @param threadId - Identificador da thread cujos eventos serão verificados
 * @param eventType - Tipo de evento a ser aguardado
 * @param timeoutMs - Tempo máximo em milissegundos para aguardar (padrão: 5000)
 * @returns O primeiro `LaceEvent` cujo `type` corresponde a `eventType`
 */
export function waitForEvent(threadManager: ThreadManager, threadId: string, eventType: LaceEventType, timeoutMs = 5000): Promise<LaceEvent> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        let timerId: NodeJS.Timeout;

        const check = () => {
            const events = threadManager.getEvents(threadId);
            const event = events.find((e) => e.type === eventType);

            if (event) {
                if (timerId) {
                    clearTimeout(timerId);
                }
                resolve(event);
            } else if (Date.now() - startTime > timeoutMs) {
                if (timerId) {
                    clearTimeout(timerId);
                }
                reject(new Error(`Timeout waiting for ${eventType} event after ${timeoutMs}ms`));
            } else {
                timerId = setTimeout(check, 10); // Poll every 10ms for efficiency
            }
        };

        check();
    });
}

/**
 * Aguarda até que um thread receba pelo menos um número especificado de eventos de um tipo dado.
 *
 * Rejeita com um `Error` se o número requerido de eventos não for observado dentro de `timeoutMs`.
 *
 * @param threadId - Identificador do thread a ser monitorado
 * @param eventType - Tipo de evento a aguardar
 * @param count - Quantidade mínima de eventos correspondentes necessária para resolver
 * @param timeoutMs - Tempo máximo de espera em milissegundos (padrão: 5000)
 * @returns Array contendo os primeiros `count` eventos que correspondem ao `eventType`
 */
export function waitForEventCount(threadManager: ThreadManager, threadId: string, eventType: LaceEventType, count: number, timeoutMs = 5000): Promise<LaceEvent[]> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            const events = threadManager.getEvents(threadId);
            const matchingEvents = events.filter((e) => e.type === eventType);

            if (matchingEvents.length >= count) {
                resolve(matchingEvents.slice(0, count));
            } else if (Date.now() - startTime > timeoutMs) {
                reject(new Error(`Timeout waiting for ${count} ${eventType} events after ${timeoutMs}ms (got ${matchingEvents.length})`));
            } else {
                setTimeout(check, 10);
            }
        };

        check();
    });
}

/**
 * Wait for an event matching a custom predicate
 * Useful when you need to check event data, not just type
 *
 * @param threadManager - The thread manager to query
 * @param threadId - Thread to check for events
 * @param predicate - Function that returns true when event matches
 * @param description - Human-readable description for error messages
 * @param timeoutMs - Maximum time to wait (default 5000ms)
 * @returns Promise resolving to the first matching event
 *
 * Example:
 *   // Wait for TOOL_RESULT with specific ID
 *   await waitForEventMatch(
 *     threadManager,
 *     agentThreadId,
 *     (e) => e.type === 'TOOL_RESULT' && e.data.id === 'call_123',
 *     'TOOL_RESULT with id=call_123'
 *   );
 */
export function waitForEventMatch(threadManager: ThreadManager, threadId: string, predicate: (event: LaceEvent) => boolean, description: string, timeoutMs = 5000): Promise<LaceEvent> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            const events = threadManager.getEvents(threadId);
            const event = events.find(predicate);

            if (event) {
                resolve(event);
            } else if (Date.now() - startTime > timeoutMs) {
                reject(new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`));
            } else {
                setTimeout(check, 10);
            }
        };

        check();
    });
}

// Usage example from actual debugging session:
//
// BEFORE (flaky):
// ---------------
// const messagePromise = agent.sendMessage('Execute tools');
// await new Promise(r => setTimeout(r, 300)); // Hope tools start in 300ms
// agent.abort();
// await messagePromise;
// await new Promise(r => setTimeout(r, 50));  // Hope results arrive in 50ms
// expect(toolResults.length).toBe(2);         // Fails randomly
//
// AFTER (reliable):
// ----------------
// const messagePromise = agent.sendMessage('Execute tools');
// await waitForEventCount(threadManager, threadId, 'TOOL_CALL', 2); // Wait for tools to start
// agent.abort();
// await messagePromise;
// await waitForEventCount(threadManager, threadId, 'TOOL_RESULT', 2); // Wait for results
// expect(toolResults.length).toBe(2); // Always succeeds
//
// Result: 60% pass rate → 100%, 40% faster execution