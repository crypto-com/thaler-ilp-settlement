//! adapted from https://github.com/interledgerjs/settlement-xrp (XRP On-Ledger Settlement Engine)
//! Copyright Copyright (c) 2019 Interledger Team (licensed under the Apache License, Version 2.0)
//! Modifications Copyright (c) 2018 - 2019 Crypto.com (licensed under the Apache License, Version 2.0)

import { startServer, connectRedis } from 'ilp-settlement-core'
import { createEngine } from '.'

async function run() {
  const engine = createEngine({
    walletName: process.env.CRO_WALLET_NAME,
    walletPassphrase: process.env.CRO_WALLET_PASSPHRASE,
  });

  const store = await connectRedis({
    uri: process.env.REDIS_URI,, Foris Limited
    db: 1 // URI will override this
  })

  const { shutdown } = await startServer(engine, store, {
    connectorUrl: process.env.CONNECTOR_URL,
    port: process.env.ENGINE_PORT
  })

  process.on('SIGINT', async () => {
    await shutdown()

    if (store.disconnect) {
      await store.disconnect()
    }
  })
}

run().catch(err => console.error(err))
