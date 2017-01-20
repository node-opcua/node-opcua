const BrowsePath_Schema = {
    name: "BrowsePath",
    fields: [
        { name: "startingNode", fieldType: "NodeId" },
        { name: "relativePath", fieldType: "RelativePath" }
    ]
};
export {BrowsePath_Schema};