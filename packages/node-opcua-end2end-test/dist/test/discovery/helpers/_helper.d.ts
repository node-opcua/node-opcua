import { type OPCUABaseServer, OPCUADiscoveryServer, type OPCUADiscoveryServerOptions, OPCUAServer } from "node-opcua";
import "should";
import { wait } from "../../../test_helpers/utils.js";
import type { TestHarness } from "./harness.js";
export declare const pause: typeof wait;
export declare function createDiscovery(port: number): Promise<OPCUADiscoveryServer>;
export declare function startDiscovery(port: number): Promise<OPCUADiscoveryServer>;
/**
 * Wait until nothing holds `port` any more.
 *
 * `OPCUAServer.shutdown()` resolves before the operating system has released the listening
 * socket, so a test that shuts an LDS down and immediately starts another one on the same
 * port races that release. It is a race, so it passed on one Node version and failed on the
 * other with EADDRINUSE, which reads as an unrelated CI flake.
 *
 * Probing with a throwaway listener asks the only question that matters: can this port be
 * bound right now.
 */
export declare function waitUntilPortIsFree(port: number, timeout?: number): Promise<void>;
export declare const makeDiscoveryServer: (port_discovery: number, test: TestHarness, options?: Partial<OPCUADiscoveryServerOptions>) => Promise<OPCUADiscoveryServer>;
export declare function addServerCertificateToTrustedCertificateInDiscoveryServer(server: OPCUAServer, discoveryServer: OPCUADiscoveryServer): Promise<void>;
/**
 *
 * @param discoveryEndpointUrl
 * @param port
 * @param name
 */
export declare function createAndStartServer(discoveryEndpointUrl: string, port: number, name: string): Promise<OPCUAServer>;
export declare function createServerThatRegistersItselfToTheDiscoveryServer(discoveryServerEndpointUrl: string, port: number, name: string): Promise<OPCUAServer>;
export declare function ep(server: OPCUABaseServer): string;
export declare const tweak_registerServerManager_timeout: (server: OPCUAServer, timeout: number) => void;
export declare const startAndWaitForRegisteredToLDS: (server: OPCUAServer) => Promise<void>;
export type FF<T> = () => Promise<T>;
export declare function f<T>(func: FF<T>): FF<T>;
export declare function fa(title: string, func: () => Promise<void>): Promise<void>;
//# sourceMappingURL=_helper.d.ts.map