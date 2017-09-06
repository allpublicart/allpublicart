pragma solidity ^0.4.13;

import "./AllPublicArtToken.sol";
import "zeppelin-solidity/contracts/crowdsale/CappedCrowdsale.sol";
import "zeppelin-solidity/contracts/crowdsale/RefundableCrowdsale.sol";
import "./WhitelistedCrowdsale.sol";
import "./CompanyAllocation.sol";

/**
 * @title All Public Art Crowdsale contract - crowdsale contract for the APA tokens.
 * @author Gustavo Guimaraes - <gustavoguimaraes@gmail.com>
 */
contract AllPublicArtCrowdsale is WhitelistedCrowdsale, CappedCrowdsale, RefundableCrowdsale {
    // price at which whitelisted buyers will be able to buy tokens
    uint256 public preferentialRate;

    uint256 public constant TOTAL_SHARE = 100;
    uint256 public constant CROWDSALE_SHARE = 80;
    uint256 public constant COMPANY_SHARE = 20; // 20 % of total token supply allocated to company.
    CompanyAllocation companyAllocation;

    // customize the rate for each whitelisted buyer
    mapping (address => uint256) public buyerRate;

    // Events
    event PreferentialUserRateChange(address indexed buyer, uint256 rate);
    event PreferentialRateChange(uint256 rate);

    function AllPublicArtCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, uint256 _goal, uint256 _cap, address   _wallet)
        CappedCrowdsale(_cap)
        FinalizableCrowdsale()
        WhitelistedCrowdsale()
        RefundableCrowdsale(_goal)
        Crowdsale(_startTime, _endTime, _rate, _wallet)
    {
    //As goal needs to be met for a successful crowdsale
    //the value needs to be less or equal than a cap which is the limit for accepted funds
        require(_goal <= _cap);
    }

    function createTokenContract() internal returns (MintableToken) {
        return new AllPublicArtToken();
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

    function getRate() internal returns(uint256) {
        // some early buyers are offered a discount on the crowdsale price
        if (buyerRate[msg.sender] != 0) {
            return buyerRate[msg.sender];
        }

        // whitelisted buyers can purchase at preferential price before crowdsale ends
        if (isWhitelisted(msg.sender)) {
            return preferentialRate;
        }

        // otherwise compute the price for the auction
        // TODO calculate normal the timestamps the discounts happen

        return rate;
    }

    function buyTokens(address beneficiary) payable {
        require(beneficiary != 0x0);
        require(validPurchase());

        uint256 weiAmount = msg.value;
        uint256 updatedWeiRaised = weiRaised.add(weiAmount);

        uint256 rate = getRate();
        // calculate token amount to be created
        uint256 tokens = weiAmount.mul(rate);

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
       super;
   }

   function () payable {
        buyTokens(msg.sender);
   }
}
