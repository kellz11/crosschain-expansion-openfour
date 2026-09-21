// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OpenFourToken} from "../../vendor/openfour/contracts/token/OpenFourToken.sol";
import {OpenFourTypes} from "../../vendor/openfour/contracts/libraries/OpenFourTypes.sol";
import {IPancakeV2MigrationAdapter} from "../../vendor/openfour/contracts/interfaces/IPancakeV2MigrationAdapter.sol";
interface IV2Router {
    function factory() external view returns (address);
    function addLiquidity(
        address,
        address,
        uint256,
        uint256,
        uint256,
        uint256,
        address,
        uint256
    ) external returns (uint256, uint256, uint256);
}
interface IV2Factory {
    function getPair(address, address) external view returns (address);
}
/// @notice V2 fallback adapter implementing OpenFour's public migration interface.
contract PancakeV2ExpansionAdapter is IPancakeV2MigrationAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IV2Router public immutable router;
    constructor(address router_) {
        require(router_.code.length > 0, "PCS: router");
        router = IV2Router(router_);
    }
    function executeLiquidity(
        OpenFourTypes.MigrateHookContext calldata c,
        uint256 b,
        uint256 t,
        address lp
    ) external nonReentrant returns (address pair) {
        require(
            msg.sender == OpenFourToken(c.token).migrateModule() && c.vault == OpenFourToken(c.token).vault(),
            "PCS: caller"
        );
        require(b > 0 && t > 0 && lp != address(0), "PCS: amounts");
        // Fresh-pair-only policy prevents pre-seeded reserve manipulation. A front-run can cause a safe DoS.
        require(
            IV2Factory(router.factory()).getPair(c.token, c.quoteAsset) == address(0),
            "PCS: existing pair"
        );
        uint256 tb = IERC20(c.token).balanceOf(address(this));
        uint256 qb = IERC20(c.quoteAsset).balanceOf(address(this));
        require(tb >= t && qb >= b, "PCS: funding");
        IERC20(c.token).forceApprove(address(router), t);
        IERC20(c.quoteAsset).forceApprove(address(router), b);
        (uint256 usedT, uint256 usedB, uint256 liquidity) = router.addLiquidity(
            c.token,
            c.quoteAsset,
            t,
            b,
            t,
            b,
            lp,
            block.timestamp
        );
        require(usedT == t && usedB == b && liquidity > 0, "PCS: consumption");
        IERC20(c.token).forceApprove(address(router), 0);
        IERC20(c.quoteAsset).forceApprove(address(router), 0);
        require(
            IERC20(c.token).balanceOf(address(this)) == tb - t &&
                IERC20(c.quoteAsset).balanceOf(address(this)) == qb - b,
            "PCS: balance delta"
        );
        pair = IV2Factory(router.factory()).getPair(c.token, c.quoteAsset);
        require(pair != address(0) && IERC20(pair).balanceOf(lp) == liquidity, "PCS: LP custody");
    }
    function executeBuybackBurn(OpenFourTypes.MigrateHookContext calldata, uint256, address) external pure {
        revert("PCS: unsupported");
    }
}
