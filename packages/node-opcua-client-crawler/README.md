## node-opcua-client-crawler

Crawls an OPC UA server address space and returns nodes with their attributes.

### Status: unmaintained, still MIT

This package is no longer maintained. It remains available under the MIT license,
it keeps working with node-opcua-client >= 2.124, and you are free to use, fork
and republish it. It receives no new fixes. The final published version is 2.127.2.

At the first crawler instantiation, the package prints a one-time notice about this
status. Set `NODEOPCUA_CRAWLER_SILENT=1` to hide it.

### Why it is not replaced by a new MIT version

The crawler was rewritten from scratch for performance and robustness. The new
implementation depends on commercially licensed components, so it cannot be
released under MIT and cannot replace this package.

### Want to maintain it?

Forks, pull requests and new maintainers are welcome. Open an issue on the
node-opcua repository if you would like to take over this package.

### Supported alternative

Sterfive provides the rewritten crawler, `@sterfive/crawler`, to NodeOPCUA
Subscription members: https://support.sterfive.com

## Copyright

Copyright (c) 2022-2025  Sterfive SAS - 833264583 RCS ORLEANS - France (https://www.sterfive.com)
