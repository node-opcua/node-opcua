function is_dataEncoding(dataEncoding) {
    return (dataEncoding && typeof dataEncoding.name === "string");
}

function is_valid_dataEncoding(dataEncoding) {

    var valid_encoding = ["DefaultBinary", "DefaultXml"];

    if (!is_dataEncoding(dataEncoding)) {
        return true;
    }
    return valid_encoding.indexOf(is_dataEncoding.name) !== -1;
}
exports.is_dataEncoding = is_dataEncoding;
exports.is_valid_dataEncoding = is_valid_dataEncoding;
