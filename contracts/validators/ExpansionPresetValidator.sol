// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOpenFourPresetValidator} from "../../vendor/openfour/contracts/interfaces/IOpenFourPresetValidator.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {ExpansionTypes} from "../interfaces/ExpansionTypes.sol";

contract ExpansionPresetValidator is IOpenFourPresetValidator {
    uint256 public immutable preset;
    address public immutable quoteAsset;
    address public immutable migrationAdapter;
    address public immutable lpRecipient;
    constructor(uint256 preset_, address quote_, address adapter_, address lp_) {
        require(
            preset_ > 0 && quote_.code.length > 0 && adapter_.code.length > 0 && lp_ != address(0),
            "Validator: config"
        );
        preset = preset_;
        quoteAsset = quote_;
        migrationAdapter = adapter_;
        lpRecipient = lp_;
    }
    function validate(uint256 id, OpenFourTypes.TokenInitParams calldata p) external view {
        require(id == preset && p.quoteAsset == quoteAsset, "Validator: preset/quote");
        require(bytes(p.name).length > 0 && bytes(p.symbol).length > 0, "Validator: metadata");
        require(
            p.maxSupply > 0 && p.maxSupply / 1e12 <= type(uint64).max && p.maxSupply % 1e12 == 0,
            "Validator: decimals"
        );
        require(p.saleAmount > 1e18 && p.saleAmount < p.maxSupply, "Validator: inventory");
        require(
            p.vaultParams.length == 0 && p.tradeParams.length == 0 && p.customDataParams.length == 0,
            "Validator: unused params"
        );
        ExpansionTypes.BridgeConfig memory b = abi.decode(p.tokenParams, (ExpansionTypes.BridgeConfig));
        require(
            b.sourceEid > 0 &&
                b.sourcePeer != bytes32(0) &&
                b.sourceMint != bytes32(0) &&
                b.depositor != bytes32(0) &&
                b.depositId != bytes32(0) &&
                b.beneficiary != address(0),
            "Validator: identity"
        );
        ExpansionTypes.CurveConfig memory c = abi.decode(p.curveParams, (ExpansionTypes.CurveConfig));
        require(
            c.p0 > 0 && c.p0 <= 1e30 && c.virtualTokens >= 2 * p.saleAmount && c.virtualTokens <= 1e32,
            "Validator: curve"
        );
        uint256 vq = Math.mulDiv(c.p0, c.virtualTokens, 1e18, Math.Rounding.Up);
        uint256 raised = Math.mulDiv(vq, p.saleAmount, c.virtualTokens - p.saleAmount, Math.Rounding.Up);
        uint256 tlp = Math.mulDiv(raised, c.virtualTokens - p.saleAmount, vq + raised);
        require(
            raised == p.raiseAmount && tlp > 0 && tlp <= p.maxSupply - p.saleAmount,
            "Validator: migration solvency"
        );
        ExpansionTypes.MigrationConfig memory m = abi.decode(
            p.migrateParams,
            (ExpansionTypes.MigrationConfig)
        );
        require(m.adapter == migrationAdapter && m.lpRecipient == lpRecipient, "Validator: migration policy");
    }
}
