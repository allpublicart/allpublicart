pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/token/MintableToken.sol";

/**
 * @title All Public Art Token contract - ERC20 compatible token contract.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtToken is MintableToken {
    string public constant name = "All Public Art";
    string public constant symbol = "APA";
    uint8 public constant decimals = 18;
    uint256 public maxSupply = 1000000000e18;
    uint256 public companyAllocation = 10000000e18; // Ask Graham whether there is company allocation. Used 10 % of total token supply for now.

    function AllPublicArtToken(address company) {
        // allocate tokens for company
        mint(company, companyAllocation);
    }

    function mint(address _to, uint256 _amount) onlyOwner canMint returns (bool) {
        assert(totalSupply <= maxSupply);
        super.mint(_to, _amount);
    }
}
