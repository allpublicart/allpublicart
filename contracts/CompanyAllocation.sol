pragma solidity ^0.4.13;

import './AllPublicArtToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

contract CompanyAllocation is Ownable {
    using SafeMath for uint;
    uint256 public unlockedAt;
    uint tokensCreated = 0;
    uint allocatedTokens = 0;
    uint totalCompanyAllocation = 2000000e18;

    mapping (address => uint256) companyAllocations;

    AllPublicArtToken apa;

    function CompanyAllocationContract() {
        apa = AllPublicArtToken(msg.sender);
        uint oneMonth = 30 days;
        unlockedAt = now.add(oneMonth);
    }

    function addCompanyAllocation (address foundersAddress, uint256 allocationValue)
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

    /*
     * @dev Allow company to unlock allocated tokens by transferring them
     */
    function unlock() external {
        assert (now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensCreated == 0) {
            tokensCreated = apa.balanceOf(this);
        }

        uint256 transferAllocation = companyAllocations[msg.sender];
        companyAllocations[msg.sender] = 0;

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(apa.transfer(msg.sender, transferAllocation));
    }

    /*
     * @dev Plan B allow for selfdestruct possibility and sending funds to owner after three months
     */
    function killContractAfterThreeMonths() onlyOwner() {
        assert (now >= 3 * 30 days);
        selfdestruct(msg.sender);
    }
}
