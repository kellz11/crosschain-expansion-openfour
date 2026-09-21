// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";
import {IOpenFourCurveModule} from "../../vendor/openfour/contracts/interfaces/IOpenFourCurveModule.sol";
import {ExpansionTypes, IExpansionBridge} from "../interfaces/ExpansionTypes.sol";
import {EligibilityPriceAttestor} from "../oracle/EligibilityPriceAttestor.sol";
import {IMintableBurnable} from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
interface IBridgeFactory {
    function create(ExpansionTypes.BridgeConfig calldata c) external returns (address);
}

contract ExpansionToken is OpenFourToken, IMintableBurnable {
    address public immutable bridgeFactory;
    EligibilityPriceAttestor public immutable attestor;
    address public bridge;
    address public beneficiary;
    bytes32 public identity;
    bool public active;
    event Activated(bytes32 indexed identity, uint256 p0);
    constructor(address factory_, address attestor_) {
        require(factory_.code.length > 0 && attestor_.code.length > 0, "Token: config");
        bridgeFactory = factory_;
        attestor = EligibilityPriceAttestor(attestor_);
    }
    function initialize(InitArgs calldata c) external override initializer {
        require(msg.sender == c.tokenModule, "Token: initializer");
        __OpenFourToken_init(c);
        ExpansionTypes.BridgeConfig memory b = abi.decode(c.tokenParams, (ExpansionTypes.BridgeConfig));
        require(b.beneficiary != address(0) && b.sourceMint != bytes32(0), "Token: identity");
        beneficiary = b.beneficiary;
        identity = keccak256(abi.encode(b, c.maxSupply));
        bridge = IBridgeFactory(bridgeFactory).create(b);
    }
    function _mintInitialSupply(address, uint256) internal pure override {}
    function _descriptorTag() internal pure override returns (string memory) {
        return "token.crosschain_expansion";
    }
    function activate(EligibilityPriceAttestor.Observation calldata o, bytes calldata signature) external {
        require(!active && IExpansionBridge(bridge).funded(), "Token: funding");
        uint256 p0 = IOpenFourCurveModule(curveModule).getInitialPrice();
        attestor.consume(o, signature, identity, p0);
        active = true;
        emit Activated(identity, p0);
    }
    function mint(address to, uint256 amount) external returns (bool) {
        require(msg.sender == bridge, "Token: only bridge");
        _mint(to, amount);
        return true;
    }
    function burn(address from, uint256 amount) external returns (bool) {
        require(msg.sender == bridge, "Token: only bridge");
        _burn(from, amount);
        return true;
    }
}
