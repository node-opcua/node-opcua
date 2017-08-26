const webpack = require("webpack");
const path  = require("path");
const nodeExternals = require("webpack-node-externals");
const babiliWebpackPlugin = require("babili-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");


// -------------------------------------------------------------
//
// -------------------------------------------------------------
const node_opcua_dll = {
    target: "node",
    context: __dirname,
    entry: {
        "node-opcua": "./packages/node-opcua/index.js",
    },
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].dll.js"
    },
    node: {
        __dirname: true,
        fs: "empty",
        net: "empty",
        child_process: "empty"
    },
    externals: [nodeExternals({
        whitelist: [/opcua/]
    })],

    // "spawn-sync", "camelcase", "string-width", "read-pkg-up", "os-locale", "memcpy", "yargs", "ursa", "usage", "require-main-filename"],
    // module: {
    //     rules: [
    //         {
    //             test: /\.js$/,
    //             //xx exclude: [/node_modules/],
    //             loader: "babel-loader",
    //             query: {
    //                  presets: ["es2015"],
    //             },
    //         }
    //     ]
    // },
    plugins: [
        new webpack.DllPlugin({
            path: path.join(__dirname, "dist", "[name]-manifest.json"),
            name: "[name]_[hash]"
        }),
      new MinifyPlugin({}/*minifyOpts*/, {}/*pluginOpts*/)
        // new webpack.optimize.UglifyJsPlugin({
        //      minimize: true,
        //      compress:true
        // })
        // new babiliWebpackPlugin({
        //     mangle: { "topLevel": true },
        //     deadcode: true
        // }),
    ]
};
const simple_client = {
    target: "node",
    context: __dirname,
    entry: {
        // node_opcua: "./packages/node-opcua/index.js",
        simple_server: "./bin/simple_server.js"
    },
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "[name].bundle.js"
    },
    node: {
        __dirname: true,
        fs: "empty",
        net: "empty",
        child_process: "empty"
    },
    externals: [nodeExternals({
        whitelist: [/opcua/]
    })],

    // "spawn-sync", "camelcase", "string-width", "read-pkg-up", "os-locale", "memcpy", "yargs", "ursa", "usage", "require-main-filename"],
    // module: {
    //     rules: [
    //         {
    //             test: /\.js$/,
    //             //xx exclude: [/node_modules/],
    //             loader: "babel-loader",
    //             query: {
    //                  presets: ["es2015"],
    //             },
    //         }
    //     ]
    // },
    plugins: [
        new webpack.DllReferencePlugin({
            context: path.join(__dirname, "dist", "dll"),
            manifest: require("../dist/js/alpha-manifest.json") // eslint-disable-line
        }),
        new MinifyPlugin({}/*minifyOpts*/, {}/*pluginOpts*/)
        // new webpack.optimize.UglifyJsPlugin({
        //      minimize: true,
        //      compress:true
        // })
        // new babiliWebpackPlugin({
        //     mangle: { "topLevel": true },
        //     deadcode: true
        // }),
    ]
};

module.exports = [ node_opcua_dll,simple_client,];