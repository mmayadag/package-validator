FROM node:26-alpine

WORKDIR /app
COPY server.mjs .

EXPOSE 9999
HEALTHCHECK CMD wget -qO- http://127.0.0.1:9999/-/package/ava/dist-tags || exit 1

CMD ["node", "server.mjs"]
