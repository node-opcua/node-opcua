"use strict";
const webpack = require("webpack");
const path  = require("path");
const nodeExternals = require("webpack-node-externals");
const babiliWebpackPlugin = require("babili-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");


// -------------------------------------------------------------
//
// -------------------------------------------------------------
module.exports  = {
    target: "node",
    context: __dirname,
    entry: ["./packages/node-opcua/index.js"],
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        library: "vendor_lib_[hash]",
        libraryTarget: "commonjs",
        filename: "node-opcua.js"
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
             //xx context: __dirname,
             path: path.join(__dirname, "dist", "opcua-manifest.json"),
             name: "opcua_[hash]"
        })
        // new MinifyPlugin({}/*minifyOpts*/, {}/*pluginOpts*/)
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

