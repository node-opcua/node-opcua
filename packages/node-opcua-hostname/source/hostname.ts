/**
 * @module node-opcua-hostname
 */
import * as dns from "dns";
import * as os from "os";
import { promisify } from "util";

function trim(str: string, length?: number): string {
    if (!length) {
        return str;
    }
    return str.substr(0, Math.min(str.length, length));
}

function fqdn(callback: (err: Error | null, fqdn?: string) => void) {

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
        _fullyQualifiedDomainNameInCache = env.COMPUTERNAME
            + ((env.USERDNSDOMAIN && env.USERDNSDOMAIN!.length > 0) ? "." + env.USERDNSDOMAIN : "");

    } else {

        try {
            _fullyQualifiedDomainNameInCache = await promisify(fqdn)();
            if (/sethostname/.test(_fullyQualifiedDomainNameInCache as string)) {
                throw new Error("Detecting fqdn  on windows !!!");
            }
        } catch (err) {
            // fall back to old method
            _fullyQualifiedDomainNameInCache = os.hostname();
        }

    }
    return _fullyQualifiedDomainNameInCache!;
}

export async function prepareFQDN() {
    _fullyQualifiedDomainNameInCache = await extractFullyQualifiedDomainName();
}

export function getFullyQualifiedDomainName(optional_max_length?: number) {

    return _fullyQualifiedDomainNameInCache
        ? trim(_fullyQualifiedDomainNameInCache, optional_max_length)
        : "%FQDN%";
}

export function resolveFullyQualifiedDomainName(str: string): string {
    if (!str.match(/%FQDN%/)) {
        return str;
    }
    if (!_fullyQualifiedDomainNameInCache) {
        throw new Error("FullyQualifiedDomainName computation is not completed yet");
    }
    return str.replace("%FQDN%", _fullyQualifiedDomainNameInCache);
}
// note : under windows ... echo %COMPUTERNAME%.%USERDNSDOMAIN%
prepareFQDN();
