// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @notice BNB is the only destination. 31337 is reserved for local BSC-testnet forks/tests.
library BnbEnvironment {
    function check() internal view {
        require(block.chainid == 56 || block.chainid == 97 || block.chainid == 31337, "Expansion: BNB only");
    }
    function sourceEid() internal view returns (uint32) {
        check();
        return block.chainid == 56 ? 30168 : 40168;
    }
    function destinationEid() internal view returns (uint32) {
        check();
        return block.chainid == 56 ? 30102 : 40102;
    }
}
