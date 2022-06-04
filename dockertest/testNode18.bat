docker image rm node18
docker build . -f DockerfileNode18 -t node18
docker run -it --rm --name node18 -p 22:22 node18 /bin/bash


