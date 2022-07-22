<!--
//! adapted from https://github.com/interledger-rs/interledger-rs (Interledger.rs)
//! Copyright (c) 2018-2019 Evan Schwartz and contributors (licensed under the Apache License Version 2.0)
//! Copyright (c) 2017-2018 Evan Schwartz (licensed under the Apache License Version 2.0)
//! Modifications Copyright (c) 2018 - 2019 (licensed under the Apache License, Version 2.0)
-->
# Interledger with CRO On-Ledger Settlement

> A demo that sends payments between 2 Interledger.rs nodes and settles using CRO transactions.

## Overview

This example shows how to configure Interledger.rs nodes and use the CRO devnet as a settlement ledger for payments sent between the nodes. To learn about settlement in Interledger, refer to [Peering, Clearing and Settling](https://github.com/interledger/rfcs/blob/master/0032-peering-clearing-settlement/0032-peering-clearing-settlement.md).

## Prerequisites

- [Rust](#rust)
- [CRO Settlement Engine](#CRO-settlement-engine)
- [Redis](#redis)

### Rust

Because Interledger.rs is written in the Rust language, you need the Rust environment. Refer to the [Getting started](https://www.rust-lang.org/learn/get-started) page or just `curl https://sh.rustup.rs -sSf | sh` and follow the instructions.

### CRO Settlement Engine

Interledger.rs and settlement engines written in other languages are fully interoperable. Here, we'll use the [CRO Ledger Settlement Engine](https://github.com/interledgerjs/settlement-CRO/), which is written in TypeScript. We'll need `node` and `npm` to install and run the settlement engine. If you don't have it already, refer to [Install Node.js](#install-nodejs).

Install the settlement engine as follows:

```bash
npm install
npm run build
```

(This build the `ilp-settlement-CRO` to the `dist` folder.)

#### Install Node.js

(In case you don't have Node.js) There are a few ways to install Node.js. If you work on multiple JavaScript or TypeScript projects which require different `node` versions, using `nvm` may be suitable.

- [`nvm`](https://github.com/nvm-sh/nvm) (node version manager)
  - macOS: If you use [Homebrew](https://brew.sh/), run `brew install nvm` and you'll see some additional instructions. Follow it and `nvm install node` and `nvm use node`.
  - others: Refer to [`nvm`](https://github.com/nvm-sh/nvm) site.
- Install independently
  - macOS: If you use [Homebrew](https://brew.sh/), run `brew install node`
  - Ubuntu: `sudo apt-get install nodejs npm`

Then you should be able to use `npm`.

### Redis

The Interledger.rs nodes and settlement engines currently use [Redis](https://redis.io/) to store their data (SQL database support coming soon!). Nodes and settlement engines can use different Redis instances.

- Compile and install from the source code
  - [Download the source code here](https://redis.io/download)
- Install using package managers
  - Ubuntu: run `sudo apt-get install redis-server`
  - macOS: If you use Homebrew, run `brew install redis`

Make sure your Redis is empty. You could run `redis-cli flushall` to clear all the data.

## Instructions

### 1. Build interledger.rs

First of all, let's build interledger.rs after cloning it from [here](https://github.com/crypto-com/interledger-rs). (This may take a couple of minutes)

```bash
cargo build --bin ilp-node --bin ilp-cli
```

### 2. Launch Redis

```bash
# Create the logs directory if it doesn't already exist
mkdir -p logs

# Start Redis
redis-server --port 6379 &> logs/redis-a-node.log &
redis-server --port 6380 &> logs/redis-a-se.log &
redis-server --port 6381 &> logs/redis-b-node.log &
redis-server --port 6382 &> logs/redis-b-se.log &
```

To remove all the data in Redis, you might additionally perform:

```bash
for port in `seq 6379 6382`; do
    redis-cli -p $port flushall
done
```

When you want to watch logs, use the `tail` command. You can use the command like: `tail -f logs/redis-a-node.log`

### 3. Launch Settlement Engines

Because each node needs its own settlement engine, we need to launch both a settlement engine for Alice's node and another settlement engine for Bob's node.

You have to [setup Tendermint + chain-abci + chain-tx-enclave and setup client-rpc server in your local environment](https://crypto-com.github.io/getting-started/local_full_node_development.html#local-full-node-development). Create two accounts with following setups:

Default Wallet (Alice)
- Name: Default
- Passphrase: 123456
- Balance: > 1 CRO

Bob Wallet
- Name: Bob
- Passphrase: 123456
- Balance: 0 CRO

Alternatively, you may use different wallet setup in environment variable.

```bash
# Turn on debug logging for all of the interledger.rs components
export RUST_LOG=interledger=debug

# Start Default(Alice)'s settlement engine
DEBUG="settlement*" \
CRO_WALLET_NAME="Default" \
CRO_WALLET_PASSPHRASE="123456" \
REDIS_URI=127.0.0.1:6380 \
npm start | tee logs/node-alice-settlement-engine.log

# Start Bob's settlement engine
DEBUG="settlement*" \
CRO_WALLET_NAME="Bob" \
CRO_WALLET_PASSPHRASE="123456" \
CONNECTOR_URL="http://localhost:8771" \
REDIS_URI=127.0.0.1:6382 \
ENGINE_PORT=3001 \
npm start | tee logs/node-bob-settlement-engine.log
```

### 4. Launch 2 Nodes

```bash
# Start Alice's node
RUST_LOG=interledger=trace \
ILP_ADDRESS=example.alice \
ILP_SECRET_SEED=8852500887504328225458511465394229327394647958135038836332350604 \
ILP_ADMIN_AUTH_TOKEN=hi_alice \
ILP_REDIS_URL=redis://127.0.0.1:6379/ \
ILP_HTTP_BIND_ADDRESS=127.0.0.1:7770 \
ILP_SETTLEMENT_API_BIND_ADDRESS=127.0.0.1:7771 \
cargo run --bin ilp-node &> logs/node-alice.log &

# Start Bob's node
RUST_LOG=interledger=trace \
ILP_ADDRESS=example.bob \
ILP_SECRET_SEED=1604966725982139900555208458637022875563691455429373719368053354 \
ILP_ADMIN_AUTH_TOKEN=hi_bob \
ILP_REDIS_URL=redis://127.0.0.1:6381/ \
ILP_HTTP_BIND_ADDRESS=127.0.0.1:8770 \
ILP_SETTLEMENT_API_BIND_ADDRESS=127.0.0.1:8771 \
cargo run --bin ilp-node &> logs/node-bob.log &
```

### 5. Configure the Nodes

```bash
ln -s ../../target/debug/ilp-cli ilp-cli
export ILP_CLI_API_AUTH=hi_alice

# Adding settlement accounts should be done at the same time because it checks each other

printf "Adding Alice's account...\n"
./ilp-cli accounts create alice \
    --ilp-address example.alice \
    --asset-code CRO \
    --asset-scale 8 \
    --max-packet-amount 100 \
    --ilp-over-http-incoming-token in_alice \
    --ilp-over-http-url http://localhost:7770/ilp \
    --settle-to 0 > logs/account-alice-alice.log

printf "Adding Bob's Account...\n"
./ilp-cli --node http://localhost:8770 accounts create bob \
    --auth hi_bob \
    --ilp-address example.bob \
    --asset-code CRO \
    --asset-scale 8 \
    --max-packet-amount 100 \
    --ilp-over-http-incoming-token in_bob \
    --ilp-over-http-url http://localhost:8770/ilp \
    --settle-to 0 > logs/account-bob-bob.log

printf "Adding Bob's account on Alice's node...\n"
./ilp-cli accounts create bob \
    --ilp-address example.bob \
    --asset-code CRO \
    --asset-scale 8 \
    --max-packet-amount 100 \
    --settlement-engine-url http://localhost:3000 \
    --ilp-over-http-incoming-token bob_password \
    --ilp-over-http-outgoing-token alice:alice_password \
    --ilp-over-http-url http://localhost:8770/ilp \
    --settle-threshold 500 \
    --min-balance -1000 \
    --settle-to 0 \
    --routing-relation Peer > logs/account-alice-bob.log &

printf "Adding Alice's account on Bob's node...\n"
./ilp-cli --node http://localhost:8770 accounts create alice \
    --auth hi_bob \
    --ilp-address example.alice \
    --asset-code CRO \
    --asset-scale 8 \
    --max-packet-amount 100 \
    --settlement-engine-url http://localhost:3001 \
    --ilp-over-http-incoming-token alice_password \
    --ilp-over-http-outgoing-token bob:bob_password \
    --ilp-over-http-url http://localhost:7770/ilp \
    --settle-threshold 500 \
    --min-balance -1000 \
    --settle-to 0 \
    --routing-relation Peer > logs/account-bob-alice.log &

sleep 2
```

Now two nodes and its settlement engines are set and accounts for each node are also set up.

Notice how we use Alice's settlement engine endpoint while registering Bob. This means that whenever Alice interacts with Bob's account, she'll use that Settlement Engine.

The `settle_threshold` and `settle_to` parameters control when settlements are triggered. The node will send a settlement when an account's balance reaches the `settle_threshold`, and it will settle for `balance - settle_to`.

### 6. Sending a Payment

The following script sends a payment from Alice to Bob.

```bash
./ilp-cli pay alice \
    --auth in_alice \
    --amount 500 \
    --to http://localhost:8770/accounts/bob/spsp
```

To try settling multiple times, send more than 500 basic unit of CRO:

```bash
./ilp-cli pay alice \
    --auth in_alice \
    --amount 1500 \
    --to http://localhost:8770/accounts/bob/spsp
```

### 7. Check Balances

```bash
printf "\nAlice's balance on Alice's node: "
./ilp-cli accounts balance alice

printf "\nBob's balance on Alice's node: "
./ilp-cli accounts balance bob

printf "\nAlice's balance on Bob's node: "
./ilp-cli --node http://localhost:8770 accounts balance alice --auth hi_bob 

printf "\nBob's balance on Bob's node: "
./ilp-cli --node http://localhost:8770 accounts balance bob --auth hi_bob 
```

### 8. Kill All the Services

Finally, you can stop all the services as follows:

```bash #
for port in `seq 6379 6382`; do
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null ; then
        redis-cli -p ${port} shutdown
    fi
done

if [ -f dump.rdb ] ; then
    rm -f dump.rdb
fi

for port in 8545 7770 8770 3000 3001; do
    if lsof -tPi :${port} >/dev/null ; then
        kill `lsof -tPi :${port}`
    fi
done
```

If you are using Docker, try the following.

```bash #
# Depending on your OS, you might not need to prefix with `sudo` necessarily.
sudo docker stop \
    interledger-rs-node_a \
    interledger-rs-node_b \
    interledger-rs-se_a \
    interledger-rs-se_b \
    redis-alice_node \
    redis-alice_se \
    redis-bob_node \
    redis-bob_se
```

## Advanced

### Check the Incoming Settlement on CROL

You'll find incoming settlement logs in your settlement engine logs. Try:

```bash #
cat logs/node-bob-settlement-engine.log | grep "Received incoming CRO payment"
```

If you are using Docker, try:

```bash #
docker logs interledger-rs-se_b | grep "Received incoming CRO payment"
```

## Troubleshooting

```
# When installing Node.js with apt-get
E: Unable to locate package nodejs
E: Unable to locate package npm
```

Try `sudo apt-get update`.

```
# When running with Docker
Error starting userland proxy: listen tcp 0.0.0.0:6379: bind: address already in use.
```

You might have run another example. Stop them first and try again. How to stop the services is written in each example page.

## Conclusion

This example showed an SPSP payment sent between two Interledger.rs nodes that settled using on-ledger CRO transactions.

Check out the [other examples](../README.md) for more complex demos that show other features of Interledger, including multi-hop routing and cross-currency payments.
