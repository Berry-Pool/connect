/* @flow */
import { validateParams } from './paramsValidator';

import type { CardanoTxOutput } from '../../../types/trezor/protobuf';
import { addressParametersToProto, validateAddressParameters } from './cardanoAddressParameters';
import type { AssetGroupWithTokens } from './cardanoTokenBundle';
import { tokenBundleToProto } from './cardanoTokenBundle';

export type OutputWithData = {
    output: CardanoTxOutput,
    tokenBundle?: AssetGroupWithTokens[],
    inlineDatum?: string,
    referenceScript?: string,
};

// export type OutputWithTokens = {
//     output: CardanoTxOutput,
//     tokenBundle?: AssetGroupWithTokens[],
// };

const hexStringByteLength = (s: string) => s.length / 2;

const sendChunkedHexString = async (
    typedCall: any,
    data: string,
    chunkSize: number,
    messageType: string,
) => {
    let processedSize = 0;
    while (processedSize < data.length) {
        const chunk = data.slice(processedSize, processedSize + chunkSize);
        await typedCall(messageType, 'CardanoTxItemAck', {
            data: chunk,
        });
        processedSize += chunkSize;
    }
};

export const transformOutput = (output: any): OutputWithData => {
    validateParams(output, [
        { name: 'address', type: 'string' },
        { name: 'amount', type: 'uint', required: true },
        { name: 'tokenBundle', type: 'array', allowEmpty: true },
        { name: 'datumHash', type: 'string' },
        { name: 'format', type: 'number' },
        { name: 'inlineDatum', type: 'string' },
        { name: 'referenceScript', type: 'string' },
    ]);

    const result: OutputWithData = {
        output: {
            amount: output.amount,
            asset_groups_count: 0,
            datum_hash: output.datumHash,
            format: output.format,
            inline_datum_size: output.inlineDatum
                ? hexStringByteLength(output.inlineDatum)
                : undefined,
            reference_script_size: output.referenceScript
                ? hexStringByteLength(output.referenceScript)
                : undefined,
        },
        inlineDatum: output.inlineDatum,
        referenceScript: output.referenceScript,
    };

    if (output.addressParameters) {
        validateAddressParameters(output.addressParameters);
        result.output.address_parameters = addressParametersToProto(output.addressParameters);
    } else {
        result.output.address = output.address;
    }

    if (output.tokenBundle) {
        result.tokenBundle = tokenBundleToProto(output.tokenBundle);
        result.output.asset_groups_count = result.tokenBundle.length;
    } else {
        result.output.asset_groups_count = 0;
    }

    return result;
};

export const sendOutput = async (typedCall: any, outputWithData: OutputWithData) => {
    const MAX_CHUNK_SIZE = 1024 * 2; // 1024 hex-encoded bytes

    const { output, tokenBundle, inlineDatum, referenceScript } = outputWithData;

    await typedCall('CardanoTxOutput', 'CardanoTxItemAck', output);
    if (tokenBundle) {
        for (const assetGroup of tokenBundle) {
            await typedCall('CardanoAssetGroup', 'CardanoTxItemAck', {
                policy_id: assetGroup.policyId,
                tokens_count: assetGroup.tokens.length,
            });
            for (const token of assetGroup.tokens) {
                await typedCall('CardanoToken', 'CardanoTxItemAck', token);
            }
        }
    }

    if (inlineDatum) {
        await sendChunkedHexString(
            typedCall,
            inlineDatum,
            MAX_CHUNK_SIZE,
            'CardanoTxInlineDatumChunk',
        );
    }

    if (referenceScript) {
        await sendChunkedHexString(
            typedCall,
            referenceScript,
            MAX_CHUNK_SIZE,
            'CardanoTxReferenceScriptChunk',
        );
    }
};
