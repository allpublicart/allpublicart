pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "./AllPublicArtToken.sol";
import "./CompanyAllocation.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtCrowdsale is CappedCrowdsale, FinalizableCrowdsale {
    // price at which whitelisted buyers will be able to buy tokens
    uint256 public preferentialRate;
    uint256 public earlyPurchaseBonus = 20;

    uint256 public constant TOTAL_SHARE = 100;
    uint256 public constant CROWDSALE_SHARE = 80;
    uint256 public constant COMPANY_SHARE = 20; // 20 % of total token supply allocated to company.
    CompanyAllocation public companyAllocation;

    // bonus milestones
    uint256 public firstBonusSalesEnds;
    uint256 public secondBonusSalesEnds;
    uint256 public thirdBonusSalesEnds;

    // customize the rate for each whitelisted buyer
    mapping (address => uint256) public buyerRate;

    // list of addresses that can purchase before crowdsale opens
    mapping (address => bool) public whitelist;

    // Events
    event PreferentialUserRateChange(address indexed buyer, uint256 rate);
    event PreferentialRateChange(uint256 rate);

    function AllPublicArtCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _cap, uint256 _preferentialRate, address _wallet)
        CappedCrowdsale(_cap)
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {

        // setup for token bonus milestones
        firstBonusSalesEnds = startTime + 7 days;             // 1. end of 1st week
        secondBonusSalesEnds = firstBonusSalesEnds + 7 days; // 2. end of 2nd week
        thirdBonusSalesEnds = secondBonusSalesEnds + 7 days; // 3. end of third week
        preferentialRate = _preferentialRate;
    }

    function createTokenContract() internal returns (MintableToken) {
        return new AllPublicArtToken();
    }

    function addToWhitelist(address buyer) public onlyOwner {
        require(buyer != address(0));
        whitelist[buyer] = true;
    }

    // @return true if buyer is whitelisted
    function isWhitelisted(address buyer) public constant returns (bool) {
        return whitelist[buyer];
    }

    // overriding Crowdsale#validPurchase to add whitelist logic
    // @return true if buyers can buy at the moment
    function validPurchase() internal constant returns (bool) {
        return super.validPurchase() || (!hasEnded() && isWhitelisted(msg.sender));
    }

    function setBuyerRate(address buyer, uint256 rate) onlyOwner public {
        require(rate != 0);
        require(isWhitelisted(buyer));
        require(now < startTime);

        buyerRate[buyer] = rate;

        PreferentialUserRateChange(buyer, rate);
    }

    function setPreferantialRate(uint256 rate) onlyOwner public {
        require(rate != 0);
        require(now < startTime);

        preferentialRate = rate;

        PreferentialRateChange(rate);
    }

    function getRate(address beneficiary) internal returns(uint256) {
        // some early buyers are offered a discount on the crowdsale price
        if (buyerRate[beneficiary] != 0) {
            return buyerRate[beneficiary];//.mul(earlyPurchaseBonus).div(100);
        }

        // whitelisted buyers can purchase at preferential price before crowdsale ends
        if (isWhitelisted(beneficiary)) {
            return preferentialRate;//.mul(earlyPurchaseBonus).div(100);
        }

        // otherwise it is the crowdsale rate
        return rate;
    }

    function buyTokens(address beneficiary) payable {
        require(beneficiary != address(0));
        require(validPurchase());

        uint256 weiAmount = msg.value;
        uint256 updatedWeiRaised = weiRaised.add(weiAmount);
        uint256 bonus = getBonusTier(beneficiary);

        uint256 rate = getRate(beneficiary);
        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        if (bonus > 0) {
            uint256 tokensIncludingBonus = tokens.mul(getBonusTier(beneficiary)).div(100);

            tokens = tokens.add(tokensIncludingBonus);
        }

        // update state
        weiRaised = updatedWeiRaised;

        token.mint(beneficiary, tokens);

        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
    }

    function finalization() internal {
       uint256 totalSupply = token.totalSupply();
       uint256 finalSupply = TOTAL_SHARE.mul(totalSupply).div(CROWDSALE_SHARE);
       companyAllocation = new CompanyAllocation();

       // emit tokens for the company
       token.mint(companyAllocation, COMPANY_SHARE.mul(finalSupply).div(TOTAL_SHARE));

       super.finalization();
    }

    /**
     * @dev Fetchs Bonus tier percentage per bonus milestones
     */
    function getBonusTier(address beneficiary) internal returns (uint256) {
        bool firstBonusSalesPeriod = now >= startTime && now <= firstBonusSalesEnds; // 1st week 15% bonus
        bool secondBonusSalesPeriod = now > firstBonusSalesEnds && now <= secondBonusSalesEnds; // 2nd week 10% bonus
        bool thirdBonusSalesPeriod = now > secondBonusSalesEnds && now <= thirdBonusSalesEnds; // 3rd week 5% bonus
        bool fourthBonusSalesPeriod = now > thirdBonusSalesEnds; // 4th week on 0 % bonus

        if (buyerRate[beneficiary] != 0 || isWhitelisted(beneficiary)) return earlyPurchaseBonus;
        if (firstBonusSalesPeriod) return 15;
        if (secondBonusSalesPeriod) return 10;
        if (thirdBonusSalesPeriod) return 5;
        if (fourthBonusSalesPeriod) return 0;
    }
}
