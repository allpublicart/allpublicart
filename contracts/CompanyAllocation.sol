pragma solidity ^0.4.13;

import './AllPublicArtToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract CompanyAllocation {
    using SafeMath for uint;
    address public owner;
    uint256 public unlockedAt;
    uint256 public canSelfDestruct;
    uint256 public tokensCreated;
    uint256 public allocatedTokens;
    uint256 totalCompanyAllocation = 625000000e18;

    mapping (address => uint256) public companyAllocations;

    AllPublicArtToken apa;

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev constructor function that sets owner and token for the CompanyAllocation contract
     * @param _owner Contract owner
     * @param token Token contract address for AllPublicArtToken
     */
    function CompanyAllocation(address _owner, address token) {
        apa = AllPublicArtToken(token);
        unlockedAt = now.add(365 days);
        canSelfDestruct = now.add(600 days);
        owner = _owner;
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
     * @dev Allow company to unlock allocated tokens by transferring them whitelisted addresses. Need to be called by each address
     */
    function unlock() external {
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
     * @dev allow for selfdestruct possibility and sending funds to owner
     */
    function kill() onlyOwner() {
        assert (now >= canSelfDestruct);
        uint256 balance = apa.balanceOf(this);

        if (balance > 0) {
 		    apa.transfer(owner, balance);
 		}

        selfdestruct(owner);
    }
}
