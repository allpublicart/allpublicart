const AllPublicArtCrowdsale = artifacts.require('./AllPublicArtCrowdsale.sol');
const AllPublicArtToken = artifacts.require('./AllPublicArtToken.sol');
const APABonus = artifacts.require('./APABonus.sol');
const WhitelistRegistry = artifacts.require('./WhitelistRegistry.sol');
const LockTokenAllocation = artifacts.require('./LockTokenAllocation.sol');

import { should, ensuresException, getBlockNow } from './helpers/utils';
import timer from './helpers/timer';

const BigNumber = web3.BigNumber;

contract(
  'AllPublicArtCrowdsale',
  (
    [
      owner,
      wallet,
      buyer,
      purchaser,
      buyer2,
      purchaser2,
      beneficiary,
      sender,
      companyAddress,
      teamAndAdvisorsAddress
    ]
  ) => {
    const rate = new BigNumber(50);
    const newRate = new BigNumber(400000000); // 400M APA tokens per 1 eth

    const preferentialRate = new BigNumber(100);
    const value = 1e18;
    const dayInSecs = 86400;

    const expectedCompanyTokens = new BigNumber(400000000e18);
    const expectedTeamAndAdvisorsTokens = new BigNumber(10000000e18);

    let startTime, endTime;
    let preSaleEnds,
      firstBonusSalesEnds,
      secondBonusSalesEnds,
      thirdBonusSalesEnds;
    let apaCrowdsale, apaToken;
    let whitelistRegistryContract, apaBonusContract;
    let numberOfTotalTokens,
      lockTokenAllocations,
      unlockedTime,
      canSelfDestruct;

    const newCrowdsale = rate => {
      startTime = getBlockNow() + 20; // crowdsale starts in 20 seconds
      preSaleEnds = startTime + dayInSecs * 10; // 10 days
      firstBonusSalesEnds = startTime + dayInSecs * 20; // 20 days
      secondBonusSalesEnds = startTime + dayInSecs * 30; // 30 days
      thirdBonusSalesEnds = startTime + dayInSecs * 40; // 40 days
      endTime = startTime + dayInSecs * 60; // 60 days

      return WhitelistRegistry.deployed()
        .then(whitelistRegistry => {
          whitelistRegistryContract = whitelistRegistry;
          return APABonus.new(
            startTime,
            preSaleEnds,
            firstBonusSalesEnds,
            secondBonusSalesEnds,
            thirdBonusSalesEnds,
            whitelistRegistry.address
          );
        })
        .then(apaBonus => {
          apaBonusContract = apaBonus;
          return AllPublicArtCrowdsale.new(
            startTime,
            endTime,
            rate,
            whitelistRegistryContract.address,
            apaBonusContract.address,
            wallet
          );
        });
    };

    const newLockTokenAllocation = (
      owner,
      token,
      unlockedAt,
      canSelfDestruct,
      totalLockTokenAllocation
    ) => {
      return LockTokenAllocation.new(
        owner,
        token,
        unlockedAt,
        canSelfDestruct,
        totalLockTokenAllocation
      );
    };

    beforeEach('initialize contract', async () => {
      apaCrowdsale = await newCrowdsale(rate);
      apaToken = AllPublicArtToken.at(await apaCrowdsale.token());
    });

    it('audit: should not let 0x or 0 addresses to be inputed in the constructor', async () => {
      startTime = getBlockNow() + 20; // crowdsale starts in 20 seconds
      preSaleEnds = startTime + dayInSecs * 10; // 10 days
      firstBonusSalesEnds = startTime + dayInSecs * 20; // 20 days
      secondBonusSalesEnds = startTime + dayInSecs * 30; // 30 days
      thirdBonusSalesEnds = startTime + dayInSecs * 40; // 40 days
      endTime = startTime + dayInSecs * 60; // 60 days

      try {
        await AllPublicArtCrowdsale.new(startTime, endTime, rate, 0, 0, wallet);
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }

      try {
        await APABonus.new(
          startTime,
          preSaleEnds,
          firstBonusSalesEnds,
          secondBonusSalesEnds,
          thirdBonusSalesEnds,
          0
        );
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }
    });

    it('has a normal crowdsale rate', async () => {
      const crowdsaleRate = await apaCrowdsale.rate();
      crowdsaleRate.toNumber().should.equal(rate.toNumber());
    });

    it('starts with token paused', async () => {
      const paused = await apaToken.paused();
      paused.should.be.true;
    });

    it('token is unpaused after crowdsale ends', async function() {
      timer(endTime + 30);

      let paused = await apaToken.paused();
      paused.should.be.true;

      await apaCrowdsale.finalize();

      paused = await apaToken.paused();
      paused.should.be.false;
    });

    it('finishes minting when crowdsale is finalized', async function() {
      timer(endTime + 30);

      let finishMinting = await apaToken.mintingFinished();
      finishMinting.should.be.false;

      await apaCrowdsale.finalize();

      finishMinting = await apaToken.mintingFinished();
      finishMinting.should.be.true;
    });

    it('assigns tokens to company', async function() {
      await timer(dayInSecs * 42);

      apaCrowdsale.setTwoPercent(beneficiary, { from: owner });
      await apaCrowdsale.buyTokens(buyer, { value, from: purchaser });

      await timer(endTime + 30);
      await apaCrowdsale.mintTokensFor(companyAddress, expectedCompanyTokens);
      const balance = await apaToken.balanceOf(companyAddress);

      balance.should.be.bignumber.equal(expectedCompanyTokens);
    });

    it('audit: should not let mintTokensFor() function execute with 0x address parameter', async function() {
      await timer(dayInSecs * 42);

      try {
        await apaCrowdsale.mintTokensFor(0, expectedCompanyTokens);
        assert.fail();
      } catch (e) {
        ensuresException(e);
      }
    });

    it('assigns tokens to team and advisors', async function() {
      await timer(dayInSecs * 42);

      await apaCrowdsale.setTwoPercent(buyer);
      await apaCrowdsale.buyTokens(buyer, { value, from: purchaser });

      await timer(endTime + 30);
      await apaCrowdsale.mintTokensFor(
        teamAndAdvisorsAddress,
        expectedTeamAndAdvisorsTokens
      );
      const balance = await apaToken.balanceOf(teamAndAdvisorsAddress);

      balance.should.be.bignumber.equal(expectedTeamAndAdvisorsTokens);
    });

    describe('forward funds', () => {
      it('does not allow non-owners to set twoPercent beneficiary', async () => {
        timer(20);

        try {
          await apaCrowdsale.setTwoPercent(buyer, { from: buyer });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }
        const twoPercent = await apaCrowdsale.twoPercent.call();
        twoPercent.should.be.equal(
          '0x0000000000000000000000000000000000000000'
        );
      });

      it('owner is able to set twoPercent', async () => {
        timer(20);
        await apaCrowdsale.setTwoPercent(beneficiary, { from: owner });
        const twoPercent = await apaCrowdsale.twoPercent.call();
        twoPercent.should.be.equal(beneficiary);
      });

      it('audit: does not allow token purchase if twoPercent is not set', async () => {
        await timer(dayInSecs * 42);
        const ethValue = 100e18;
        const wallet = await apaCrowdsale.wallet();

        const walletBalanceBefore = web3.eth.getBalance(wallet).toNumber();

        try {
          await apaCrowdsale.buyTokens(buyer, {
            value: ethValue,
            from: buyer
          });
          asset.fail();
        } catch (e) {
          ensuresException(e);
        }

        const walletBalanceAfter = web3.eth.getBalance(wallet).toNumber();

        walletBalanceBefore.should.be.equal(walletBalanceAfter);
      });

      it('twoPercent beneficiary is not able to be set more than once', async () => {
        timer(20);
        await apaCrowdsale.setTwoPercent(beneficiary, { from: owner });

        try {
          await apaCrowdsale.setTwoPercent(buyer, { from: owner });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const twoPercent = await apaCrowdsale.twoPercent.call();
        twoPercent.should.be.equal(beneficiary);
      });

      it('takes 2 percent of the purchase funds and assigns to beneficiary', async () => {
        await timer(dayInSecs * 42);
        const ethValue = 10e18;
        await apaCrowdsale.setTwoPercent(beneficiary, { from: owner });
        const beneficiaryBalance = web3.eth.getBalance(beneficiary).toNumber();

        await apaCrowdsale.buyTokens(buyer, {
          value: ethValue,
          from: buyer
        });

        const beneficiaryNewBalance = web3.eth
          .getBalance(beneficiary)
          .toNumber();
        const twoPercentOfValue = ethValue * 2 / 100;
        const calculateUpdatedBalance = beneficiaryBalance + twoPercentOfValue;

        calculateUpdatedBalance.should.be.closeTo(beneficiaryNewBalance, 1e18);
        beneficiaryNewBalance.should.be.above(beneficiaryBalance);
      });

      it('assigns 98 percent of the funds to wallet', async () => {
        await timer(dayInSecs * 42);
        const ethValue = 10e18;
        const wallet = await apaCrowdsale.wallet();
        const walletBalance = web3.eth.getBalance(wallet).toNumber();

        await apaCrowdsale.setTwoPercent(beneficiary, { from: owner });
        await apaCrowdsale.buyTokens(buyer, {
          value: ethValue,
          from: purchaser
        });

        const walletNewBalance = web3.eth.getBalance(wallet).toNumber();
        const ninetyEightPercentValue = ethValue * 98 / 100;
        const calculateUpdatedBalance = walletBalance + ninetyEightPercentValue;

        calculateUpdatedBalance.should.be.closeTo(walletNewBalance, 1e18);
        walletNewBalance.should.be.above(walletBalance);
      });
    });

    describe('token purchases plus their bonuses', () => {
      beforeEach(async () => {
        await apaCrowdsale.setTwoPercent(beneficiary, { from: owner });
        await apaCrowdsale.setFinalRate(rate);
      });

      it('does NOT buy tokens if crowdsale is paused', async () => {
        timer(dayInSecs * 42);
        await apaCrowdsale.pause();

        try {
          await apaCrowdsale.buyTokens(buyer, { value, from: buyer });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        let buyerPurchase = await apaCrowdsale.crowdsalePurchaseAmountBy.call(
          buyer
        );
        buyerPurchase.should.be.bignumber.equal(0);

        await apaCrowdsale.unpause();
        await apaCrowdsale.buyTokens(buyer, { value, from: buyer });

        buyerPurchase = await apaCrowdsale.crowdsalePurchaseAmountBy.call(
          buyer
        );

        buyerPurchase.should.be.bignumber.equal(value);
      });

      it('has bonus of 0% when sending less than 35 during the presale and NOT being an artist', async () => {
        await timer(50); // within presale period

        await apaCrowdsale.buyTokens(buyer2, { value: 1e18 });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(0); // 0% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      it('receives tokens with 0% bonus for the presale if sending less than 35 during the presale and NOT being an artist', async () => {
        await timer(50); // within presale period

        await apaCrowdsale.buyTokens(buyer2, { value: 1e18 });

        await timer(endTime + 30); // after the crowdsale

        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(50e18); // 0% bonus
      });

      it('has bonus of 25% if sending less than 35 during the presale and is an artist', async () => {
        await whitelistRegistryContract.whitelistArtist(buyer2);
        await timer(50); // within presale period

        await apaCrowdsale.buyTokens(buyer2, { value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(25); // 25% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      it('receives 25% bonus if sending less than 35 during the presale and is an artist', async () => {
        await whitelistRegistryContract.whitelistArtist(buyer2);
        await timer(50); // within presale period

        await apaCrowdsale.buyTokens(buyer2, { value: 1e18 });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(625e17); // 25% bonus
      });

      it('has bonus of 25% if sending 35 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(buyer, { value: 40e18 });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer); // buyer address
        buyerPurchaseInfo[1].should.be.bignumber.equal(25); // 25% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(40e18); // contributed with 40 wei
      });

      it('receives 25% bonus if sending 35 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(buyer, { value: 40e18 });

        await timer(endTime + 30); // after the crowdsale

        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(2500e18); // 40 * rate of 50 +  25% bonus
      });

      it('has bonus of 30% if sending 100 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser2, { value: 100e18 });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(purchaser2); // purchaser2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(30); // 30% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(100e18); // contributed with 100e18 wei
      });

      it('receives 30% bonus if sending 100 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser2, { value: 100e18 });

        await timer(endTime + 30); // after the crowdsale

        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(purchaser2);
        buyerBalance.should.be.bignumber.equal(6500e18); // 30% bonus
      });

      it('has bonus of 40% if sending 500 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser, { value: 500e18 });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(purchaser); // purchaser address
        buyerPurchaseInfo[1].should.be.bignumber.equal(40); // 40% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(500e18); // contributed with 500e18 wei
      });

      it('receives 40% bonus if sending 500 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser, { value: 500e18 });

        await timer(endTime + 30); // after the crowdsale

        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(purchaser);
        buyerBalance.should.be.bignumber.equal(35000e18); // 40% bonus
      });

      it('has bonus of 45% if sending 1000 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser2, { value: 1000e18 });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(purchaser2); // purchaser2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(45); // 45% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(1000e18); // contributed with 1000e18 wei
      });

      it('receives 45% bonus if sending 1000 or more ether during the presale', async () => {
        await timer(50); // within presale period
        await apaCrowdsale.buyTokens(purchaser2, { value: 1000e18 });

        await timer(endTime + 30); // after the crowdsale

        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(purchaser2);
        buyerBalance.should.be.bignumber.equal(72500e18); // 45% bonus
      });

      it('has bonus of 20% during first crowdsale bonus period', async () => {
        await timer(dayInSecs * 12);
        await apaCrowdsale.buyTokens(buyer2, { value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(20); // 20% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
        await timer(dayInSecs * 12);
        await apaCrowdsale.sendTransaction({ from: purchaser2, value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(purchaser2); // purchaser2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(20); // 20% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 10e18 wei
      });

      it('receives 20% bonus during as the first during the first crowdsale period', async () => {
        await timer(dayInSecs * 12);
        await apaCrowdsale.sendTransaction({ from: purchaser2, value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.sendTokensToPurchasers();

        const purchaserBalance = await apaToken.balanceOf(purchaser2);
        purchaserBalance.should.be.bignumber.equal(60e18); // 20% bonus
      });

      it('gives out 15% bonus during second crowdsale bonus period', async () => {
        await timer(dayInSecs * 22);
        await apaCrowdsale.buyTokens(buyer2, { value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(15); // 15% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      it('receives 15% bonus during second crowdsale bonus period', async () => {
        await timer(dayInSecs * 22);
        await apaCrowdsale.buyTokens(buyer2, { value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(575e17); // 15% bonus
      });

      it('provides 10% bonus during third crowdsale bonus period', async () => {
        timer(dayInSecs * 32);
        await apaCrowdsale.buyTokens(buyer2, { value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(10); // 10% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      it('receives 10% bonus during third crowdsale bonus period', async () => {
        timer(dayInSecs * 32);
        await apaCrowdsale.buyTokens(buyer2, { value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(55e18); // 10% bonus
      });

      it('provides 0% bonus after third crowdsale bonus period', async () => {
        timer(dayInSecs * 42);
        await apaCrowdsale.buyTokens(buyer2, { value });

        const buyerPurchaseInfo = await apaCrowdsale.crowdsalePurchases.call(0);
        buyerPurchaseInfo[0].should.be.equal(buyer2); // buyer2 address
        buyerPurchaseInfo[1].should.be.bignumber.equal(0); // 0% bonus
        buyerPurchaseInfo[2].should.be.bignumber.equal(value); // contributed with 1e18 wei
      });

      // Logic for the total token supply was removed

      // it('audit: the crowdsale should be available to the normal buyer even if TOTAL_SUPPLY_CROWDSALE has been reached before start of crowdsale', async function() {
      //   const TOTAL_SUPPLY_CROWDSALE = await apaCrowdsale.TOTAL_SUPPLY_CROWDSALE();
      //   const rate = 1;
      //
      //   await timer(dayInSecs * 42);
      //
      //   await apaCrowdsale.mintTokenForPrivateInvestors(
      //     buyer,
      //     rate,
      //     0,
      //     TOTAL_SUPPLY_CROWDSALE
      //   );
      //   await apaCrowdsale.mintTokenForPrivateInvestors(
      //     buyer,
      //     rate,
      //     0,
      //     TOTAL_SUPPLY_CROWDSALE
      //   );
      //
      //   const allTokens = await apaToken.totalSupply();
      //   allTokens.should.be.bignumber.equal(2 * TOTAL_SUPPLY_CROWDSALE);
      //
      //   const crashed = false;
      //
      //   try {
      //     await apaCrowdsale.buyTokens(buyer2, { value: 100 });
      //   } catch (e) {
      //     crashed = true;
      //   }
      //
      //   assert.equal(crashed, false, 'this might be intentional');
      //   await timer(endTime + 30);
      // });
      //
      // it('audit: the buyers should not exceed TOTAL_SUPPLY_CROWDSALE', async function() {
      //   const TOTAL_SUPPLY_CROWDSALE = await apaCrowdsale.TOTAL_SUPPLY_CROWDSALE();
      //   // for one wei you should receive the max amount of tokens (TOTAL_SUPPLY_CROWDSALE)
      //   await apaCrowdsale.setFinalRate(TOTAL_SUPPLY_CROWDSALE);
      //   await timer(dayInSecs * 42);
      //   await apaCrowdsale.buyTokens(buyer2, { value: 1 });
      //   await apaCrowdsale.buyTokens(buyer2, { value: 1 });
      //   await timer(endTime + 30); // after the crowdsale
      //   await apaCrowdsale.sendTokensToPurchasers();
      //   const allTokens = await apaToken.totalSupply();
      //   allTokens.should.be.bignumber.equal(TOTAL_SUPPLY_CROWDSALE);
      // });

      it('receives 0% bonus after third crowdsale bonus period', async () => {
        timer(dayInSecs * 42);
        // same user buying multiple times
        await apaCrowdsale.buyTokens(buyer2, { value });
        await apaCrowdsale.buyTokens(buyer2, { value: 2e18 });
        await apaCrowdsale.buyTokens(buyer2, { value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer2);
        buyerBalance.should.be.bignumber.equal(200e18); // 0% bonus
      });
    });

    describe('#mintTokenForPrivateInvestors', function() {
      it('does NOT mint tokens for an empty address', async () => {
        timer(50);

        try {
          await apaCrowdsale.mintTokenForPrivateInvestors(
            '0x0000000000000000000000000000000000000000',
            rate,
            0,
            value
          );
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const tokenSupply = await apaToken.totalSupply();
        tokenSupply.should.be.bignumber.equal(0);
      });

      it('mints tokens for private investors after crowdsale has started', async () => {
        timer(50);

        await apaCrowdsale.mintTokenForPrivateInvestors(buyer, rate, 0, value);

        const buyerBalance = await apaToken.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(50e18);
      });

      it('mints tokens to private investors before the crowdsale starts', async () => {
        const { logs } = await apaCrowdsale.mintTokenForPrivateInvestors(
          buyer,
          rate,
          0,
          value
        );

        const buyerBalance = await apaToken.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(50e18);

        const event = logs.find(
          e => e.event === 'PrivateInvestorTokenPurchase'
        );
        should.exist(event);
      });
    });

    describe('whitelisting', function() {
      // whitelist buyers
      it('should add address to whitelist', async () => {
        let whitelisted = await whitelistRegistryContract.isWhitelisted(sender);
        whitelisted.should.be.false;

        await whitelistRegistryContract.addToWhitelist(sender, {
          from: owner
        });
        whitelisted = await whitelistRegistryContract.isWhitelisted(sender);
        whitelisted.should.be.true;
      });

      it('should sell to whitelisted address', async () => {
        await whitelistRegistryContract.addToWhitelist(sender, {
          from: owner
        });
        timer(dayInSecs * 42);

        await apaCrowdsale.setTwoPercent(buyer);
        await apaCrowdsale.buyTokens(beneficiary, {
          value,
          from: sender
        }).should.be.fulfilled;
      });

      it('does NOT set a zero preferential rate ', async () => {
        try {
          await whitelistRegistryContract.setPreferantialRate(0);
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }
      });

      it('whitelists buyer rate with a preferential rate', async () => {
        await whitelistRegistryContract.addToWhitelist(buyer);
        await whitelistRegistryContract.setPreferantialRate(preferentialRate);

        const prefRate = await whitelistRegistryContract.preferentialRate();
        prefRate.should.be.bignumber.equal(preferentialRate);

        timer(dayInSecs * 42);

        await apaCrowdsale.setTwoPercent(buyer);
        await apaCrowdsale.buyTokens(buyer, { value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.setFinalRate(rate);
        await apaCrowdsale.sendTokensToPurchasers();

        const buyerBalance = await apaToken.balanceOf(buyer);
        buyerBalance.should.be.bignumber.equal(100e18); // 0% bonus

        const raised = await apaCrowdsale.weiRaised();
        raised.should.be.bignumber.equal(value);
      });

      it('cannot whitelists buyer rate for an empty address', async () => {
        try {
          await whitelistRegistryContract.setBuyerRate(
            '0x0000000000000000000000000000000000000000',
            200e18
          );
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }
      });

      it('whitelists buyer rate with custom rate', async () => {
        await whitelistRegistryContract.addToWhitelist(buyer);
        await whitelistRegistryContract.setBuyerRate(buyer, 200e18);

        timer(dayInSecs * 42);
        await apaCrowdsale.setTwoPercent(buyer);
        await apaCrowdsale.buyTokens(buyer, { value });

        await timer(endTime + 30); // after the crowdsale
        await apaCrowdsale.setFinalRate(rate);
        await apaCrowdsale.sendTokensToPurchasers();

        const balance = await apaToken.balanceOf.call(buyer);
        balance.should.be.bignumber.equal(2e38);

        const raised = await apaCrowdsale.weiRaised();
        raised.should.be.bignumber.equal(value);
      });

      // whitelisting artists
      it('does NOT allow a non owner to whitelist artist', async () => {
        try {
          await whitelistRegistryContract.whitelistArtist(beneficiary, {
            from: sender
          });
          assert.fail();
        } catch (error) {
          ensuresException(error);
        }

        const isArtist = await whitelistRegistryContract.isArtist(beneficiary);
        isArtist.should.be.false;
      });

      it('does NOT allow the whitelist of an artist if the address is empty', async () => {
        try {
          await whitelistRegistryContract.whitelistArtist(
            '0x0000000000000000000000000000000000000000',
            { from: sender }
          );
          assert.fail();
        } catch (error) {
          ensuresException(error);
        }

        const isArtist = await whitelistRegistryContract.isArtist(
          '0x0000000000000000000000000000000000000000'
        );
        isArtist.should.be.false;
      });

      it('allows the whitelisting of an artist by the contract owner not allow a non owner to whitelist artist', async () => {
        await whitelistRegistryContract.whitelistArtist(beneficiary, {
          from: owner
        });

        const isArtist = await whitelistRegistryContract.isArtist(beneficiary);
        isArtist.should.be.true;
      });
    });

    describe('teamAndAdvisorsAllocations', () => {
      beforeEach(async () => {
        unlockedTime = getBlockNow() + dayInSecs * 90; // three months from now
        canSelfDestruct = getBlockNow() + dayInSecs * 365; // one year from now
        numberOfTotalTokens = 40000000e18;

        apaCrowdsale = await newCrowdsale(rate);
        apaToken = AllPublicArtToken.at(await apaCrowdsale.token());
        lockTokenAllocations = await newLockTokenAllocation(
          owner,
          apaToken.address,
          unlockedTime,
          canSelfDestruct,
          numberOfTotalTokens
        );

        await timer(dayInSecs * 42);

        await apaCrowdsale.setTwoPercent(buyer);
        await apaCrowdsale.buyTokens(buyer, { value });

        await timer(dayInSecs * 22);

        await apaCrowdsale.mintTokensFor(
          lockTokenAllocations.address,
          numberOfTotalTokens
        );
        await apaCrowdsale.finalize();
      });

      it('assigns tokens correctly to contract', async function() {
        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(numberOfTotalTokens);
      });

      it('does NOT adds founder and their allocation when address is empty ', async function() {
        try {
          await lockTokenAllocations.addLockTokenAllocation(
            '0x0000000000000000000000000000000000000000',
            800
          );
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }
      });

      it('adds founder and their allocation', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );
        const allocatedTokens = await lockTokenAllocations.allocatedTokens();
        allocatedTokens.should.be.bignumber.equal(1800);

        const allocationsForFounder1 = await lockTokenAllocations.lockedAllocations.call(
          beneficiary
        );
        const allocationsForFounder2 = await lockTokenAllocations.lockedAllocations.call(
          sender
        );

        allocationsForFounder1.should.be.bignumber.equal(800);
        allocationsForFounder2.should.be.bignumber.equal(1000);
      });

      it('does NOT unlock founders allocation before the unlock period is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        try {
          await lockTokenAllocations.unlock({ from: beneficiary });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);
      });

      it('unlocks founders allocation after the unlock period is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        let tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);

        await timer(unlockedTime + 95);

        await lockTokenAllocations.unlock({ from: beneficiary });
        await lockTokenAllocations.unlock({ from: sender });

        const tokenBalanceFounder1 = await apaToken.balanceOf(beneficiary);

        const tokenBalanceFounder2 = await apaToken.balanceOf(sender);
        tokenBalanceFounder1.should.be.bignumber.equal(800);
        tokenBalanceFounder2.should.be.bignumber.equal(1000);
      });

      it('does NOT kill contract before one year is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        try {
          await lockTokenAllocations.kill();
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(numberOfTotalTokens);

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);
      });

      it('is able to kill contract after one year', async () => {
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);

        await timer(dayInSecs * 375); // 375 days after

        await lockTokenAllocations.kill();

        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(0);

        const balanceOwner = await apaToken.balanceOf(owner);
        balanceOwner.should.be.bignumber.equal(numberOfTotalTokens);
      });
    });

    describe('company Allocations', () => {
      beforeEach(async () => {
        unlockedTime = getBlockNow() + dayInSecs * 365; // three months from now
        canSelfDestruct = getBlockNow() + dayInSecs * 400; // one year from now
        numberOfTotalTokens = 40000000e18;

        apaCrowdsale = await newCrowdsale(rate);
        apaToken = AllPublicArtToken.at(await apaCrowdsale.token());
        lockTokenAllocations = await newLockTokenAllocation(
          owner,
          apaToken.address,
          unlockedTime,
          canSelfDestruct,
          numberOfTotalTokens
        );

        await timer(dayInSecs * 42);

        await apaCrowdsale.setTwoPercent(buyer);
        await apaCrowdsale.buyTokens(buyer, { value });

        await timer(dayInSecs * 60);

        await apaCrowdsale.mintTokensFor(
          lockTokenAllocations.address,
          numberOfTotalTokens
        );
        await apaCrowdsale.finalize();
      });

      it('assigns tokens correctly to contract', async function() {
        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(numberOfTotalTokens);
      });

      it('adds founder and their allocation', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );
        const allocatedTokens = await lockTokenAllocations.allocatedTokens();
        allocatedTokens.should.be.bignumber.equal(1800);

        const allocationsForFounder1 = await lockTokenAllocations.lockedAllocations.call(
          beneficiary
        );
        const allocationsForFounder2 = await lockTokenAllocations.lockedAllocations.call(
          sender
        );

        allocationsForFounder1.should.be.bignumber.equal(800);
        allocationsForFounder2.should.be.bignumber.equal(1000);
      });

      it('does NOT unlock founders allocation before the unlock period is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        try {
          await lockTokenAllocations.unlock({ from: beneficiary });
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);
      });

      it('unlocks founders allocation after the unlock period is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        let tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);

        await timer(unlockedTime + 95);

        await lockTokenAllocations.unlock({ from: beneficiary });
        await lockTokenAllocations.unlock({ from: sender });

        const tokenBalanceFounder1 = await apaToken.balanceOf(beneficiary);

        const tokenBalanceFounder2 = await apaToken.balanceOf(sender);
        tokenBalanceFounder1.should.be.bignumber.equal(800);
        tokenBalanceFounder2.should.be.bignumber.equal(1000);
      });

      it('does NOT kill contract before one year is up', async function() {
        await lockTokenAllocations.addLockTokenAllocation(beneficiary, 800);
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        try {
          await lockTokenAllocations.kill();
          assert.fail();
        } catch (e) {
          ensuresException(e);
        }

        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(numberOfTotalTokens);

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);
      });

      it('is able to kill contract after one year', async () => {
        await lockTokenAllocations.addLockTokenAllocation.sendTransaction(
          sender,
          1000,
          { from: owner }
        );

        const tokensCreated = await lockTokenAllocations.tokensCreated();
        tokensCreated.should.be.bignumber.equal(0);

        await timer(dayInSecs * 405); // 405 days after

        await lockTokenAllocations.kill();

        const balance = await apaToken.balanceOf(
          await lockTokenAllocations.address
        );
        balance.should.be.bignumber.equal(0);

        const balanceOwner = await apaToken.balanceOf(owner);
        balanceOwner.should.be.bignumber.equal(numberOfTotalTokens);
      });
    });
  }
);
