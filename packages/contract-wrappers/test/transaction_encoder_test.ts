import { BlockchainLifecycle } from '@0xproject/dev-utils';
import { FillScenarios } from '@0xproject/fill-scenarios';
import { assetDataUtils, ecSignOrderHashAsync, generatePseudoRandomSalt, orderHashUtils } from '@0xproject/order-utils';
import { SignedOrder, SignerType } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';
import 'mocha';

import { ContractWrappers } from '../src';
import { TransactionEncoder } from '../src/utils/transaction_encoder';

import { constants } from './utils/constants';
import { tokenUtils } from './utils/token_utils';
import { provider, web3Wrapper } from './utils/web3_wrapper';

const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);

describe('TransactionEncoder', () => {
    let contractWrappers: ContractWrappers;
    let userAddresses: string[];
    let fillScenarios: FillScenarios;
    let exchangeContractAddress: string;
    let makerTokenAddress: string;
    let takerTokenAddress: string;
    let coinbase: string;
    let makerAddress: string;
    let senderAddress: string;
    let takerAddress: string;
    let makerAssetData: string;
    let takerAssetData: string;
    let txHash: string;
    const fillableAmount = new BigNumber(5);
    const takerTokenFillAmount = new BigNumber(5);
    let signedOrder: SignedOrder;
    const config = {
        networkId: constants.TESTRPC_NETWORK_ID,
        blockPollingIntervalMs: 0,
    };
    before(async () => {
        await blockchainLifecycle.startAsync();
        contractWrappers = new ContractWrappers(provider, config);
        exchangeContractAddress = contractWrappers.exchange.getContractAddress();
        userAddresses = await web3Wrapper.getAvailableAddressesAsync();
        const zrxTokenAddress = tokenUtils.getProtocolTokenAddress();
        fillScenarios = new FillScenarios(
            provider,
            userAddresses,
            zrxTokenAddress,
            exchangeContractAddress,
            contractWrappers.erc20Proxy.getContractAddress(),
            contractWrappers.erc721Proxy.getContractAddress(),
        );
        [coinbase, makerAddress, takerAddress, senderAddress] = userAddresses;
        [makerTokenAddress, takerTokenAddress] = tokenUtils.getDummyERC20TokenAddresses();
        [makerAssetData, takerAssetData] = [
            assetDataUtils.encodeERC20AssetData(makerTokenAddress),
            assetDataUtils.encodeERC20AssetData(takerTokenAddress),
        ];
        signedOrder = await fillScenarios.createFillableSignedOrderAsync(
            makerAssetData,
            takerAssetData,
            makerAddress,
            takerAddress,
            fillableAmount,
        );
    });
    after(async () => {
        await blockchainLifecycle.revertAsync();
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('encode and executeTransaction', () => {
        const executeTransactionOrThrowAsync = async (
            encoder: TransactionEncoder,
            data: string,
            signerAddress: string = takerAddress,
        ): Promise<void> => {
            const salt = generatePseudoRandomSalt();
            const encodedTransaction = encoder.getTransactionHex(data, salt, signerAddress);
            const signature = await ecSignOrderHashAsync(
                provider,
                encodedTransaction,
                signerAddress,
                SignerType.Default,
            );
            txHash = await contractWrappers.exchange.executeTransactionAsync(
                salt,
                signerAddress,
                data,
                signature,
                senderAddress,
            );
            await web3Wrapper.awaitTransactionSuccessAsync(txHash, constants.AWAIT_TRANSACTION_MINED_MS);
        };
        describe('#fillOrder', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.fillOrder(signedOrder, takerTokenFillAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#fillOrderNoThrow', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.fillOrderNoThrow(signedOrder, takerTokenFillAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#fillOrKillOrder', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.fillOrKillOrder(signedOrder, takerTokenFillAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#marketSellOrders', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.marketSellOrders([signedOrder], takerTokenFillAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#marketSellOrdersNoThrow', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.marketSellOrdersNoThrow([signedOrder], takerTokenFillAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#marketBuyOrders', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.marketBuyOrders([signedOrder], fillableAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#marketBuyOrdersNoThrow', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.marketBuyOrdersNoThrow([signedOrder], fillableAmount);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#preSign', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const orderHash = orderHashUtils.getOrderHashHex(signedOrder);
                const signature = signedOrder.signature;
                const data = encoder.preSign(orderHash, makerAddress, signature);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#setSignatureValidatorApproval', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const isApproved = true;
                const data = encoder.setSignatureValidatorApproval(senderAddress, isApproved);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#batchFillOrders', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.batchFillOrders([signedOrder], [takerTokenFillAmount]);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#batchFillOrKillOrders', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.batchFillOrKillOrders([signedOrder], [takerTokenFillAmount]);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#batchFillOrdersNoThrow', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.batchFillOrdersNoThrow([signedOrder], [takerTokenFillAmount]);
                await executeTransactionOrThrowAsync(encoder, data);
            });
        });
        describe('#batchCancelOrders', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.batchCancelOrders([signedOrder]);
                const signerAddress = makerAddress;
                await executeTransactionOrThrowAsync(encoder, data, signerAddress);
            });
        });
        describe('#cancelOrder', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const data = encoder.cancelOrder(signedOrder);
                const signerAddress = makerAddress;
                await executeTransactionOrThrowAsync(encoder, data, signerAddress);
            });
        });
        describe('#cancelOrdersUpTo', () => {
            it('should successfully execute the transaction', async () => {
                const encoder = await contractWrappers.exchange.transactionEncoderAsync();
                const targetEpoch = signedOrder.salt;
                const data = encoder.cancelOrdersUpTo(targetEpoch);
                const signerAddress = makerAddress;
                await executeTransactionOrThrowAsync(encoder, data, signerAddress);
            });
        });
    });
});
