import { logger } from '../utils/logger';

export interface ServiceCall {
    domain: string;
    service: string;
    target?: {
        entity_id?: string | string[];
    };
    data?: Record<string, any>;
}

export interface EntityState {
    entity_id: string;
    state: string;
    attributes: Record<string, any>;
    last_changed: string;
    last_updated: string;
}

export class HomeAssistantService {
    private baseUrl: string;
    private token: string;

    constructor(baseUrl: string, token: string) {
        // Ensure base URL doesn't have trailing slash
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
    }

    private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
        const url = `${this.baseUrl}/api${path}`;
        const headers = {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            ...options.headers,
        };

        try {
            const response = await fetch(url, { ...options, headers });

            if (!response.ok) {
                throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`);
            }

            return (await response.json()) as T;
        } catch (error) {
            logger.error(`Failed to fetch from Home Assistant: ${error}`);
            throw error;
        }
    }

    async getStates(): Promise<EntityState[]> {
        return this.fetch<EntityState[]>('/states');
    }

    async getState(entityId: string): Promise<EntityState | null> {
        try {
            return await this.fetch<EntityState>(`/states/${entityId}`);
        } catch (error) {
            logger.warn(`Failed to get state for ${entityId}: ${error}`);
            return null; // Return null if entity not found or error
        }
    }

    async getRelevantEntities(): Promise<{ domain: string; entity_id: string; state: string; attributes: any }[]> {
        try {
            const states = await this.getStates();
            const relevantDomains = ['person', 'light', 'switch', 'sensor', 'binary_sensor', 'climate', 'cover', 'lock'];

            return states
                .filter(state => {
                    const domain = state.entity_id.split('.')[0];
                    const isRelevantDomain = relevantDomains.includes(domain);
                    const isUnavailable = state.state === 'unavailable' || state.state === 'unknown';
                    // Filter out some common system/internal entities or noise if needed
                    // For now, simple domain filtering + availability check
                    return isRelevantDomain && !isUnavailable;
                })
                .map(state => ({
                    domain: state.entity_id.split('.')[0],
                    entity_id: state.entity_id,
                    state: state.state,
                    attributes: state.attributes
                }));
        } catch (error) {
            logger.error(`Failed to get relevant entities: ${error}`);
            return [];
        }
    }

    async callService(domain: string, service: string, serviceData: Record<string, any> = {}): Promise<void> {
        await this.fetch(`/services/${domain}/${service}`, {
            method: 'POST',
            body: JSON.stringify(serviceData),
        });
        logger.info(`Called service ${domain}.${service} with data: ${JSON.stringify(serviceData)}`);
    }
}
