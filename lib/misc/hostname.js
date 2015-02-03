var _fully_qualified_domain_name_cache = null;
function get_fully_qualified_domain_name()
{
    if (_fully_qualified_domain_name_cache) {
        return _fully_qualified_domain_name_cache;
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
        _fully_qualified_domain_name_cache = require("os").hostname().toLowerCase();
    }

    return _fully_qualified_domain_name_cache;
}

exports.get_fully_qualified_domain_name = get_fully_qualified_domain_name;
