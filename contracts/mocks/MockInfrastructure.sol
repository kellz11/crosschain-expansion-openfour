// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
// ALL CONTRACTS IN THIS FILE ARE TEST DOUBLES, NOT DEPLOYMENT TARGETS.
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {
    MessagingParams,
    MessagingFee,
    MessagingReceipt
} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
interface IReceiver {
    function lzReceive(Origin calldata, bytes32, bytes calldata, address, bytes calldata) external payable;
}
contract MockEndpoint {
    uint64 public nonce;
    mapping(bytes32 => bool) public used;
    bytes public lastMessage;
    uint32 public lastDestination;
    function setDelegate(address) external {}
    function sendCompose(address, bytes32, uint16, bytes calldata) external {}
    function quote(MessagingParams calldata, address) external pure returns (MessagingFee memory) {
        return MessagingFee(0, 0);
    }
    function send(MessagingParams calldata p, address) external payable returns (MessagingReceipt memory) {
        lastMessage = p.message;
        lastDestination = p.dstEid;
        return
            MessagingReceipt(
                keccak256(abi.encode(++nonce, msg.sender, p.message)),
                nonce,
                MessagingFee(0, 0)
            );
    }
    function deliver(address receiver, Origin calldata o, bytes32 guid, bytes calldata message) external {
        require(!used[guid], "MockEndpoint: replay");
        used[guid] = true;
        IReceiver(receiver).lzReceive(o, guid, message, address(this), "");
    }
}
contract MockQuote is ERC20 {
    constructor() ERC20("Mock wrapped BNB", "mWBNB") {}
    function mint(address to, uint256 n) external {
        _mint(to, n);
    }
}
contract MockPair is ERC20 {
    constructor() ERC20("Mock PCS LP", "mLP") {}
    function mint(address to, uint256 n) external {
        _mint(to, n);
    }
    // Test-only outgoing pool leg; this mock does not implement AMM pricing or invariant checks.
    function transferAsset(address token, address to, uint256 amount) external {
        require(IERC20(token).transfer(to, amount));
    }
}
contract MockV2Router {
    mapping(address => mapping(address => address)) public getPair;
    bool public fail;
    function setFail(bool b) external {
        fail = b;
    }
    function factory() external view returns (address) {
        return address(this);
    }
    function addLiquidity(
        address t,
        address q,
        uint256 a,
        uint256 b,
        uint256 minA,
        uint256 minB,
        address lp,
        uint256 deadline
    ) external returns (uint256, uint256, uint256) {
        require(
            !fail && deadline >= block.timestamp && a >= minA && b >= minB && getPair[t][q] == address(0),
            "MockRouter: fail"
        );
        address pair = address(new MockPair());
        getPair[t][q] = pair;
        getPair[q][t] = pair;
        require(IERC20(t).transferFrom(msg.sender, pair, a));
        require(IERC20(q).transferFrom(msg.sender, pair, b));
        MockPair(pair).mint(lp, 1000);
        return (a, b, 1000);
    }
}
