/**
 * @module node-opcua-hostname
 */
import dns from "node:dns";
import net from "node:net";
import os from "node:os";
import { promisify } from "node:util";

function trim(str: string, length?: number): string {
    if (!length) {
        return str;
    }
    return str.substring(0, Math.min(str.length, length));
}

function fqdn(callback: (err: Error | null, fqdn?: string) => void): void {
    const uqdn = os.hostname();

    dns.lookup(uqdn, { hints: dns.ADDRCONFIG }, (err1: Error | null, ip: string) => {
        if (err1) {
            return callback(err1);
        }

        dns.lookupService(ip, 0, (err2: Error | null, _fqdn: string) => {
            if (err2) {
                return callback(err2);
            }
            _fqdn = _fqdn.replace(".localdomain", "");
            callback(null, _fqdn);
        });
    });
}

let _fullyQualifiedDomainNameInCache: string | undefined;

/**
 * extract FullyQualifiedDomainName of this computer
 */
export async function extractFullyQualifiedDomainName(): Promise<string> {
    if (_fullyQualifiedDomainNameInCache) {
        return _fullyQualifiedDomainNameInCache;
    }
    if (process.platform === "win32") {
        // http://serverfault.com/a/73643/251863
        const env = process.env;
        _fullyQualifiedDomainNameInCache =
            env.COMPUTERNAME + (env.USERDNSDOMAIN && env.USERDNSDOMAIN.length > 0 ? `.${env.USERDNSDOMAIN}` : "");
    } else {
        try {
            _fullyQualifiedDomainNameInCache = await promisify(fqdn)();
            if (_fullyQualifiedDomainNameInCache === "localhost") {
                throw new Error("localhost not expected");
            }
            if (/sethostname/.test(_fullyQualifiedDomainNameInCache as string)) {
                throw new Error("Detecting fqdn  on windows !!!");
            }
        } catch (_err) {
            // fall back to old method
            _fullyQualifiedDomainNameInCache = os.hostname();
        }
    }
    return _fullyQualifiedDomainNameInCache || "";
}

export async function prepareFQDN(): Promise<void> {
    _fullyQualifiedDomainNameInCache = await extractFullyQualifiedDomainName();
}

export function getFullyQualifiedDomainName(optional_max_length?: number): string {
    if (!_fullyQualifiedDomainNameInCache) {
        throw new Error("FullyQualifiedDomainName computation is not completed yet");
    }
    return _fullyQualifiedDomainNameInCache ? trim(_fullyQualifiedDomainNameInCache, optional_max_length) : "%FQDN%";
}

export function getHostname(): string {
    return os.hostname();
}

export function resolveFullyQualifiedDomainName(str: string): string {
    if (!_fullyQualifiedDomainNameInCache) {
        throw new Error("FullyQualifiedDomainName computation is not completed yet");
    }
    str = str.replace("%FQDN%", _fullyQualifiedDomainNameInCache);
    str = str.replace("{FQDN}", _fullyQualifiedDomainNameInCache);
    str = str.replace("{hostname}", getHostname());
    return str;
}

/**
 * Return all non-internal IPv4 addresses detected on this host.
 *
 * The result is sorted for deterministic output.
 */
export function getIpAddresses(): string[] {
    const ipAddresses: string[] = [];
    const netInterfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(netInterfaces)) {
        const ifaces = netInterfaces[interfaceName];
        if (!ifaces) {
            continue;
        }
        for (const iface of ifaces) {
            if (iface.family === "IPv4" && !iface.internal) {
                ipAddresses.push(iface.address);
            }
        }
    }
    return ipAddresses.sort();
}

/**
 * Check whether a string is an IP address (v4 or v6).
 *
 * Returns `4` for IPv4, `6` for IPv6, or `0` if the string
 * is a hostname (not an IP literal).
 *
 * Useful for segregating `alternateHostname` and
 * `advertisedEndpoints` values into SAN `dNSName` vs
 * `iPAddress` entries.
 */
export function isIPAddress(value: string): 0 | 4 | 6 {
    return net.isIP(value) as 0 | 4 | 6;
}

/**
 * Convert a dotted-decimal IPv4 address to a hex string.
 *
 * This matches the format returned by `exploreCertificate`'s
 * `iPAddress` SAN entries (e.g. `"192.168.1.69"` → `"c0a80145"`).
 */
export function ipv4ToHex(ip: string): string {
    return ip
        .split(".")
        .map((octet) => Number.parseInt(octet, 10).toString(16).padStart(2, "0"))
        .join("");
}

// note : under windows ... echo %COMPUTERNAME%.%USERDNSDOMAIN%
prepareFQDN();
