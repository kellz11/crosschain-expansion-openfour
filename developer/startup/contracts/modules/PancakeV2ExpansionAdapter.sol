// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {IPancakeV2MigrationAdapter} from "../../vendor/openfour/contracts/interfaces/IPancakeV2MigrationAdapter.sol";
import {BnbEnvironment} from "../interfaces/BnbEnvironment.sol";
interface IV2Router {
    function factory() external view returns (address);
}
interface IV2Factory {
    function getPair(address, address) external view returns (address);
    function createPair(address, address) external returns (address);
}
interface IV2Pair is IERC20 {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function getReserves() external view returns (uint112, uint112, uint32);
    function mint(address) external returns (uint256);
}
/// @notice OpenFour-style direct pair funding; the pair is registered before any bootstrap inventory exists.
contract PancakeV2ExpansionAdapter is IPancakeV2MigrationAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IV2Router public immutable router;
    mapping(address => address) public preparedPool;
    mapping(address => address) public preparedQuote;
    event PoolPrepared(address indexed token, address indexed pool);
    constructor(address router_) {
        BnbEnvironment.check();
        require(router_.code.length > 0, "PCS: router");
        router = IV2Router(router_);
        require(router.factory().code.length > 0, "PCS: factory");
    }
    function preparePool(address token, address quote) external nonReentrant returns (address pair) {
        require(msg.sender == OpenFourToken(token).migrateModule(), "PCS: caller");
        require(preparedPool[token] == address(0) && quote.code.length > 0, "PCS: prepared");
        require(IERC20(token).totalSupply() == 0, "PCS: prepare before funding");
        IV2Factory factory = IV2Factory(router.factory());
        pair = factory.getPair(token, quote);
        if (pair == address(0)) pair = factory.createPair(token, quote);
        require(
            IERC20(pair).totalSupply() == 0 && IERC20(token).balanceOf(pair) == 0,
            "PCS: nonempty token pool"
        );
        preparedPool[token] = pair;
        preparedQuote[token] = quote;
        emit PoolPrepared(token, pair);
    }
    function executeLiquidity(
        OpenFourTypes.MigrateHookContext calldata c,
        uint256 b,
        uint256 t,
        address lp
    ) external nonReentrant returns (address pair) {
        OpenFourToken token = OpenFourToken(c.token);
        require(msg.sender == token.migrateModule() && c.vault == token.vault(), "PCS: caller");
        require(token.tokenPhase() == OpenFourTypes.Phase.MigratePending, "PCS: phase");
        require(b > 0 && t > 0 && lp != address(0), "PCS: amounts");
        pair = preparedPool[c.token];
        require(pair != address(0) && preparedQuote[c.token] == c.quoteAsset, "PCS: unprepared");
        require(IV2Factory(router.factory()).getPair(c.token, c.quoteAsset) == pair, "PCS: pair");
        IV2Pair p = IV2Pair(pair);
        require(p.totalSupply() == 0 && IERC20(c.token).balanceOf(pair) == 0, "PCS: nonempty token pool");
        bool tokenIs0 = p.token0() == c.token;
        require(
            (tokenIs0 ? p.token1() : p.token0()) == c.quoteAsset && (tokenIs0 || p.token1() == c.token),
            "PCS: assets"
        );
        (uint112 r0, uint112 r1, ) = p.getReserves();
        require((tokenIs0 ? r0 : r1) == 0, "PCS: token reserve");
        uint256 donatedQuote = IERC20(c.quoteAsset).balanceOf(pair);
        require(donatedQuote >= (tokenIs0 ? r1 : r0), "PCS: quote reserve");
        require(t <= type(uint112).max && b <= type(uint112).max - donatedQuote, "PCS: reserve bounds");
        uint256 tb = IERC20(c.token).balanceOf(address(this));
        uint256 qb = IERC20(c.quoteAsset).balanceOf(address(this));
        require(tb >= t && qb >= b, "PCS: funding");
        uint256 lpBefore = p.balanceOf(lp);
        IERC20(c.token).safeTransfer(pair, t);
        IERC20(c.quoteAsset).safeTransfer(pair, b);
        uint256 liquidity = p.mint(lp);
        require(liquidity > 0 && p.balanceOf(lp) == lpBefore + liquidity, "PCS: LP custody");
        require(
            IERC20(c.token).balanceOf(address(this)) == tb - t &&
                IERC20(c.quoteAsset).balanceOf(address(this)) == qb - b,
            "PCS: balance delta"
        );
        require(
            IERC20(c.token).balanceOf(pair) == t && IERC20(c.quoteAsset).balanceOf(pair) == donatedQuote + b,
            "PCS: pool balances"
        );
        (r0, r1, ) = p.getReserves();
        require(
            uint256(tokenIs0 ? r0 : r1) == t && uint256(tokenIs0 ? r1 : r0) == donatedQuote + b,
            "PCS: pool reserves"
        );
        // Quote-only donations accrue to the locked LP and can only improve the opening quote/token ratio.
    }
    function executeBuybackBurn(OpenFourTypes.MigrateHookContext calldata, uint256, address) external pure {
        revert("PCS: unsupported");
    }
}
