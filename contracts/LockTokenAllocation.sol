pragma solidity 0.4.18;

import './AllPublicArtToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/**
 * @title Locking Token Allocation contract - lock tokens allocation
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract LockTokenAllocation {
    using SafeMath for uint;
    address public owner;
    uint256 public unlockedAt;
    uint256 public canSelfDestruct;
    uint256 public tokensCreated;
    uint256 public allocatedTokens;
    uint256 public totalLockTokenAllocation;

    mapping (address => uint256) public lockedAllocations;

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
     * for the LockTokenAllocation contract
     */
    function LockTokenAllocation
        (
            address _owner,
            address _token,
            uint256 _unlockedAt,
            uint256 _canSelfDestruct,
            uint256 _totalLockTokenAllocation
        )
        public
    {
        owner = _owner;
        apa = AllPublicArtToken(_token);
        unlockedAt = _unlockedAt;
        canSelfDestruct = _canSelfDestruct;
        totalLockTokenAllocation = _totalLockTokenAllocation;
    }

    /**
     * @dev Adds founders' token allocation
     * @param beneficiary Ethereum address of a person
     * @param allocationValue Number of tokens allocated to person
     * @return true if address is correctly added
     */
    function addLockTokenAllocation(address beneficiary, uint256 allocationValue)
        external
        onlyOwner
        returns(bool)
    {
        assert(lockedAllocations[beneficiary] == 0); // can only add once.

        allocatedTokens = allocatedTokens.add(allocationValue);
        require(allocatedTokens <= totalLockTokenAllocation);

        lockedAllocations[beneficiary] = allocationValue;
        return true;
    }

    /**
     * @dev Allow unlocking of allocated tokens by transferring them to whitelisted addresses.
     * Need to be called by each address
     */
    function unlock() external {
        require(apa != address(0));
        assert(now >= unlockedAt);

        // During first unlock attempt fetch total number of locked tokens.
        if (tokensCreated == 0) {
            tokensCreated = apa.balanceOf(this);
        }

        uint256 transferAllocation = lockedAllocations[msg.sender];
        lockedAllocations[msg.sender] = 0;

        // Will fail if allocation (and therefore toTransfer) is 0.
        require(apa.transfer(msg.sender, transferAllocation));
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
