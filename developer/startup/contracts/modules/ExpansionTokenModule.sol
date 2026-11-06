// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IOpenFourTokenModule} from "../../vendor/openfour/contracts/interfaces/IOpenFourTokenModule.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";

import {IOpenFourModuleSchema} from "../../vendor/openfour/contracts/interfaces/IOpenFourModuleSchema.sol";
import {
    ModuleEncodeSchema,
    ParamDescriptor
} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
contract ExpansionTokenModule is IOpenFourTokenModule, IOpenFourModuleSchema {
    bytes private _initParams;
    string private _moduleVersion;
    bool private _created;

    constructor() {
        _created = true; // Lock the implementation; each fresh module proxy starts false.
    }

    function descriptor()
        external
        view
        override
        returns (bytes8 tagId, string memory tag, string memory version)
    {
        tag = "module.token.bnb_expansion_v2";
        return (bytes8(keccak256(bytes(tag))), tag, _moduleVersion);
    }

    function createToken(
        address creator,
        address token,
        address vault,
        address curveModule,
        address tradeModule,
        address migrateModule,
        address customDataModule,
        OpenFourTypes.TokenCreateParams calldata tokenParams,
        string calldata tokenImplVersion,
        string calldata tokenModuleVersion
    ) external override returns (uint256 maxSupply, string memory name, string memory symbol) {
        require(!_created, "TokenModule: already created");
        _created = true;
        _moduleVersion = tokenModuleVersion;
        _initParams = tokenParams.tokenParams;
        name = tokenParams.name;
        symbol = tokenParams.symbol;
        maxSupply = tokenParams.maxSupply;

        require(bytes(name).length != 0, "TokenModule: empty name");
        require(bytes(symbol).length != 0, "TokenModule: empty symbol");
        require(token != address(0), "TokenModule: zero token");

        OpenFourToken(token).initialize(
            OpenFourToken.InitArgs({
                name: name,
                symbol: symbol,
                vault: vault,
                maxSupply: maxSupply,
                tokenUri: tokenParams.tokenUri,
                curveModule: curveModule,
                tradeModule: tradeModule,
                migrateModule: migrateModule,
                tokenModule: address(this),
                customDataModule: customDataModule,
                creator: creator,
                quoteAsset: tokenParams.quoteAsset,
                tokenParams: tokenParams.tokenParams,
                requestId: tokenParams.requestId,
                tokenImplVersion: tokenImplVersion
            })
        );
    }

    function getInitParams() external view returns (bytes memory) {
        return _initParams;
    }
    function moduleEncodeSchema() external pure returns (ModuleEncodeSchema memory) {
        ParamDescriptor[] memory p = new ParamDescriptor[](6);
        p[0] = ParamDescriptor(
            "sourceEid",
            "uint32",
            0,
            false,
            "Solana endpoint ID",
            "40168",
            "40168 testnet; 30168 mainnet",
            "",
            ""
        );
        p[1] = ParamDescriptor(
            "sourcePeer",
            "bytes32",
            0,
            false,
            "Canonical OFT store",
            "",
            "Solana store encoded as bytes32",
            "",
            ""
        );
        p[2] = ParamDescriptor(
            "sourceMint",
            "bytes32",
            0,
            false,
            "Source mint",
            "",
            "Approved SPL mint encoded as bytes32",
            "",
            ""
        );
        p[3] = ParamDescriptor(
            "depositor",
            "bytes32",
            0,
            false,
            "Bootstrap signer",
            "",
            "Source depositor encoded as bytes32",
            "",
            ""
        );
        p[4] = ParamDescriptor(
            "depositId",
            "bytes32",
            0,
            false,
            "Deposit identifier",
            "",
            "Unique committed bootstrap identifier",
            "",
            ""
        );
        p[5] = ParamDescriptor(
            "beneficiary",
            "address",
            0,
            false,
            "Surplus recipient",
            "",
            "Receives unused backed tokens after migration",
            "",
            ""
        );
        return ModuleEncodeSchema("token", 1, p);
    }
}
