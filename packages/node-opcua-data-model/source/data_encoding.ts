
export function isDataEncoding(dataEncoding: any): boolean {
    return (dataEncoding && typeof dataEncoding.name === "string");
}

export function isValidDataEncoding(dataEncoding: string): boolean {

    const validEncoding = ["DefaultBinary", "DefaultXml"];

    if (!isDataEncoding(dataEncoding)) {
        return true;
    }
    return validEncoding.indexOf(dataEncoding) !== -1;
}

