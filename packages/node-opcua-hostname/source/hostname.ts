import * as os from "os";

function trim(str: string, length?: number): string {
    if (!length) {
        return str;
    }
    return str.substr(0, Math.min(str.length, length));
}

let _fullyQualifiedDomainNameInCache: any = null;

export function get_fully_qualified_domain_name(optionalMaxLength?: number): string {
    if (_fullyQualifiedDomainNameInCache) {
        return trim(_fullyQualifiedDomainNameInCache, optionalMaxLength);
    }
    let fqdn;
    if (process.platform === "win32") {

        // http://serverfault.com/a/73643/251863
        const env = process.env;
        fqdn = env.COMPUTERNAME + ((env.USERDNSDOMAIN && env.USERDNSDOMAIN.length > 0) ? "." + env.USERDNSDOMAIN : "");
        _fullyQualifiedDomainNameInCache = fqdn;

    } else {

        fqdn = null;
        try {
            fqdn = require("fqdn");
            _fullyQualifiedDomainNameInCache = fqdn();
            if (/sethostname/.test(_fullyQualifiedDomainNameInCache)) {
                throw new Error("Detecting fqdn  on windows !!!");
            }

        } catch (err) {
            // fall back to old method
            _fullyQualifiedDomainNameInCache = os.hostname();
        }

    }
    return trim(_fullyQualifiedDomainNameInCache, optionalMaxLength);
}

// note : under windows ... echo %COMPUTERNAME%.%USERDNSDOMAIN%
