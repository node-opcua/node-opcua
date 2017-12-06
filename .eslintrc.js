module.exports = {
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: "module"
    },
    globals : {
        "Float32Array": true,
        "Float64Array": true,
        "Int8Array": true,
        "Int16Array": true,
        "Int32Array": true,
        "Int64Array": true,
        "Uint8Array": true,
        "Uint16Array": true,
        "Uint32Array": true,
        "Uint64Array": true,
        "__dirname": false,
    },
    env: {
        node: true,
        mocha: true
    },
    rules: {
        strict: 0,                   // controls location of Use Strict Directives
        "no-underscore-dangle": 0,     // disallow dangling underscores in identifiers
        "no-irregular-whitespace": 0,  // disallow irregular whitespace outside of strings and comments
        "no-multi-spaces": 0,           // disallow use of multiple spaces
        "key-spacing": 0,               // enforces spacing between keys and values in object literal proper
        "comma-spacing": 0,             // enforce spacing before and after comma
        "no-trailing-spaces": 0,        // disallow trailing whitespace at the end of lines
        "no-unused-vars": 0,            // disallow declaration of variables that are not used in the code
        // styling issues
        "camelcase": 0,
        "complexity": [2, 20],
        "max-depth": [2, 5],            // Maximum of 2 deep.
        "max-params": [1, 7],
        "max-statements": [1, 40],
        // to fix
        "no-use-before-define": 0,        // disallow use of variables before they are defined
        "quotes": 0,                      // specify whether double or single quotes should be used
        "no-lone-blocks": 0,
        "no-shadow": 0,
        "comma-dangle": 0,
        "dot-notation": 0,
        "no-console": 0,
    },
    "plugins": []
};
