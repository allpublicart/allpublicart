pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./AllPublicArtToken.sol";
import "./WhitelistRegistry.sol";
import "./APABonus.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract AllPublicArtCrowdsale is FinalizableCrowdsale, Pausable {
    WhitelistRegistry public wRegistry;
    APABonus public apaBonus;

    struct TwoPercent {
        address beneficiary;
    }

    struct CrowdsalePurchase {
        address purchaser;
        uint256 bonusAmount;
        uint256 weiContributed;
    }

    CrowdsalePurchase[] public crowdsalePurchases;
    mapping (address => uint256) public crowdsalePurchaseAmountBy;
    // after the crowdsale
    mapping (address => uint256) public numOfWithdrawnTokensBy;
    // index to keep the number of crowdsale purchases that have already had the tokens withdrawn
    uint256 public numOfLoadedCrowdsalePurchases;
    bool public tokensWithdrawn; // returns whether all tokens have been withdrawn
    uint256 public finalRate;

    TwoPercent public twoPercent;

    // Events
    event PurchaseInfo(address indexed purchaser, uint256 bonusAmount, uint256 weiContributed);
    event MintedTokensFor(address indexed beneficiary, uint256 tokenAmount);
    event PrivateInvestorTokenPurchase(address indexed investor, uint256 rate, uint256 bonus, uint weiAmount);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _rate The token rate per ETH
     * @param _whitelistRegistry Address of the whitelist registry contract
     * @param _apaBonus Address of the apaBonus contract
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     */
    function AllPublicArtCrowdsale
        (
            uint256 _startTime,
            uint256 _endTime,
            uint256 _rate,
            address _whitelistRegistry,
            address _apaBonus,
            address _wallet
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        require(_whitelistRegistry != address(0) && _apaBonus != address(0));
        wRegistry = WhitelistRegistry(_whitelistRegistry);
        apaBonus = APABonus(_apaBonus);

        AllPublicArtToken(token).pause();
    }

    /**
     * @dev Throws when twoPercent is not set
     */
    modifier twoPercentWalletIsSet() {
        require(twoPercent.beneficiary != address(0));
        _;
    }

    /**
     * @dev Mint tokens for private investors thoughout the crowdsale duration
     * @param investorsAddress Purchaser's address
     * @param rate Rate of the purchase
     * @param bonus Number that represents the bonus
     * @param weiAmount Amount that the investors sent during the private sale period
     */
    function mintTokenForPrivateInvestors(address investorsAddress, uint256 rate, uint256 bonus, uint256 weiAmount)
        external
        onlyOwner
    {
        require(investorsAddress != address(0));

        uint256 tokens = rate.mul(weiAmount);
        uint256 tokenBonus = tokens.mul(bonus).div(100);
        tokens = tokens.add(tokenBonus);

        token.mint(investorsAddress, tokens);
        PrivateInvestorTokenPurchase(investorsAddress, rate, bonus, weiAmount);
        MintedTokensFor(investorsAddress, tokens);
    }

    /**
     * @dev Mint tokens company, advisors and bounty
     * @param beneficiaryAddress Address of beneficiary
     * @param amountOfTokens Number of tokens to be created
     */
    function mintTokensFor(address beneficiaryAddress, uint256 amountOfTokens)
        public
        onlyOwner
    {
        require(beneficiaryAddress != address(0) && hasEnded());

        token.mint(beneficiaryAddress, amountOfTokens);
        MintedTokensFor(beneficiaryAddress, amountOfTokens);
    }

    /**
     * @dev Add twoPercent beneficiary address to the contract
     * @param beneficiaryAddress Address in which the two percent of purchases will go to
     */
    function setTwoPercent(address beneficiaryAddress) public onlyOwner {
        require(beneficiaryAddress != address(0));
        require(twoPercent.beneficiary == address(0)); // only able to add once
        twoPercent.beneficiary = beneficiaryAddress;
    }

    /**
     * @dev Sets final rate for the crowdsale
     * @param _finalRate Rate which tokens will be calculated from
     */
    function setFinalRate(uint256 _finalRate) public onlyOwner {
        require(_finalRate != 0);
        finalRate = _finalRate;
    }

    /**
     * @dev Returns number of purchases to date.
     */
    function numOfPurchases() public constant returns (uint256) {
        return crowdsalePurchases.length;
    }

    /**
     * @dev payable function that allow token purchases
     * @param beneficiary Address of the purchaser
     */
    function buyTokens(address beneficiary)
        public
        whenNotPaused
        twoPercentWalletIsSet
        payable
    {
        require(beneficiary != address(0));
        require(validPurchase());

        uint256 weiAmount = msg.value;
        uint256 bonus = apaBonus.getBonusTier(beneficiary, msg.value);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        CrowdsalePurchase memory purchase = CrowdsalePurchase(beneficiary, bonus, weiAmount);
        crowdsalePurchases.push(purchase);
        crowdsalePurchaseAmountBy[beneficiary] = crowdsalePurchaseAmountBy[beneficiary].add(weiAmount);
        PurchaseInfo(beneficiary, bonus, weiAmount);

        forwardFunds();
    }

    /**
     * @dev send tokens to crowdsale purchasers and keep track of them
     */
    function sendTokensToPurchasers()
        public
        onlyOwner
    {
        require(hasEnded() && finalRate != 0);
        require(!tokensWithdrawn);

        uint256 numberOfPurchases = this.numOfPurchases();

        for (uint256 i = numOfLoadedCrowdsalePurchases; i < numberOfPurchases && msg.gas > 200000; i++) {
            CrowdsalePurchase memory csPurchases = crowdsalePurchases[i];
            address purchaser = csPurchases.purchaser;
            uint256 bonus = csPurchases.bonusAmount;
            uint256 weiContributed = csPurchases.weiContributed;

            uint256 rate = getRate(purchaser);
            // calculate token amount to be created
            uint256 tokens = weiContributed.mul(rate);

            if (bonus > 0) {
                uint256 tokensIncludingBonus = tokens.mul(bonus).div(100);

                tokens = tokens.add(tokensIncludingBonus);
            }

            token.mint(purchaser, tokens);
            TokenPurchase(msg.sender, purchaser, weiContributed, tokens);
            MintedTokensFor(purchaser, tokens);
            numOfWithdrawnTokensBy[purchaser] = numOfWithdrawnTokensBy[purchaser].add(tokens);

            numOfLoadedCrowdsalePurchases++;    // Increase the index
        }

        assert(numOfLoadedCrowdsalePurchases <= numberOfPurchases);
        if (numOfLoadedCrowdsalePurchases == numberOfPurchases) {
            tokensWithdrawn = true;    // enable the flag
        }
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
     * @dev Creates AllPublicArtToken contract. This is called on the constructor function of the Crowdsale contract
     */
    function createTokenContract() internal returns (MintableToken) {
        return new AllPublicArtToken();
    }

    /**
     * @dev overrides Crowdsale#validPurchase to add whitelist logic
     * @return true if buyers is able to buy at the moment
     */
    function validPurchase() internal constant returns (bool) {
        return super.validPurchase() || (!hasEnded() && msg.value != 0 && wRegistry.isWhitelisted(msg.sender));
    }

    /**
     * @dev internal functions that fetches the rate for the purchase
     * @param beneficiary Address of the purchaser
     * @return uint256 of the rate to be used
     */
    function getRate(address beneficiary) internal returns(uint256) {
        // some early buyers are offered a discount on the crowdsale price
        if (wRegistry.buyerRate(beneficiary) != 0) {
            return wRegistry.buyerRate(beneficiary);
        }

        // whitelisted buyers can purchase at preferential price before crowdsale ends
        if (wRegistry.isWhitelisted(beneficiary)) {
            return wRegistry.preferentialRate();
        }

        if (finalRate != 0) {
            return finalRate;
        }

        // otherwise it is the crowdsale rate
        return rate;
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        token.finishMinting();
        AllPublicArtToken(token).unpause();
        super.finalization();
    }
}
