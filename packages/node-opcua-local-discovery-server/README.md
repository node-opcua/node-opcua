# node-opcua-local-discovery-server

A local discovery server made with node-opcua that you can easily deploy using npm or docker

## installing the LDS using npm

```
$ npm install -g node-opcua-local-discovery-server
$ lds --version
```

## running from NPX

```
$npx node-opcua-local-discovery-server --help
```

| Command             | type    | alias | default | comment                                                                           |
| ------------------- | ------- | ----- | ------- | --------------------------------------------------------------------------------- |
| --help              |         |       |         | display help message                                                              |
| --version           |         |       |         | display the node-opcua version used by the lds                                    |
| --alternateHostname |         |       |         | alternate compute name used when certificate is created (see note)                |
| --force             | boolean | -f    | false   | force the creation of the certificate (overwrite existing certificate) (see note) |
| --port              | number  | -p    | 4840    | the LDS tcp listening port                                                        |
| --tolerant          | boolean | -t    | true    | if set, the LDS will automatically accept as valid any new server certificate     |

notes!

-   LDS certificate is only created the first time he LDS program is run or if the certificate file cannot be found or if the `--force` argument is passed to the command line.

-   `alternateHostname` must be set appropriately when certificate is created.

-   it is recommended to use `--tolerant false` in production environment for extra security

-   if `--tolerant false` is set to false, your server may fail to register itself to the LDS,as LDS will reject the connection because the certificate is not known. You will have to make sure that your server certificate file existing the trusted folder ( and is not present in the rejected folder of the lds pki).
-   the LDS display in the console the location of the `trusted` certificate folders,
-   you can manually move rejected certificate file from the rejected folder to the trusted/cert folder to trust them.
-   if `--tolerant true` or not specified, then the LDS accept secure connection from any server, unless server certificate appears in the `rejected` folder already.

```
#  docker run sterfive/lds:latest --help
Options:
  --version              Show version number                                                                               [boolean]
  --alternateHostname
  --help                 Show help                                                                                         [boolean]
  -n, --applicationName  the application name                                                                               [string]
  -p, --port             port to listen to (default: 4840)                                                                  [number]
  -f, --force            force recreation of LDS self-signed certification (taking into account alternateHostname)         [boolean]
  -t, --tolerant         automatically accept unknown registering server certificate                                       [boolean]
```

## running LDS in a docker container

### in the background

#### under linux

```
$ docker run -d -p 4840:4840 -v /temp/lds-config:/root/.config -e HOSTNAME=`hostname --fqdn` sterfive/lds:latest
```

#### on windows

```
$ docker run -d -p 4840:4840 -v C:\temp\lds-config:/root/.config -e HOSTNAME=%COMPUTERNAME% sterfive/lds:latest
```

### interactively

if you want to run the lds interactively use `-it` instead of `-d` in the above commands.

#### passing argument

You can pass some command arguments to the LDS when you run it with docker. Simply add them after `lds`

#### checking the discovery server certificate

-   By using the `-v` command the generated certificate will be in a permanent drive of your docker host machine.
-   Next time you run the LDS the certificate will not be recreated if it exists already unless you use the `-f` command.
-   you can check that the certificate with openssl using this command:

```
openssl x509 -in c:\sterfive_config\node-opcua-local-discovery-server-nodejs\pki\local_discovery_server_certificate.pem -text
```
