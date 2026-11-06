// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";

/// @dev Tests that callers cannot overwrite a used module's metadata via a different token target.
contract MockTokenModuleHarness {
    address public lastModule;
    function cloneModule(address implementation) external {
        lastModule = Clones.clone(implementation);
    }
    function initialize(OpenFourToken.InitArgs calldata) external pure {}
}
