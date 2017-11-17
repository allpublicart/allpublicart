pragma solidity ^0.4.13;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./AllPublicArtToken.sol";
import "./CompanyAllocation.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtCrowdsale is FinalizableCrowdsale, Pausable {
    // price at which whitelisted buyers will be able to buy tokens
    uint256 public preferentialRate;

    uint256 constant public totalSupplyCrowdsale = 400000000e18;
    uint256 public constant COMPANY_SHARE = 600000000e18; // 650M tokens allocated to company
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
    // list of artist addresses that can purchase during the presale without a minimum amount
    mapping (address => bool) public artistWhitelist;

    struct TwoPercent {
        address beneficiary;
    }

    TwoPercent public twoPercent;

    // Events
    event PreferentialUserRateChange(address indexed buyer, uint256 rate);
    event PrivateInvestorTokenPurchase(address indexed investor, uint256 rate, uint256 bonus, uint weiAmount);
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

    // NOTE: write test for this.
    /**
     * @dev Mint tokens for private investors before crowdsale starts
     * @param investorsAddress Purchaser's address
     * @param rate Rate of the purchase
     * @param bonus Number that represents the bonus
     * @param weiAmount Amount that the investors sent during the private sale period
     */
    function mintTokenForPrivateInvestors(address investorsAddress, uint256 rate, uint256 bonus, uint256 weiAmount)
        external
        onlyOwner
    {
        require(now <= startTime);

        uint256 tokens = rate.mul(weiAmount);
        uint256 tokenBonus = tokens.mul(bonus).div(100);
        tokens = tokens.add(tokenBonus);

        token.mint(investorsAddress, tokens);
        PrivateInvestorTokenPurchase(investorsAddress, rate, bonus, weiAmount);
    }


    /**
     * @dev Add artists addresses as a whitelist mechanism
     * @param artist Artist's address to be whitelisted
     */
    function whitelistArtist(address artist) public onlyOwner {
        require(artist != address(0));
        artistWhitelist[artist] = true;
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
     * @dev checks whether artist address is whitelisted
     * @param artist Artist's address to check
     * @return true if artist is whitelisted
     */
    function checkForWhitelistedArtist(address artist) public constant returns (bool) {
        return artistWhitelist[artist];
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

        buyerRate[buyer] = rate;

        PreferentialUserRateChange(buyer, rate);
    }

    /**
     * @dev sets global preferentialRate for whitelisted buyer that has no customized rate
     * @param rate New global preferentialRate
     */
    function setPreferantialRate(uint256 rate) onlyOwner public {
        require(rate != 0);

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
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        payable
    {
        require(beneficiary != address(0));
        require(validPurchase() && token.totalSupply() <= totalSupplyCrowdsale);

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
        // 2% of the purchase to save in different wallet
        uint256 twoPercentValue = msg.value.mul(2).div(100);
        uint256 valueToTransfer = msg.value.sub(twoPercentValue);

        twoPercent.beneficiary.transfer(twoPercentValue);
        wallet.transfer(valueToTransfer);
    }

    /**
     * @dev Add twoPercent beneficiary address to the contract
     * @param beneficiaryAddress Aaddress in which the one percent of purchases will go to
     */
    function setTwoPercent(address beneficiaryAddress) public onlyOwner {
        require(beneficiaryAddress != address(0));
        require(twoPercent.beneficiary == address(0)); // only able to add once
        twoPercent.beneficiary = beneficiaryAddress;
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

       AllPublicArtToken(token).unpause();
       super.finalization();
    }

    /**
     * @dev calculates pre sale bonus tier
     * @return bonus percentage as uint
     */
     function calculatePreSaleBonus() internal returns (uint256) {
         /*
            0-35 no minimum for Artists 20%
            35+ ETH ($10.5k)            25%
            100+ ETH ($30k)             30%
            500+ ETH ($150k)            40%
            1000+ ETH ($300k)           45%
         */

         if (msg.value < 35 ether)
            return 20;
         if (msg.value >= 35 ether && msg.value < 100 ether)
            return 25;
         if (msg.value >= 100 ether && msg.value < 500 ether)
            return 30;
         if (msg.value >= 500 ether && msg.value < 1000 ether)
            return 40;
         if (msg.value >= 1000 ether)
            return 45;
     }

    /**
     * @dev Fetches Bonus tier percentage per bonus milestones
     * @return uint256 representing percentage of the bonus tier
     */
    function getBonusTier() internal returns (uint256) {
        bool preSalePeriod = now >= startTime && now <= preSaleEnds;
        bool firstBonusSalesPeriod = now > preSaleEnds && now <= firstBonusSalesEnds; // 20% bonus
        bool secondBonusSalesPeriod = now > firstBonusSalesEnds && now <= secondBonusSalesEnds; // 15% bonus
        bool thirdBonusSalesPeriod = now > secondBonusSalesEnds && now <= thirdBonusSalesEnds; //  10% bonus
        bool fourthBonusSalesPeriod = now > thirdBonusSalesEnds; //  0 % bonus

        if (preSalePeriod)
            return calculatePreSaleBonus();
        if (firstBonusSalesPeriod) return 20;
        if (secondBonusSalesPeriod) return 15;
        if (thirdBonusSalesPeriod) return 10;
        if (fourthBonusSalesPeriod) return 0;
    }
}
