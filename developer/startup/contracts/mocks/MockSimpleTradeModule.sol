// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
// TEST DOUBLE: production SimpleTradeModule is documented but not published.
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {IOpenFourTradeModule} from "../../vendor/openfour/contracts/interfaces/IOpenFourTradeModule.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
contract MockSimpleTradeModule is Initializable, IOpenFourTradeModule {
    address public token;
    string private version;
    constructor() {
        _disableInitializers();
    }
    function init(address t, address core, bytes calldata p, string calldata v) external initializer {
        require(msg.sender == core && p.length == 0);
        token = t;
        version = v;
    }
    function evaluate(
        OpenFourTypes.TradeContext calldata c
    ) external view returns (OpenFourTypes.TradeResult memory) {
        require(c.token == token);
        return OpenFourTypes.TradeResult(true, 0, type(uint256).max, new OpenFourTypes.FeeTier[](0), "");
    }
    function descriptor() external view returns (bytes8, string memory, string memory) {
        string memory t = "module.trade.simple";
        return (bytes8(keccak256(bytes(t))), t, version);
    }
    function getInitParams() external pure returns (bytes memory) {
        return "";
    }
}
