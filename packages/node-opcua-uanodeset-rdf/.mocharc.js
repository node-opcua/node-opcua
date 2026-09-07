module.exports = {
    ...require("../.mocharc.js"),
    bail: true,
    reporter: "spec",
    spec: "test/**/*.ts",
    timeout: 20000,
    ui: "bdd"
};
