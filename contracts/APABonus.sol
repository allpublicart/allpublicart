pragma solidity 0.4.18;

import "./WhitelistRegistry.sol";

/**
 * @title All Public Art Bonus contract - bonus milestones and percentage for crowdsale
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract APABonus {
    WhitelistRegistry public wRegistry;

    // bonus milestones
    uint256 public startTime;
    uint256 public preSaleEnds;
    uint256 public firstBonusSalesEnds;
    uint256 public secondBonusSalesEnds;
    uint256 public thirdBonusSalesEnds;

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp when crowdsale commences
     * @param _preSaleEnds The timestamp when presale ends
     * @param _firstBonusSalesEnds Timestamp when first bonus milestones end
     * @param _secondBonusSalesEnds Timestamp when second bonus milestones end
     * @param _thirdBonusSalesEnds Timestamp when third bonus milestones end
     * @param _whitelistRegistry Address of the whitelist registry contract
     */
    function APABonus
        (
            uint256 _startTime,
            uint256 _preSaleEnds,
            uint256 _firstBonusSalesEnds,
            uint256 _secondBonusSalesEnds,
            uint256 _thirdBonusSalesEnds,
            address _whitelistRegistry
        )
        public
    {
        require(_whitelistRegistry != address(0));

        // setup for token bonus milestones
        startTime = _startTime;
        preSaleEnds = _preSaleEnds;
        firstBonusSalesEnds = _firstBonusSalesEnds;
        secondBonusSalesEnds = _secondBonusSalesEnds;
        thirdBonusSalesEnds = _thirdBonusSalesEnds;

        wRegistry = WhitelistRegistry(_whitelistRegistry);
    }

    /**
     * @dev Fetches Bonus tier percentage per bonus milestones
     * @param beneficiary Address of the purchaser
     * @return uint256 representing percentage of the bonus tier
     */
    function getBonusTier(address beneficiary, uint256 value) public view returns (uint256) {
        bool preSalePeriod = now >= startTime && now <= preSaleEnds;
        bool firstBonusSalesPeriod = now > preSaleEnds && now <= firstBonusSalesEnds; // 20% bonus
        bool secondBonusSalesPeriod = now > firstBonusSalesEnds && now <= secondBonusSalesEnds; // 15% bonus
        bool thirdBonusSalesPeriod = now > secondBonusSalesEnds && now <= thirdBonusSalesEnds; //  10% bonus
        bool fourthBonusSalesPeriod = now > thirdBonusSalesEnds; //  0 % bonus

        if (preSalePeriod)
            return calculatePreSaleBonus(beneficiary, value);
        if (firstBonusSalesPeriod) return 20;
        if (secondBonusSalesPeriod) return 15;
        if (thirdBonusSalesPeriod) return 10;
        if (fourthBonusSalesPeriod) return 0;
    }

    /**
     * @dev calculates pre sale bonus tier
     * @param beneficiary Address of the purchaser
     * @return bonus percentage as uint
     */
    function calculatePreSaleBonus(address beneficiary, uint256 value) internal view returns (uint256) {
        require(value <= 5000 ether);
        /*
            Public Pre Sale details:
            Minimum Contribution            Bonus
            35 ETH no minimum for Artists   25%
            35+ ETH ($10.5k)                25%
            100+ ETH ($30k)                 30%
            500+ ETH ($150k)                40%
            1000+ ETH ($300k)               45%
        */
        if (value < 35 ether && wRegistry.isArtist(beneficiary))
            return 25;
        if (value < 35 ether)
            return 0;
        if (value >= 35 ether && value < 100 ether)
            return 25;
        if (value >= 100 ether && value < 500 ether)
            return 30;
        if (value >= 500 ether && value < 1000 ether)
            return 40;
        if (value >= 1000 ether)
            return 45;
    }

}
