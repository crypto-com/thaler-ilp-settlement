<!--
//! adapted from https://github.com/interledgerjs/settlement-xrp (XRP On-Ledger Settlement Engine)
//! Copyright Copyright (c) 2019 Interledger Team (licensed under the Apache License, Version 2.0)
//! Modifications Copyright (c) 2018 - 2019, Foris Limited (licensed under the Apache License, Version 2.0)
-->
# CRO On-Ledger Settlement Engine

> Settle Interledger payments using on-ledger CRO transfers

[![Prettier](https://img.shields.io/badge/code_style-prettier-brightgreen.svg?style=flat-square)](https://prettier.io/)
[![Apache 2.0 License](https://img.shields.io/github/license/crypto-com/settlement-cro.svg?style=flat-square)](https://github.com/crypto-com/settlement-CRO/blob/master/LICENSE)

## Install

```bash
npm install
npm run build
```

## Run

```bash
DEBUG=settlement* npm start
```

## Configuration

Optionally configure the settlement engine using these environment variables:

- **`CRO_WALLET_NAME`**: The CRO wallet name
- **`CRO_WALLET_PASSPHRASE`**: The CRO wallet passphrase
- **`CLIENT_RPC_HOST`**: Hostname of the ClientRPC server.
- **`CLIENT_RPC_PORT`**: Port of the ClientRPC server.
- **`CONNECTOR_URL`**: URL of the connector's server dedicated to this settlement engine.
  - Default: `http://localhost:7771`
- **`ENGINE_PORT`**: Port of the settlement engine server exposed to the connector (e.g. for triggering automated settlements).
  - Default: `3000`
- **`REDIS_URI`**: URI to communicate with Redis, typically in the format `redis://[:PASSWORD@]HOST[:PORT][/DATABASE]`.
  - Default: `127.0.0.1:6379/1` (database index of 1 instead of 0)
  - Note: this settlement engine **must** use a unique Redis database index (or dedicated Redis instance) for security to prevent conflicting with the connector.
- **`DEBUG`**: Pattern for printing debug logs. To view logs, `settlement*` is recommended.
