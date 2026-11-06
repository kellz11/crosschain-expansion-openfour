// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOpenFourMigrateModule} from "../../vendor/openfour/contracts/interfaces/IOpenFourMigrateModule.sol";
import {IOpenFourModuleSchema} from "../../vendor/openfour/contracts/interfaces/IOpenFourModuleSchema.sol";
import {IOpenFourVault} from "../../vendor/openfour/contracts/interfaces/IOpenFourVault.sol";
import {IPancakeV2MigrationAdapter} from "../../vendor/openfour/contracts/interfaces/IPancakeV2MigrationAdapter.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";
import {
    OpenFourTypes,
    ModuleEncodeSchema,
    ParamDescriptor
} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {ExpansionTypes} from "../interfaces/ExpansionTypes.sol";
import {ExpansionToken} from "../token/ExpansionToken.sol";
import {ExpansionCurveModule} from "./ExpansionCurveModule.sol";
import {InitializationAuth} from "../interfaces/InitializationAuth.sol";
import {IOpenFourCore} from "../../vendor/openfour/contracts/interfaces/IOpenFourCore.sol";
interface IPoolPreparation {
    function preparePool(address token, address quote) external returns (address);
}

contract ExpansionMigrateModule is Initializable, IOpenFourMigrateModule, IOpenFourModuleSchema {
    address public boundToken;
    address public fourCore;
    address public feeRouter;
    ExpansionTypes.MigrationConfig public config;
    bool public executed;
    address public pool;
    bytes private raw;
    string private version;
    event ExpansionMigrated(
        address indexed token,
        address indexed pool,
        uint256 realQuote,
        uint256 liquidityTokens,
        uint256 returnedTokens
    );
    constructor() {
        _disableInitializers();
    }
    function init(
        address token,
        address core,
        address feeRouter_,
        bytes calldata params,
        string calldata v
    ) external initializer {
        InitializationAuth.check(core);
        require(
            token != address(0) && OpenFourToken(token).migrateModule() == address(this),
            "Migrate: binding"
        );
        config = abi.decode(params, (ExpansionTypes.MigrationConfig));
        require(config.adapter.code.length > 0 && config.lpRecipient != address(0), "Migrate: config");
        boundToken = token;
        fourCore = core;
        feeRouter = feeRouter_;
        raw = params;
        version = v;
        pool = IPoolPreparation(config.adapter).preparePool(token, IOpenFourCore(core).wrappedNative());
        OpenFourToken(token).setMigratedPool(pool, true);
    }
    function ready() public view returns (bool) {
        if (executed || !ExpansionToken(boundToken).active()) return false;
        IOpenFourVault v = IOpenFourVault(OpenFourToken(boundToken).vault());
        ExpansionCurveModule c = ExpansionCurveModule(OpenFourToken(boundToken).curveModule());
        uint256 rem = v.remainingForSale();
        return
            rem <= 1e18 &&
            rem <= c.saleCap() &&
            v.totalRaised() == c.reserveAt(c.saleCap() - rem) &&
            v.totalRaised() > 0;
    }
    function evaluate(
        OpenFourTypes.MigrateContext calldata c
    ) external view returns (OpenFourTypes.MigrateResult memory) {
        require(c.token == boundToken, "Migrate: token");
        return OpenFourTypes.MigrateResult(ready(), "", ready() ? "" : "Migrate: not ready");
    }
    function executeMigration(
        OpenFourTypes.MigrateHookContext calldata ctx,
        bytes calldata
    ) external returns (uint8, bytes memory) {
        require(
            msg.sender == fourCore && ctx.token == boundToken && ready(),
            "Migrate: permission or readiness"
        );
        IOpenFourVault v = IOpenFourVault(OpenFourToken(boundToken).vault());
        require(
            ctx.vault == address(v) &&
                ctx.quoteAsset == v.quoteAsset() &&
                v.phase() == OpenFourTypes.Phase.MigratePending,
            "Migrate: context"
        );
        require(
            ctx.totalRaised == v.totalRaised() && ctx.remainingForSale == v.remainingForSale(),
            "Migrate: accounting"
        );
        ExpansionCurveModule c = ExpansionCurveModule(OpenFourToken(boundToken).curveModule());
        uint256 b = v.totalRaised();
        uint256 sold = c.saleCap() - v.remainingForSale();
        uint256 t = c.liquidityTokens(sold);
        uint256 balance = IERC20(boundToken).balanceOf(address(v));
        require(
            t > 0 && t <= OpenFourToken(boundToken).maxSupply() - sold && t <= balance,
            "Migrate: inventory"
        );
        require(IERC20(v.quoteAsset()).balanceOf(address(v)) >= b, "Migrate: real reserve");
        executed = true;
        // Pre-fund adapter: the standard vault only permits its bound migration module to transfer.
        v.transferQuoteForMigration(config.adapter, b);
        v.transferTokenForMigration(config.adapter, t);
        pool = IPancakeV2MigrationAdapter(config.adapter).executeLiquidity(ctx, b, t, config.lpRecipient);
        require(pool != address(0), "Migrate: pool missing");
        OpenFourToken(boundToken).setMigratedPool(pool, true);
        uint256 surplus = balance - t;
        if (surplus > 0) v.transferTokenForMigration(ExpansionToken(boundToken).beneficiary(), surplus);
        emit ExpansionMigrated(boundToken, pool, b, t, surplus);
        return (1, abi.encode(pool));
    }
    function descriptor() external view returns (bytes8, string memory, string memory) {
        string memory tag = "module.migrate.bnb_expansion_v2";
        return (bytes8(keccak256(bytes(tag))), tag, version);
    }
    function getInitParams() external view returns (bytes memory) {
        return raw;
    }
    function moduleEncodeSchema() external pure returns (ModuleEncodeSchema memory) {
        ParamDescriptor[] memory p = new ParamDescriptor[](2);
        p[0] = ParamDescriptor(
            "adapter",
            "address",
            0,
            false,
            "Approved V2 adapter",
            "",
            "Immutable per launch",
            "",
            ""
        );
        p[1] = ParamDescriptor(
            "lpRecipient",
            "address",
            0,
            false,
            "LP lock or burn recipient",
            "",
            "Preset policy",
            "",
            ""
        );
        return ModuleEncodeSchema("migrate", 1, p);
    }
}
