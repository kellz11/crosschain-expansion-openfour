// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {IOpenFourCore} from "../../vendor/openfour/contracts/interfaces/IOpenFourCore.sol";
library InitializationAuth {
    function check(address core) internal view {
        require(core.code.length > 0, "Expansion: core");
        // OpenFour's create deployer initializes the module instances; runtime writes remain Core-only.
        require(
            msg.sender == core || msg.sender == IOpenFourCore(core).registry().createDeployer(),
            "Expansion: initializer"
        );
    }
}
