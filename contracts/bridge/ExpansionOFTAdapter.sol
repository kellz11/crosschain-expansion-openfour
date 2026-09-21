// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {MintBurnOFTAdapter} from "@layerzerolabs/oft-evm/contracts/MintBurnOFTAdapter.sol";
import {IMintableBurnable} from "@layerzerolabs/oft-evm/contracts/interfaces/IMintableBurnable.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OFTMsgCodec} from "@layerzerolabs/oft-evm/contracts/libs/OFTMsgCodec.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {ExpansionTypes, IExpansionMigration} from "../interfaces/ExpansionTypes.sol";
import {SourceRegistry} from "./SourceRegistry.sol";

contract ExpansionOFTAdapter is MintBurnOFTAdapter {
    using OFTMsgCodec for bytes;
    uint32 public immutable sourceEid;
    bytes32 public immutable depositor;
    bytes32 public immutable depositId;
    address public immutable vault;
    uint256 public immutable bootstrapAmount;
    bool public funded;
    bool public paused;
    mapping(bytes32 => bool) public delivered;
    event BootstrapCredited(bytes32 indexed guid, uint256 amount);
    event BridgePaused(bool paused);

    constructor(
        address token_,
        address endpoint_,
        address delegate_,
        ExpansionTypes.BridgeConfig memory c
    ) MintBurnOFTAdapter(token_, IMintableBurnable(token_), endpoint_, delegate_) {
        sourceEid = c.sourceEid;
        depositor = c.depositor;
        depositId = c.depositId;
        vault = OpenFourToken(token_).vault();
        bootstrapAmount = OpenFourToken(token_).maxSupply();
        require(
            c.sourceEid > 0 &&
                c.sourcePeer != bytes32(0) &&
                c.depositor != bytes32(0) &&
                c.depositId != bytes32(0),
            "Bridge: config"
        );
        require(
            bootstrapAmount > 0 && bootstrapAmount % 1e12 == 0 && bootstrapAmount / 1e12 <= type(uint64).max,
            "Bridge: precision"
        );
        _setPeer(c.sourceEid, c.sourcePeer);
        _transferOwnership(delegate_);
    }
    function setPeer(uint32, bytes32) public pure override {
        revert("Bridge: immutable peer");
    }
    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit BridgePaused(value);
    }
    function publicMode() public view returns (bool) {
        OpenFourToken t = OpenFourToken(token());
        return
            funded &&
            t.tokenPhase() == OpenFourTypes.Phase.Migrated &&
            IExpansionMigration(t.migrateModule()).executed();
    }
    function _debit(
        address from,
        uint256 amount,
        uint256 minAmount,
        uint32 dst
    ) internal override returns (uint256 sent, uint256 received) {
        require(!paused && publicMode() && dst == sourceEid, "Bridge: outbound closed");
        return super._debit(from, amount, minAmount, dst);
    }
    function _lzReceive(
        Origin calldata origin,
        bytes32 guid,
        bytes calldata message,
        address executor,
        bytes calldata extra
    ) internal override {
        require(!paused && !delivered[guid] && origin.srcEid == sourceEid, "Bridge: delivery");
        if (!funded) {
            // Solana's OFT encoder prepends the authenticated signer to compose bytes.
            require(
                message.length == 104 &&
                    bytes32(message[40:72]) == depositor &&
                    bytes32(message[72:104]) == depositId,
                "Bridge: bootstrap sender"
            );
            require(
                message.sendTo() == bytes32(uint256(uint160(vault))) &&
                    uint256(message.amountSD()) * 1e12 == bootstrapAmount,
                "Bridge: bootstrap cap"
            );
            funded = true;
            delivered[guid] = true;
            // Consume bootstrap metadata locally. It is not an application compose callback.
            _credit(vault, bootstrapAmount, origin.srcEid);
            emit OFTReceived(guid, origin.srcEid, vault, bootstrapAmount);
            emit BootstrapCredited(guid, bootstrapAmount);
        } else {
            require(publicMode(), "Bridge: inbound closed");
            require(message.length == 40, "Bridge: public compose disabled");
            require(
                uint256(message.sendTo()) <= type(uint160).max && message.sendTo() != bytes32(0),
                "Bridge: recipient"
            );
            delivered[guid] = true;
            super._lzReceive(origin, guid, message, executor, extra);
        }
    }
}

/// @notice Dedicated non-upgradeable per-launch adapter deployment. No shared custody.
contract ExpansionBridgeFactory {
    address public immutable endpoint;
    address public immutable delegate;
    SourceRegistry public immutable sources;
    event BridgeCreated(address indexed token, address indexed bridge);
    constructor(address endpoint_, address delegate_, address sources_) {
        require(endpoint_.code.length > 0 && delegate_ != address(0), "Factory: config");
        require(sources_.code.length > 0, "Factory: source registry");
        endpoint = endpoint_;
        delegate = delegate_;
        sources = SourceRegistry(sources_);
    }
    function create(ExpansionTypes.BridgeConfig calldata c) external returns (address bridge) {
        require(sources.approved(c.sourceEid, c.sourceMint, c.sourcePeer), "Factory: unverified source");
        bridge = address(new ExpansionOFTAdapter(msg.sender, endpoint, delegate, c));
        emit BridgeCreated(msg.sender, bridge);
    }
}
