FROM node:slim
WORKDIR /root
COPY package.json .
RUN npm init -y && npm install 
ENV HOSTNAME=%fqdn%
EXPOSE 4840/tcp
# expose mDNS bonjour port for zero conf
EXPOSE 5353/udp 
COPY ./bin/local-discovery-server.mjs .
RUN which node
ENTRYPOINT  ["/usr/local/bin/node" , "/root/local-discovery-server.mjs"]
CMD [""]
#  docker run -it  -p 4840:4840 -v c:\temp\_config:/root/.config lds