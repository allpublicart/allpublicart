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

    uint256 constant public totalSupplyCrowdsale = 350000000e18;
    uint256 public constant COMPANY_SHARE = 650000000e18; // 650M tokens allocated to company
    CompanyAllocation public companyAllocation;

    // bonus milestones
    uint256 public preSaleEnds;
    uint256 public firstBonusSalesEnds;
    uint256 public secondBonusSalesEnds;
    uint256 public thirdBonusSalesEnds;

    // customize the rate for each whitelisted buyer
    mapping (address => uint256) public buyerRate;

    // list of addresses that can purchase before crowdsale opens
    mapping (address => bool) public whitelist;

    struct OnePercent {
        address beneficiary;
    }
    OnePercent public onePercent;

    // Events
    event PreferentialUserRateChange(address indexed buyer, uint256 rate);
    event PreferentialRateChange(uint256 rate);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _rate The token rate per ETH
     * @param _cap Crowdsale cap
     * @param _preferentialRate Rate for whitelisted pre sale purchasers
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     */
    function AllPublicArtCrowdsale
        (
            uint256 _startTime,
            uint256 _preSaleEnds,
            uint256 _firstBonusSalesEnds,
            uint256 _secondBonusSalesEnds,
            uint256 _thirdBonusSalesEnds,
            uint256 _endTime,
            uint256 _rate,
            uint256 _cap,
            uint256 _preferentialRate,
            address _wallet
        )

        CappedCrowdsale(_cap)
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {

        // setup for token bonus milestones
        preSaleEnds = _preSaleEnds;
        firstBonusSalesEnds = _firstBonusSalesEnds;
        secondBonusSalesEnds = _secondBonusSalesEnds;
        thirdBonusSalesEnds = _thirdBonusSalesEnds;

        preferentialRate = _preferentialRate;

        AllPublicArtToken(token).pause();
    }

    /**
     * @dev Creates AllPublicArtToken contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new AllPublicArtToken();
    }

    /**
     * @dev Add whitelist addresses that can participate in the pre and crowdsale with a preferential rate
     * @param buyer Purchaser's address to be whitelisted
     */
    function addToWhitelist(address buyer) public onlyOwner {
        require(buyer != address(0));
        whitelist[buyer] = true;
    }

    /**
     * @dev checks whether address is whitelisted
     * @param buyer Purchaser's address to check
     * @return true if buyer is whitelisted
     */
    function isWhitelisted(address buyer) public constant returns (bool) {
        return whitelist[buyer];
    }

    /**
     * @dev overrides Crowdsale#validPurchase to add whitelist logic
     * @return true if buyers is able to buy at the moment
     */
    function validPurchase() internal constant returns (bool) {
        return super.validPurchase() || (!hasEnded() && isWhitelisted(msg.sender));
    }

    /**
     * @dev sets preferentialRate for a whitelisted buyer
     * @param buyer Address that is whitelisted already
     * @param rate Customizable rate
     */
    function setBuyerRate(address buyer, uint256 rate) onlyOwner public {
        require(rate != 0);
        require(isWhitelisted(buyer));
        require(now < startTime);

        buyerRate[buyer] = rate;

        PreferentialUserRateChange(buyer, rate);
    }

    /**
     * @dev sets global preferentialRate for whitelisted buyer that has no customized rate
     * @param rate New global preferentialRate
     */
    function setPreferantialRate(uint256 rate) onlyOwner public {
        require(rate != 0);
        require(now < startTime);

        preferentialRate = rate;

        PreferentialRateChange(rate);
    }

    /**
     * @dev internal functions that fetches the rate for the purchase
     * @param beneficiary Address of the purchaser
     * @return uint256 of the rate to be used
     */
    function getRate(address beneficiary) internal returns(uint256) {
        // some early buyers are offered a discount on the crowdsale price
        if (buyerRate[beneficiary] != 0) {
            return buyerRate[beneficiary];
        }

        // whitelisted buyers can purchase at preferential price before crowdsale ends
        if (isWhitelisted(beneficiary)) {
            return preferentialRate;
        }

        // otherwise it is the crowdsale rate
        return rate;
    }

    /**
     * @dev triggers token transfer mechanism. To be used after the crowdsale is finished
     */
    function unpauseToken() onlyOwner {
        require(isFinalized);
        AllPublicArtToken(token).unpause();
    }

    /**
     * @dev Pauses token transfers. Only used after crowdsale finishes
     */
    function pauseToken() onlyOwner {
        require(isFinalized);
        AllPublicArtToken(token).pause();
    }

    /**
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary) payable {
        require(beneficiary != address(0));
        require(validPurchase());

        if (now >= startTime && now <= preSaleEnds)
            require(checkMinimumPreSaleRequirement());

        uint256 weiAmount = msg.value;
        uint256 bonus = getBonusTier();

        uint256 rate = getRate(beneficiary);
        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

        if (bonus > 0) {
            uint256 tokensIncludingBonus = tokens.mul(bonus).div(100);

            tokens = tokens.add(tokensIncludingBonus);
        }

        // update state
        weiRaised = weiRaised.add(weiAmount);

        token.mint(beneficiary, tokens);

        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        forwardFunds();
    }

    /**
     * @dev send ether to the fund collection wallets
     */
    function forwardFunds() internal {
        // 1% of the purchase to save in different wallet
        uint256 onePercentValue = msg.value.mul(1).div(100);
        uint256 valueToTransfer = msg.value.sub(onePercentValue);

        onePercent.beneficiary.transfer(onePercentValue);
        wallet.transfer(valueToTransfer);
    }

    /**
     * @dev Add onePercent beneficiary address to the contract
     * @param beneficiaryAddress Aaddress in which the one percent of purchases will go to
     */
    function setOnePercent(address beneficiaryAddress) public onlyOwner {
        require(beneficiaryAddress != address(0));
        require(onePercent.beneficiary == address(0)); // only able to add once
        onePercent.beneficiary = beneficiaryAddress;
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
       uint256 totalSupply = token.totalSupply();
       companyAllocation = new CompanyAllocation(owner, token);

       // emit tokens for the company
       token.mint(companyAllocation, COMPANY_SHARE);

       if (totalSupply < totalSupplyCrowdsale) {
           uint256 remainingTokens = totalSupplyCrowdsale.sub(totalSupply);

           token.mint(companyAllocation, remainingTokens);
       }

       super.finalization();
    }

    /**
     * @dev checks whether it is pre sale and if there is minimum purchase requirement
     * @return truthy if purchase is equal or more than 10 ether
     */
     function checkMinimumPreSaleRequirement() internal returns (bool) {
        return msg.value >= 10 ether;
     }

    /**
     * @dev Fetches Bonus tier percentage per bonus milestones
     * @return uint256 representing percentage of the bonus tier
     */
    function getBonusTier() internal returns (uint256) {
        bool preSalePeriod = now >= startTime && now <= preSaleEnds; //  20% bonus
        bool firstBonusSalesPeriod = now >= preSaleEnds && now <= firstBonusSalesEnds; // 15% bonus
        bool secondBonusSalesPeriod = now > firstBonusSalesEnds && now <= secondBonusSalesEnds; // 10% bonus
        bool thirdBonusSalesPeriod = now > secondBonusSalesEnds && now <= thirdBonusSalesEnds; //  5% bonus
        bool fourthBonusSalesPeriod = now > thirdBonusSalesEnds; //  0 % bonus

        if (preSalePeriod) return 20;
        if (firstBonusSalesPeriod) return 15;
        if (secondBonusSalesPeriod) return 10;
        if (thirdBonusSalesPeriod) return 5;
        if (fourthBonusSalesPeriod) return 0;
    }
}
