// (e.g. typedoc --options ./typedoc.js ./src), then you can set an array of exclude paths in the configuration:
//    typedoc.js:

module.exports = {
    src: [ "./source/index.ts" ],
    out: "./out1/",

    readme: "./documentation/readme.md",
    includes: "./documentation",
    exclude: ["*/@types/**"],
    mode: "file",
    //xx excludeExternals: true,
    excludeNotExported: true,
    excludePrivate: true,
    includeDeclarations: true,
    moduleResolution: "node",
    theme: "default",
    logger: "console"
};

