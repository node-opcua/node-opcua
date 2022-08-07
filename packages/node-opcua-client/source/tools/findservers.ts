/**
 * @module node-opcua-client
 */
import * as async from "async";

import { ErrorCallback } from "node-opcua-status-code";
import { ServerOnNetwork } from "node-opcua-service-discovery";
import { ApplicationDescription, EndpointDescription } from "node-opcua-service-endpoints";
import { ClientBaseImpl } from "../private/client_base_impl";

export interface FindServerResults {
    servers: ApplicationDescription[];
    endpoints: EndpointDescription[];
}
/**
 * extract the server endpoints exposed by a discovery server
 * @method findServers
 * @async
 * @param discoveryServerEndpointUri
 * @param callback
 */
export function findServers(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, result?: FindServerResults) => void
): void;
export async function findServers(discoveryServerEndpointUri: string): Promise<FindServerResults>;
export function findServers(
    discoveryServerEndpointUri: string,
    callback?: (err: Error | null, result?: FindServerResults) => void
): any {
    const client = new ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });

    let servers: ApplicationDescription[] = [];
    let endpoints: EndpointDescription[] = [];

    async.series(
        [
            (innerCallback: ErrorCallback) => {
                client.connect(discoveryServerEndpointUri, innerCallback);
            },

            (innerCallback: ErrorCallback) => {
                client.findServers((err: Error | null, _servers?: ApplicationDescription[]) => {
                    if (_servers) {
                        servers = _servers;
                    }
                    innerCallback(err ? err : undefined);
                });
            },

            (innerCallback: ErrorCallback) => {
                client.getEndpoints({ endpointUrl: undefined }, (err: Error | null, _endpoints?: EndpointDescription[]) => {
                    if (_endpoints) {
                        endpoints = _endpoints;
                    }
                    innerCallback(err ? err : undefined);
                });
            }
        ],
        (err) => {
            client.disconnect(() => {
                callback!(err ? err : null, { servers, endpoints });
            });
        }
    );
}

/**
 * extract the server endpoints exposed by a discovery server
 */
export async function findServersOnNetwork(discoveryServerEndpointUri: string): Promise<ServerOnNetwork[]>;
export function findServersOnNetwork(
    discoveryServerEndpointUri: string,
    callback: (err: Error | null, servers?: ServerOnNetwork[]) => void
): void;
export function findServersOnNetwork(
    discoveryServerEndpointUri: string,
    callback?: (err: Error | null, servers?: ServerOnNetwork[]) => void
): any {
    const client = new ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });

    client.connect(discoveryServerEndpointUri, (err?: Error) => {
        if (!err) {
            client.findServersOnNetwork((err1, servers) => {
                client.disconnect(() => {
                    callback!(err1, servers);
                });
            });
        } else {
            client.disconnect(() => {
                callback!(err);
            });
        }
    });
}

// tslint:disable:no-var-requires
const thenify = require("thenify");
(module.exports as any).findServersOnNetwork = thenify.withCallback((module.exports as any).findServersOnNetwork);
(module.exports as any).findServers = thenify.withCallback((module.exports as any).findServers);
