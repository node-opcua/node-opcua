

var trim = function(str,length) {
    if (!length) { return str; }
    return str.substr(0,Math.min(str.length,length));
}
var _fully_qualified_domain_name_cache = null;

function get_fully_qualified_domain_name(optional_max_length)
{
    if (_fully_qualified_domain_name_cache) {
        return trim(_fully_qualified_domain_name_cache,optional_max_length);
    }

    var fqdn = null;
    try {
        fqdn = require("fqdn");
        _fully_qualified_domain_name_cache =fqdn();
        if (/sethostname/.test(_fully_qualified_domain_name_cache)) {
            throw new Error("Detecting fqdn  on windows !!!");
        }

    } catch(err){
        // fall back to old method
        _fully_qualified_domain_name_cache = require("os").hostname();
    }

    return trim(_fully_qualified_domain_name_cache,optional_max_length);
}

exports.get_fully_qualified_domain_name = get_fully_qualified_domain_name;
