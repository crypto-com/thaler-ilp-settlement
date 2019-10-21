#! adapted from https://github.com/interledger-rs/interledger-rs (Interledger.rs)
#! Copyright (c) 2018-2019 Evan Schwartz and contributors (licensed under the Apache License Version 2.0)
#! Copyright (c) 2017-2018 Evan Schwartz (licensed under the Apache License Version 2.0)
FROM node:current-alpine
WORKDIR /app

COPY package.json .

RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD bin/run.js
