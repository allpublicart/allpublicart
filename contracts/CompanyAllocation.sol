pragma solidity 0.4.18;

import './AllPublicArtToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title Company Allocation contract - tokens allocation for company
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract CompanyAllocation {
    using SafeMath for uint;
    address public owner;
    uint256 public unlockedAt;
    uint256 public canSelfDestruct;
    uint256 public tokensCreated;
    uint256 public allocatedTokens;
    uint256 public totalCompanyAllocation = 600000000e18;

    mapping (address => uint256) public companyAllocations;

    AllPublicArtToken public apa;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev constructor function that sets owner as well as unlock and selfdestruct timestamps
     * for the CompanyAllocation contract
     */
    function CompanyAllocation() public {
        owner = msg.sender;

        unlockedAt = now.add(90 days);
        canSelfDestruct = now.add(365 days);
    }

    /**
     * @dev Adds founders' token allocation
     * @param foundersAddress Address of a founder
     * @param allocationValue Number of tokens allocated to a founder
     * @return true if address is correctly added
     */
    function addCompanyAllocation(address foundersAddress, uint256 allocationValue)
        external
        onlyOwner
        returns(bool)
    {
        assert(companyAllocations[foundersAddress] == 0); // can only add once.

        allocatedTokens = allocatedTokens.add(allocationValue);
        require(allocatedTokens <= totalCompanyAllocation);

        companyAllocations[foundersAddress] = allocationValue;
        return true;
    }

    /**
     * @dev Allow company to unlock allocated tokens by transferring them whitelisted addresses.
     * Need to be called by each address
     */
    function unlock() external {
        require(apa != address(0));
        assert(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensCreated == 0) {
            tokensCreated = apa.balanceOf(this);
        }

        uint256 transferAllocation = companyAllocations[msg.sender];
        companyAllocations[msg.sender] = 0;

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(apa.transfer(msg.sender, transferAllocation));
    }

    /**
     * @dev setToken set apa token address in this contract's context
     * @param token Token contract address for AllPublicArtToken
     */
    function setToken(address token) public onlyOwner {
        require(apa == address(0));
        apa = AllPublicArtToken(token);
    }

    /**
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() public onlyOwner {
        assert (now >= canSelfDestruct);
        uint256 balance = apa.balanceOf(this);

        if (balance > 0) {
            apa.transfer(owner, balance);
        }

        selfdestruct(owner);
    }
}
