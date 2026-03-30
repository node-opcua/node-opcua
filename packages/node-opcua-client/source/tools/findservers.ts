/**
 * @module node-opcua-client
 */

import type { ServerOnNetwork } from "node-opcua-service-discovery";
import type { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";


import { ClientBaseImpl } from "../private/client_base_impl";

export interface FindServerResults {
    servers: ApplicationDescription[];
    endpoints: EndpointDescription[];
}
export async function findServersAsync(discoveryServerEndpointUri: string): Promise<FindServerResults> {
    const client = new ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });
    try {
        await client.connect(discoveryServerEndpointUri);
        const servers = await client.findServers();
        const endpoints = await client.getEndpoints({ endpointUrl: undefined });
        return { servers, endpoints };
    } finally {
        await client.disconnect();
    }
}

/**
 * extract the server endpoints exposed by a discovery server
 */
export function findServers(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, result?: FindServerResults) => void
): void;
export function findServers(discoveryServerEndpointUri: string): Promise<FindServerResults>;
export function findServers(
    discoveryServerEndpointUri: string,
    callback?: (err: Error | null, result?: FindServerResults) => void
): Promise<FindServerResults> | undefined {
    if (!callback) {
        return findServersAsync(discoveryServerEndpointUri);
    }
    findServersAsync(discoveryServerEndpointUri)
        .then((result) => callback(null, result))
        .catch((err) => callback(err));
    return undefined;
}
export async function findServersOnNetworkAsync(discoveryServerEndpointUri: string): Promise<ServerOnNetwork[]> {
    const client = new ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });
    try {
        await client.connect(discoveryServerEndpointUri);
        const servers = await client.findServersOnNetwork();
        return servers;
    } finally {
        await client.disconnect();
    }
}

/**
 * extract the server endpoints exposed by a discovery server
 */
export function findServersOnNetwork(discoveryServerEndpointUri: string): Promise<ServerOnNetwork[]>;
export function findServersOnNetwork(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, servers?: ServerOnNetwork[]) => void
): void;
export function findServersOnNetwork(
    discoveryServerEndpointUri: string,
    callback?: (err: Error | null, servers?: ServerOnNetwork[]) => void
): Promise<ServerOnNetwork[]> | undefined {
    if (!callback) {
        return findServersOnNetworkAsync(discoveryServerEndpointUri);
    }
    findServersOnNetworkAsync(discoveryServerEndpointUri)
        .then((servers) => callback(null, servers))
        .catch((err) => callback(err));
    return undefined;
}
