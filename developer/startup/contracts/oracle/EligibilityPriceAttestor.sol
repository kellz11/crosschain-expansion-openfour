// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Single trusted signer reference. This is not a decentralized oracle.
contract EligibilityPriceAttestor is EIP712 {
    struct Observation {
        address token;
        bytes32 identity;
        uint256 tokenUsd;
        uint256 bnbUsd;
        uint256 marketCapUsd;
        uint256 marketAge;
        uint256 observedAt;
        uint256 expiresAt;
        uint256 nonce;
    }
    bytes32 public constant TYPEHASH =
        keccak256(
            "Observation(address token,bytes32 identity,uint256 tokenUsd,uint256 bnbUsd,uint256 marketCapUsd,uint256 marketAge,uint256 observedAt,uint256 expiresAt,uint256 nonce)"
        );
    address public immutable signer;
    uint256 public immutable minAge;
    uint256 public immutable minCap;
    uint256 public immutable maxAge;
    mapping(address => mapping(uint256 => bool)) public used;
    event Consumed(address indexed token, uint256 indexed nonce, uint256 p0);
    constructor(
        address signer_,
        uint256 minAge_,
        uint256 minCap_,
        uint256 maxAge_
    ) EIP712("ExpansionPrice", "1") {
        require(signer_ != address(0) && maxAge_ > 0, "Oracle: config");
        signer = signer_;
        minAge = minAge_;
        minCap = minCap_;
        maxAge = maxAge_;
    }
    function consume(
        Observation calldata o,
        bytes calldata signature,
        bytes32 identity,
        uint256 p0
    ) external {
        require(msg.sender == o.token && o.identity == identity, "Oracle: domain");
        require(!used[o.token][o.nonce], "Oracle: replay");
        require(o.observedAt <= block.timestamp && block.timestamp - o.observedAt <= maxAge, "Oracle: stale");
        require(o.expiresAt >= block.timestamp && o.expiresAt <= o.observedAt + maxAge, "Oracle: expired");
        require(o.marketAge > minAge && o.marketCapUsd > minCap, "Oracle: ineligible");
        require(
            o.tokenUsd > 0 && o.bnbUsd > 0 && Math.mulDiv(o.tokenUsd, 1e18, o.bnbUsd) == p0,
            "Oracle: price"
        );
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(TYPEHASH, o)));
        require(ECDSA.recover(digest, signature) == signer, "Oracle: signer");
        used[o.token][o.nonce] = true;
        emit Consumed(o.token, o.nonce, p0);
    }
}
