pragma solidity 0.4.18;

import "zeppelin-solidity/contracts/crowdsale/FinalizableCrowdsale.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./AllPublicArtToken.sol";
import "./CompanyAllocation.sol";
import "./WhitelistRegistry.sol";
import "./APABonus.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */

contract AllPublicArtCrowdsale is FinalizableCrowdsale, Pausable {
    uint256 constant public TOTAL_SUPPLY_CROWDSALE = 400000000e18;
    uint256 public constant COMPANY_SHARE = 600000000e18; // 600M tokens allocated to company
    CompanyAllocation public companyAllocation;
    WhitelistRegistry public wRegistry;
    APABonus public apaBonus;

    struct TwoPercent {
        address beneficiary;
    }

    TwoPercent public twoPercent;

    // Events
    event PrivateInvestorTokenPurchase(address indexed investor, uint256 rate, uint256 bonus, uint weiAmount);

    /**
     * @dev Contract constructor function
     * @param _startTime The timestamp of the beginning of the crowdsale
     * @param _endTime Timestamp when the crowdsale will finish
     * @param _rate The token rate per ETH
     * @param _whitelistRegistry Address of the whitelist registry contract
     * @param _wallet Multisig wallet that will hold the crowdsale funds.
     */
    function AllPublicArtCrowdsale
        (
            uint256 _startTime,
            uint256 _endTime,
            uint256 _rate,
            uint256 _whitelistRegistry,
            uint256 _apaBonus,
            uint256 _companyAllocation,
            address _wallet
        )
        public
        FinalizableCrowdsale()
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
        wRegistry = WhitelistRegistry(_whitelistRegistry);
        apaBonus = APABonus(_apaBonus);
        companyAllocation = CompanyAllocation(_companyAllocation);

        AllPublicArtToken(token).pause();
    }

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
     * @dev Add twoPercent beneficiary address to the contract
     * @param beneficiaryAddress Aaddress in which the one percent of purchases will go to
     */
    function setTwoPercent(address beneficiaryAddress) public onlyOwner {
        require(beneficiaryAddress != address(0));
        require(twoPercent.beneficiary == address(0)); // only able to add once
        twoPercent.beneficiary = beneficiaryAddress;
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
        require(validPurchase() && token.totalSupply() <= TOTAL_SUPPLY_CROWDSALE);

        uint256 weiAmount = msg.value;
        uint256 bonus = apaBonus.getBonusTier(beneficiary, msg.value);

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
        return super.validPurchase() || (!hasEnded() && wRegistry.isWhitelisted(msg.sender));
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

        // otherwise it is the crowdsale rate
        return rate;
    }

    /**
     * @dev finalizes crowdsale
     */
    function finalization() internal {
        uint256 totalSupply = token.totalSupply();

        // emit tokens for the company
        token.mint(companyAllocation, COMPANY_SHARE);

        if (totalSupply < TOTAL_SUPPLY_CROWDSALE) {
            uint256 remainingTokens = TOTAL_SUPPLY_CROWDSALE.sub(totalSupply);

            token.mint(companyAllocation, remainingTokens);
        }

        AllPublicArtToken(token).unpause();
        super.finalization();
    }
}
