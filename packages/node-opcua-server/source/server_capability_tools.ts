/**
 * @module node-opcua-server
 */
// Server-level entry points for the list editors of node-opcua-data-model
// (addCapabilityIdentifier, addProfileUri, ...), which work on a bare string array.
import { addCapabilityIdentifier, addProfileUri, removeCapabilityIdentifier, removeProfileUri } from "node-opcua-data-model";

/**
 * The part of an `OPCUAServer` that holds its OPC 10000-12 Annex D ServerCapabilityIdentifiers.
 *
 * On an `OPCUAServer`, `capabilitiesForMDNS` feeds both the mDNS / LDS registration
 * and the `ServerConfiguration.ServerCapabilities` Property.
 */
export interface IServerWithCapabilityIdentifiers {
    capabilitiesForMDNS?: string[];
}

/**
 * The part of an `OPCUAServer` that holds its `Server.ServerCapabilities.ServerProfileArray`.
 *
 * `engine` only exists once `server.initialize()` has run.
 */
export interface IServerWithProfileArray {
    engine?: {
        serverCapabilities?: { serverProfileArray: string[] };
    };
}

function capabilityListOf(server: IServerWithCapabilityIdentifiers): string[] {
    if (!server.capabilitiesForMDNS) {
        server.capabilitiesForMDNS = [];
    }
    return server.capabilitiesForMDNS;
}

function profileListOf(server: IServerWithProfileArray, caller: string): string[] {
    const serverCapabilities = server.engine?.serverCapabilities;
    if (!serverCapabilities) {
        throw new Error(`${caller}: the server engine is not available. Call it after server.initialize().`);
    }
    if (!serverCapabilities.serverProfileArray) {
        serverCapabilities.serverProfileArray = [];
    }
    return serverCapabilities.serverProfileArray;
}

/**
 * Declare an OPC 10000-12 Annex D ServerCapabilityIdentifier (e.g. `"DA"`, `"HD"`, `"AC"`,
 * `"GDS"`, `"ALIAS"`) on a Server.
 *
 * The capability list is edited in place and left deduplicated (case-insensitively)
 * and sorted; the `"NA"` placeholder is dropped as soon as a real identifier is present.
 * Call it before `server.start()` for the identifier to be part of the mDNS / LDS
 * registration.
 *
 * @returns true when the capability list was changed.
 * @throws when `identifier` is not shaped like a capability identifier.
 */
export function addServerCapabilityIdentifier(server: IServerWithCapabilityIdentifiers, identifier: string): boolean {
    return addCapabilityIdentifier(capabilityListOf(server), identifier);
}

/**
 * Withdraw an OPC 10000-12 Annex D ServerCapabilityIdentifier from a Server.
 *
 * When the last real identifier goes, the list becomes `["NA"]` rather than empty.
 *
 * @returns true when the capability list was changed.
 * @throws when `identifier` is not shaped like a capability identifier.
 */
export function removeServerCapabilityIdentifier(server: IServerWithCapabilityIdentifiers, identifier: string): boolean {
    return removeCapabilityIdentifier(capabilityListOf(server), identifier);
}

/**
 * Advertise a Profile or Facet URI in the Server's `ServerCapabilities.ServerProfileArray`,
 * e.g. `"http://opcfoundation.org/UA-Profile/Server/GlobalCertificateManagement"`.
 *
 * The array is edited in place and left deduplicated and sorted.
 * Call it after `server.initialize()`.
 *
 * @returns true when the ServerProfileArray was changed.
 * @throws when `profileUri` is not an absolute URI, or when the server is not initialized.
 */
export function addServerProfile(server: IServerWithProfileArray, profileUri: string): boolean {
    return addProfileUri(profileListOf(server, "addServerProfile"), profileUri);
}

/**
 * Withdraw a Profile or Facet URI from the Server's `ServerCapabilities.ServerProfileArray`.
 *
 * @returns true when the ServerProfileArray was changed.
 * @throws when `profileUri` is not an absolute URI, or when the server is not initialized.
 */
export function removeServerProfile(server: IServerWithProfileArray, profileUri: string): boolean {
    return removeProfileUri(profileListOf(server, "removeServerProfile"), profileUri);
}
