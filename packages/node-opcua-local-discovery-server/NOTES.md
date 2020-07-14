## Notes

### updating the docker image to hub.docker.com

-   login to docker

```
$ docker login --username=_your_hub_username --email=youremail@company.com
```

-   check docker image id

```
$ docker images list

```

-   build docker image (with tag lds)

```
$ npm run docker-build

```

-   push image

```
$ docker tag lds  sterfive/lds:1.0
$ docker push sterfive/lds:1.0
```
