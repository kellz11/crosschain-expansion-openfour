// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

library ExpansionTypes {
    struct BridgeConfig {
        uint32 sourceEid;
        bytes32 sourcePeer;
        bytes32 sourceMint;
        bytes32 depositor;
        bytes32 depositId;
        address beneficiary;
    }
    struct CurveConfig {
        uint256 p0;
        uint256 virtualTokens;
    }
    struct MigrationConfig {
        address adapter;
        address lpRecipient;
    }
}

interface IExpansionToken {
    function bridge() external view returns (address);
    function active() external view returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
interface IExpansionBridge {
    function funded() external view returns (bool);
    function publicMode() external view returns (bool);
}
interface IExpansionMigration {
    function executed() external view returns (bool);
}
