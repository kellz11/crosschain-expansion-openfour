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
    function eid() external pure returns (uint32) {
        return 40102;
    }
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
interface IMockFactory {
    function fail() external view returns (bool);
}
contract MockPair is ERC20 {
    address public immutable token0;
    address public immutable token1;
    address public immutable factory;
    uint112 private reserve0;
    uint112 private reserve1;
    constructor(address a, address b, address f) ERC20("Mock PCS LP", "mLP") {
        (token0, token1) = a < b ? (a, b) : (b, a);
        factory = f;
    }
    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, 0);
    }
    function sync() public {
        reserve0 = uint112(IERC20(token0).balanceOf(address(this)));
        reserve1 = uint112(IERC20(token1).balanceOf(address(this)));
    }
    function mint(address to) external returns (uint256) {
        require(!IMockFactory(factory).fail() && totalSupply() == 0, "MockPair: fail");
        require(
            IERC20(token0).balanceOf(address(this)) > reserve0 &&
                IERC20(token1).balanceOf(address(this)) > reserve1,
            "MockPair: no liquidity"
        );
        _mint(to, 1000);
        sync();
        return 1000;
    }
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
    function createPair(address t, address q) external returns (address pair) {
        require(getPair[t][q] == address(0), "MockFactory: exists");
        pair = address(new MockPair(t, q, address(this)));
        getPair[t][q] = pair;
        getPair[q][t] = pair;
    }
}
