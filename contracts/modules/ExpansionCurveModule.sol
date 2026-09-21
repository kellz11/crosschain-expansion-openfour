// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IOpenFourCurveModule} from "../../vendor/openfour/contracts/interfaces/IOpenFourCurveModule.sol";
import {IOpenFourModuleSchema} from "../../vendor/openfour/contracts/interfaces/IOpenFourModuleSchema.sol";
import {
    OpenFourTypes,
    ModuleEncodeSchema,
    ParamDescriptor
} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {ExpansionTypes, IExpansionToken} from "../interfaces/ExpansionTypes.sol";

contract ExpansionCurveModule is Initializable, IOpenFourCurveModule, IOpenFourModuleSchema {
    address public boundToken;
    address public fourCore;
    uint256 public saleCap;
    uint256 public virtualTokens;
    uint256 public virtualQuote;
    uint256 private p0;
    bytes private raw;
    string private version;
    constructor() {
        _disableInitializers();
    }
    function init(
        address token,
        address core,
        OpenFourTypes.TokenCreateParams calldata tp,
        bytes calldata params,
        string calldata v
    ) external initializer {
        require(msg.sender == core && core != address(0) && token != address(0), "Curve: init caller");
        ExpansionTypes.CurveConfig memory c = abi.decode(params, (ExpansionTypes.CurveConfig));
        require(
            c.p0 > 0 &&
                c.p0 <= 1e30 &&
                tp.saleAmount > 1e18 &&
                c.virtualTokens > tp.saleAmount &&
                c.virtualTokens <= 1e32,
            "Curve: bounds"
        );
        boundToken = token;
        fourCore = core;
        saleCap = tp.saleAmount;
        virtualTokens = c.virtualTokens;
        p0 = c.p0;
        virtualQuote = Math.mulDiv(c.p0, c.virtualTokens, 1e18, Math.Rounding.Up);
        raw = params;
        version = v;
    }
    function reserveAt(uint256 sold) public view returns (uint256) {
        require(sold <= saleCap, "Curve: sold bounds");
        return Math.mulDiv(virtualQuote, sold, virtualTokens - sold, Math.Rounding.Up);
    }
    function liquidityTokens(uint256 sold) public view returns (uint256) {
        uint256 b = reserveAt(sold);
        return Math.mulDiv(b, virtualTokens - sold, virtualQuote + b);
    }
    function _valid(address token, uint256 rem, uint256 raised) internal view returns (bool) {
        return
            token == boundToken &&
            rem <= saleCap &&
            IExpansionToken(boundToken).active() &&
            raised == reserveAt(saleCap - rem);
    }
    function _quote(bool buy, uint256 amount, uint256 rem) internal view returns (uint256) {
        uint256 sold = saleCap - rem;
        return buy ? reserveAt(sold + amount) - reserveAt(sold) : reserveAt(sold) - reserveAt(sold - amount);
    }
    function evaluate(
        OpenFourTypes.CurveContext calldata c
    ) external view returns (OpenFourTypes.CurveResult memory r) {
        if (
            !_valid(c.token, c.remainingForSale, c.totalRaised) ||
            c.amount == 0 ||
            c.amount > (c.isBuy ? c.remainingForSale : saleCap - c.remainingForSale)
        ) {
            return OpenFourTypes.CurveResult(false, 0, 0, "Curve: state or inventory");
        }
        uint256 q = _quote(c.isBuy, c.amount, c.remainingForSale);
        return
            OpenFourTypes.CurveResult(
                q > 0 && (c.isBuy || q <= c.totalRaised),
                q,
                c.amount,
                q == 0 ? "Curve: dust" : ""
            );
    }
    /// @notice Maximum token amount whose net quote does not exceed the budget (both directions).
    function evaluateReverse(
        address token,
        bool buy,
        uint256 budget,
        uint256 rem,
        uint256 raised,
        uint256
    ) external view returns (uint256 amount, uint256 quote) {
        if (!_valid(token, rem, raised) || budget == 0) return (0, 0);
        uint256 lo;
        uint256 hi = buy ? rem : saleCap - rem;
        while (lo < hi) {
            uint256 mid = lo + (hi - lo + 1) / 2;
            if (_quote(buy, mid, rem) <= budget) lo = mid;
            else hi = mid - 1;
        }
        quote = _quote(buy, lo, rem);
        return quote == 0 ? (uint256(0), uint256(0)) : (lo, quote);
    }
    function getInitialPrice() external view returns (uint256) {
        return p0;
    }
    function getLastPrice(address token, uint256 rem, uint256 raised) public view returns (uint256) {
        require(
            token == boundToken && rem <= saleCap && raised == reserveAt(saleCap - rem),
            "Curve: context"
        );
        return Math.mulDiv(virtualQuote + raised, 1e18, virtualTokens - saleCap + rem);
    }
    function getLiquiditySnapshot(
        address token,
        uint256 rem,
        uint256 raised
    ) external view returns (OpenFourTypes.CurveLiquiditySnapshot memory) {
        uint256 price = getLastPrice(token, rem, raised);
        return
            OpenFourTypes.CurveLiquiditySnapshot(
                true,
                virtualQuote,
                virtualTokens,
                virtualQuote + raised,
                virtualTokens - saleCap + rem,
                rem,
                raised,
                price
            );
    }
    function descriptor() external view returns (bytes8, string memory, string memory) {
        string memory tag = "module.curve.crosschain_expansion";
        return (bytes8(keccak256(bytes(tag))), tag, version);
    }
    function getInitParams() external view returns (bytes memory) {
        return raw;
    }
    function moduleEncodeSchema() external pure returns (ModuleEncodeSchema memory) {
        ParamDescriptor[] memory p = new ParamDescriptor[](2);
        p[0] = ParamDescriptor(
            "p0",
            "uint256",
            18,
            false,
            "Opening BNB per token",
            "",
            "Attested source valuation",
            "1",
            "1000000000000000000000000000000"
        );
        p[1] = ParamDescriptor(
            "virtualTokens",
            "uint256",
            18,
            false,
            "Virtual token depth",
            "",
            "Pricing only; greater than sale cap",
            "",
            "100000000000000000000000000000000"
        );
        return ModuleEncodeSchema("curve", 1, p);
    }
}
