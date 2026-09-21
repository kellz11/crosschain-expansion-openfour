// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
/// @notice Trusted source admission. Entries cannot be replaced; enrollment requires source custody verification.
contract SourceRegistry {
    address public immutable registrar;
    mapping(bytes32 => bytes32) public canonicalPeer;
    event SourceEnrolled(
        uint32 indexed eid,
        bytes32 indexed mint,
        bytes32 indexed peer,
        bytes32 evidenceHash
    );
    constructor(address registrar_) {
        require(registrar_ != address(0));
        registrar = registrar_;
    }
    function enroll(uint32 eid, bytes32 mint, bytes32 peer, bytes32 evidenceHash) external {
        require(
            msg.sender == registrar &&
                eid > 0 &&
                mint != bytes32(0) &&
                peer != bytes32(0) &&
                evidenceHash != bytes32(0),
            "Source: admission"
        );
        bytes32 key = keccak256(abi.encode(eid, mint));
        require(canonicalPeer[key] == bytes32(0), "Source: already enrolled");
        canonicalPeer[key] = peer;
        emit SourceEnrolled(eid, mint, peer, evidenceHash);
    }
    function approved(uint32 eid, bytes32 mint, bytes32 peer) external view returns (bool) {
        return peer != bytes32(0) && canonicalPeer[keccak256(abi.encode(eid, mint))] == peer;
    }
}
