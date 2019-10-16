import { RpcClient } from "./rpc-client";
import { TendermintClient } from "./tendermint-client";

export const newRpcClient = (
	host: string = "localhost",
	port: number = 26659,
): RpcClient => {
	return new RpcClient(`${host}:${port}`);
};

export const newTendermintClient = (
	host: string = "localhost",
	port: number = 26657,
): TendermintClient => {
	return new TendermintClient(`${host}:${port}`);
};

export const sleep = (ms: number = 1000) => {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

export interface WalletRequest {
	name: string;
	passphrase: string;
}

export const asyncMiddleman = async (
	promise: Promise<any>,
	errorMessage: String,
): Promise<any> => {
	try {
		return await promise;
	} catch (err) {
		throw Error(`${errorMessage}: ${err.message}`);
	}
};
