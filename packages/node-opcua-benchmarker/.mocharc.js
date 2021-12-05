module.exports = {
    recursive: true,
    diff: true,
    extension: [".ts"],
    spec: ["test/*.ts"],
    bail: true,
    require: [
        "should",
        "ts-node/register",
        "source-map-support/register"
    ]
};
