pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/token/MintableToken.sol";
import "./CompanyAllocation.sol";

/**
 * @title All Public Art Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtToken is MintableToken {
    string public constant name = "All Public Art";
    string public constant symbol = "APA";
    uint8 public constant decimals = 18;

    uint256 public maxSupply = 1000000000e18;
    uint256 public companyAllocationFigure = 20000000e18; // 20 % of total token supply allocated to company.
    CompanyAllocation companyAllocation;

    function AllPublicArtToken() {
        // allocate tokens for company
        companyAllocation = new CompanyAllocation();
        mint(companyAllocation, companyAllocationFigure);
    }

    function mint(address _to, uint256 _amount) onlyOwner canMint returns (bool) {
        assert(totalSupply <= maxSupply);
        super.mint(_to, _amount);
    }
}
