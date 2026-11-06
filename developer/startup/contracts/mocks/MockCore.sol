// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
// TEST HARNESS ONLY. Not Four.Meme Core, Registry or a production launchpad.
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {StandardTokenModule} from "../../vendor/openfour/contracts/modules/token/StandardTokenModule.sol";
import {StandardVault} from "../../vendor/openfour/contracts/modules/vault/StandardVault.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {ExpansionCurveModule} from "../modules/ExpansionCurveModule.sol";
import {ExpansionMigrateModule} from "../modules/ExpansionMigrateModule.sol";
import {ExpansionPresetValidator} from "../validators/ExpansionPresetValidator.sol";
import {MockSimpleTradeModule} from "./MockSimpleTradeModule.sol";
contract MockCore is ReentrancyGuard {
    address public immutable wrappedNative;
    struct Market {
        address vault;
        address curve;
        address migrate;
        address trade;
    }
    mapping(address => Market) public markets;
    event Created(address token, address vault, address curve, address migrate, address trade);
    constructor(address quote) {
        wrappedNative = quote;
    }
    function create(
        address[6] calldata impl,
        address validator,
        OpenFourTypes.TokenInitParams calldata p
    ) external returns (address token) {
        ExpansionPresetValidator(validator).validate(1, p);
        token = Clones.clone(impl[0]);
        Market memory m = Market(
            Clones.clone(impl[2]),
            Clones.clone(impl[3]),
            Clones.clone(impl[5]),
            Clones.clone(impl[4])
        );
        address tm = Clones.clone(impl[1]);
        OpenFourTypes.TokenCreateParams memory tp = OpenFourTypes.TokenCreateParams(
            1,
            p.name,
            p.symbol,
            p.maxSupply,
            p.saleAmount,
            p.raiseAmount,
            p.quoteAsset,
            p.tokenUri,
            p.tokenParams,
            p.tokenSalt
        );
        StandardTokenModule(tm).createToken(
            msg.sender,
            token,
            m.vault,
            m.curve,
            m.trade,
            m.migrate,
            address(0),
            tp,
            "0.1.0",
            "0.1.0"
        );
        StandardVault(payable(m.vault)).init(
            token,
            address(this),
            msg.sender,
            m.migrate,
            tp,
            p.vaultParams,
            "0.1.0"
        );
        ExpansionCurveModule(m.curve).init(token, address(this), tp, p.curveParams, "0.1.0");
        MockSimpleTradeModule(m.trade).init(token, address(this), p.tradeParams, "0.1.0");
        ExpansionMigrateModule(m.migrate).init(token, address(this), address(0), p.migrateParams, "0.1.0");
        markets[token] = m;
        StandardVault(payable(m.vault)).setPhase(OpenFourTypes.Phase.Trading);
        emit Created(token, m.vault, m.curve, m.migrate, m.trade);
    }
    function trade(
        address token,
        uint256 amount,
        bool buy,
        uint256 limit,
        uint256 deadline
    ) external nonReentrant {
        require(block.timestamp <= deadline, "MockCore: deadline");
        Market memory m = markets[token];
        StandardVault v = StandardVault(payable(m.vault));
        require(v.phase() == OpenFourTypes.Phase.Trading, "MockCore: phase");
        OpenFourTypes.CurveResult memory r = ExpansionCurveModule(m.curve).evaluate(
            OpenFourTypes.CurveContext(
                token,
                msg.sender,
                amount,
                buy,
                v.remainingForSale(),
                v.totalRaised(),
                block.timestamp,
                ""
            )
        );
        require(r.executable && (buy ? r.quoteAmount <= limit : r.quoteAmount >= limit), "MockCore: quote");
        OpenFourTypes.TradeResult memory tr = MockSimpleTradeModule(m.trade).evaluate(
            OpenFourTypes.TradeContext(
                token,
                msg.sender,
                amount,
                buy,
                block.timestamp,
                block.number,
                v.remainingForSale(),
                v.totalRaised(),
                r.quoteAmount,
                ""
            )
        );
        require(tr.allowed, "MockCore: trade");
        OpenFourTypes.VaultTradeParams memory p = OpenFourTypes.VaultTradeParams(
            msg.sender,
            amount,
            r.quoteAmount,
            0,
            0,
            0,
            0
        );
        if (buy) {
            require(IERC20(wrappedNative).transferFrom(msg.sender, m.vault, r.quoteAmount));
            v.onBuy(p);
        } else {
            require(IERC20(token).transferFrom(msg.sender, m.vault, amount));
            v.onSell(p);
            v.transferQuote(msg.sender, r.quoteAmount);
        }
        if (v.isSoldOut()) v.setPhase(OpenFourTypes.Phase.SoldOut);
    }
    function graduate(address token) external nonReentrant {
        Market memory m = markets[token];
        StandardVault v = StandardVault(payable(m.vault));
        require(ExpansionMigrateModule(m.migrate).ready(), "MockCore: not ready");
        v.setPhase(OpenFourTypes.Phase.MigratePending);
        ExpansionMigrateModule(m.migrate).executeMigration(
            OpenFourTypes.MigrateHookContext(
                m.vault,
                token,
                wrappedNative,
                msg.sender,
                v.totalRaised(),
                v.remainingForSale(),
                block.timestamp
            ),
            "untrusted hint ignored"
        );
        v.setPhase(OpenFourTypes.Phase.Migrated);
    }
}
