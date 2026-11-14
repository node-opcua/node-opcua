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
        serverCapabilities?: {
            serverProfileArray: string[];
        };
    };
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
export declare function addServerCapabilityIdentifier(server: IServerWithCapabilityIdentifiers, identifier: string): boolean;
/**
 * Withdraw an OPC 10000-12 Annex D ServerCapabilityIdentifier from a Server.
 *
 * When the last real identifier goes, the list becomes `["NA"]` rather than empty.
 *
 * @returns true when the capability list was changed.
 * @throws when `identifier` is not shaped like a capability identifier.
 */
export declare function removeServerCapabilityIdentifier(server: IServerWithCapabilityIdentifiers, identifier: string): boolean;
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
export declare function addServerProfile(server: IServerWithProfileArray, profileUri: string): boolean;
/**
 * Withdraw a Profile or Facet URI from the Server's `ServerCapabilities.ServerProfileArray`.
 *
 * @returns true when the ServerProfileArray was changed.
 * @throws when `profileUri` is not an absolute URI, or when the server is not initialized.
 */
export declare function removeServerProfile(server: IServerWithProfileArray, profileUri: string): boolean;
//# sourceMappingURL=server_capability_tools.d.ts.map