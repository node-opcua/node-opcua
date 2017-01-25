function is_dataEncoding(dataEncoding) {
  return (dataEncoding && typeof dataEncoding.name === "string");
}

function is_valid_dataEncoding(dataEncoding) {
  const valid_encoding = ["DefaultBinary", "DefaultXml"];

  if (!is_dataEncoding(dataEncoding)) {
    return true;
  }
  return valid_encoding.indexOf(is_dataEncoding.name) !== -1;
}
export { is_dataEncoding };
export { is_valid_dataEncoding };
