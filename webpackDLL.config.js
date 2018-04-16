"use strict";
const webpack = require("webpack");
const path  = require("path");
const nodeExternals = require("webpack-node-externals");
const babiliWebpackPlugin = require("babili-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");


// -------------------------------------------------------------
//
// -------------------------------------------------------------
const config  = {
    target: "node",
    //xx context: __dirname,
    entry: ["./packages/node-opcua/index.js"],
    devtool: "source-map",
    output: {
        path: path.resolve(path.join(__dirname, "dist")),
        //xx library: "vendor_lib_[hash]",
        libraryTarget: "commonjs",
        filename: "node-opcua.bundle.min.js"
    },
    node: {
        __dirname: false, // not original dirname
        fs: "empty",
        net: "empty",
        child_process: "empty"
    },
    externals: [nodeExternals({
        whitelist: [/.*/,/opcua/]
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
        // new webpack.DllPlugin({
        //      //xx context: __dirname,
        //      path: path.join(__dirname, "dist", "opcua-manifest.json"),
        //      name: "opcua_[hash]"
        // })
        // new MinifyPlugin({}/*minifyOpts*/, {}/*pluginOpts*/)
        // new webpack.optimize.UglifyJsPlugin({
        //      minimize: true,
        //      compress:true
        // })
        new babiliWebpackPlugin ({
              mangle:false,// { "topLevel": false },
              deadcode: true
         }, {
             comments: false
        }),
        new CopyWebpackPlugin([
            // {output}/file.txt
            {
                to: path.resolve(path.join(__dirname, "dist/nodesets/")),
                from: "packages/node-opcua-nodesets/nodesets/" }
        ])
    ]
};

const configMax = {
    target: "node",
    //xx context: __dirname,
    entry: ["./packages/node-opcua/index.js"],
    devtool: "source-map",
    output: {
        path: path.resolve(path.join(__dirname, "dist")),
        //xx library: "vendor_lib_[hash]",
        libraryTarget: "commonjs",
        filename: "node-opcua.bundle.js"
    },
    node: {
        __dirname: false, // not original dirname
        fs: "empty",
        net: "empty",
        child_process: "empty"
    },
    externals: [nodeExternals({
        whitelist: [/.*/,/opcua/]
    })]
};

module.exports  = [ config , configMax ];