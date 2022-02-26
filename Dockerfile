FROM node:12

WORKDIR /app

COPY setup.js ./Server/
COPY ./Server/package*.json ./Server/
COPY ./Server/lib/package*.json ./Server/lib/
COPY ./Server/lib/ ./Server/lib/

RUN cd Server && node setup

RUN cd Server/lib && npx grunt default pack

WORKDIR /kkutu