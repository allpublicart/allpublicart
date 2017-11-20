const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const CompanyAllocation = artifacts.require("./CompanyAllocation.sol");

import { should, ensuresException, getBlockNow } from './helpers/utils'
import timer from './helpers/timer'

const BigNumber = web3.BigNumber

contract('AllPublicArtCrowdsale', ([owner, wallet, buyer, purchaser, buyer2, purchaser2, beneficiary, sender, founder1, founder2]) => {
    const rate = new BigNumber(50)
    const newRate =  new BigNumber(400000000); // 375M APA tokens per 1 eth

    const preferentialRate = new BigNumber(100)
    const value = 1e+18
    const dayInSecs = 86400

    const expectedCompanyTokens = new BigNumber(600000000e+18)
    const expectedTokenSupply = new BigNumber(1000000000e+18)

    let startTime, endTime
    let preSaleEnds, firstBonusSalesEnds, secondBonusSalesEnds, thirdBonusSalesEnds
    let apaCrowdsale, apaToken
    let companyAllocationsContract

    const newCrowdsale = (rate) => {
        startTime = getBlockNow() + 20 // crowdsale starts in 20 seconds
        preSaleEnds = getBlockNow() + dayInSecs * 10 // 10 days
        firstBonusSalesEnds = getBlockNow() + dayInSecs * 20 // 20 days
        secondBonusSalesEnds = getBlockNow() + dayInSecs * 30 // 30 days
        thirdBonusSalesEnds = getBlockNow() + dayInSecs * 40 // 40 days
        endTime = getBlockNow() + dayInSecs * 60 // 60 days

        return AllPublicArtCrowdsale.new(
            startTime,
            preSaleEnds,
            firstBonusSalesEnds,
            secondBonusSalesEnds,
            thirdBonusSalesEnds,
            endTime,
            rate,
            preferentialRate,
            wallet
        )
    }

  beforeEach('initialize contract', async () => {
      apaCrowdsale = await newCrowdsale(rate)
      apaToken = AllPublicArtToken.at(await apaCrowdsale.token())
  })


  it('has a normal crowdsale rate', async () => {
      const crowdsaleRate = await apaCrowdsale.rate()
      crowdsaleRate.toNumber().should.equal(rate.toNumber())
  })

  it('starts with token paused', async () => {
      const paused = await apaToken.paused()
      paused.should.equal(true)
  })

  it('token is unpaused after crowdsale ends', async function () {
      timer(endTime + 30)

      let paused = await apaToken.paused()
      paused.should.be.true

      await apaCrowdsale.finalize()

      paused = await apaToken.paused()
      paused.should.be.false
  })

  it('assigns tokens correctly to company when finalized', async function () {
      apaCrowdsale = await newCrowdsale(newRate)
      apaToken = AllPublicArtToken.at(await apaCrowdsale.token())

      await timer(dayInSecs * 42)

      await apaCrowdsale.buyTokens(buyer, {value, from: purchaser})

      await timer(endTime + 30)
      await apaCrowdsale.finalize()

      const companyAllocation = await apaCrowdsale.companyAllocation()
      const balance = await apaToken.balanceOf(companyAllocation)
      balance.should.be.bignumber.equal(expectedCompanyTokens)

      const buyerBalance = await apaToken.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(400000000e+18)

      const totalSupply = await apaToken.totalSupply()
      totalSupply.should.be.bignumber.equal(expectedTokenSupply)
  })

  it('assigns remaining tokens to company if not all tokens are sold during crowdsale', async function () {
      const fictiousRate =  new BigNumber(300000000);
      apaCrowdsale = await newCrowdsale(fictiousRate)
      apaToken = AllPublicArtToken.at(await apaCrowdsale.token())

      await timer(dayInSecs * 42)

      await apaCrowdsale.buyTokens(buyer, {value, from: purchaser})

      await timer(endTime + 30)
      await apaCrowdsale.finalize()

      const companyAllocation = await apaCrowdsale.companyAllocation()
      const balance = await apaToken.balanceOf(companyAllocation)
      balance.should.be.bignumber.equal(700000000e+18)

      const buyerBalance = await apaToken.balanceOf(buyer)
      buyerBalance.should.be.bignumber.equal(300000000e+18)

      const totalSupply = await apaToken.totalSupply()
      totalSupply.should.be.bignumber.equal(expectedTokenSupply)
  })

  describe('forward funds', () => {
      it('does not allow non-owners to set twoPercent beneficiary', async () => {
          timer(20)

          try {
              await apaCrowdsale.setTwoPercent(buyer, {from: buyer})
              assert.fail()
          } catch (e) {
              ensuresException(e)
          }
          const twoPercent = await apaCrowdsale.twoPercent.call()
          twoPercent.should.be.equal('0x0000000000000000000000000000000000000000')
      })

      it('owner is able to set twoPercent', async () => {
          timer(20)
          await apaCrowdsale.setTwoPercent(beneficiary, {from: owner})
          const twoPercent = await apaCrowdsale.twoPercent.call()
          twoPercent.should.be.equal(beneficiary)
      })

      it('twoPercent beneficiary is not able to be set more than once', async () => {
          timer(20)
          await apaCrowdsale.setTwoPercent(beneficiary, {from: owner})

          try {
              await apaCrowdsale.setTwoPercent(buyer, {from: owner})
              assert.fail()
          } catch (e) {
              ensuresException(e)
          }

          const twoPercent = await apaCrowdsale.twoPercent.call()
          twoPercent.should.be.equal(beneficiary)
      })

      it('takes 2 percent of the purchase funds and assigns it to one percent beneficiary', async () => {
          await timer(dayInSecs * 42)
          await apaCrowdsale.setTwoPercent(beneficiary, {from: owner})
          const beneficiaryBalance = web3.eth.getBalance(beneficiary)

          await apaCrowdsale.buyTokens(buyer, {value, from: purchaser})

          const beneficiaryNewBalance = web3.eth.getBalance(beneficiary)
          const twoPercentOfValue = value * 2 / 100
          const calculateUpdatedBalance = beneficiaryBalance.toNumber() + twoPercentOfValue

          calculateUpdatedBalance.should.be.bignumber.equal(beneficiaryNewBalance)
          beneficiaryNewBalance.should.be.bignumber.above(beneficiaryBalance)
      })

      it('assigns 98 percent of the funds to wallet', async () => {
          await timer(dayInSecs * 42)
          const wallet = await apaCrowdsale.wallet()
          const walletBalance = web3.eth.getBalance(wallet)

          await apaCrowdsale.buyTokens(buyer, {value, from: purchaser})

          const walletNewBalance = web3.eth.getBalance(wallet)
          const ninetyEightPercentValue = value * 98 / 100
          const calculateUpdatedBalance = walletBalance.toNumber() + ninetyEightPercentValue

          calculateUpdatedBalance.should.be.bignumber.equal(walletNewBalance)
          walletNewBalance.should.be.bignumber.above(walletBalance)
      })
  })

  describe('token purchases plus their bonuses', () => {
      it('does NOT buy tokens if crowdsale is paused', async () => {
          timer(dayInSecs * 40)
          await apaCrowdsale.pause()
          let buyerBalance

          try {
              await apaCrowdsale.buyTokens(buyer, { value, from: buyer })
              assert.fail()
          } catch(e) {
              ensuresException(e)
          }

          buyerBalance = await apaToken.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(0)

          await apaCrowdsale.unpause()
          await apaCrowdsale.buyTokens(buyer, { value, from: buyer })

          buyerBalance = await apaToken.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(50e+18)
      })

      it('has bonus of 0% when sending less than 35 during the presale and NOT being an artist', async () => {
          await timer(50) // within presale period

          await apaCrowdsale.buyTokens(buyer2, { value: 1e+18 })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(50e+18) // 0% bonus
      })

      it('has bonus of 20% if sending less than 35 during the presale and is an artist', async () => {
          await apaCrowdsale.whitelistArtist(buyer2)
          await timer(50) // within presale period

          await apaCrowdsale.buyTokens(buyer2, { value: 1e+18 })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(60e+18) // 20% bonus
      })

      it('has bonus of 25% if sending 35+ ether during the presale', async () => {
          await timer(50) // within presale period
          await apaCrowdsale.buyTokens(buyer, { value: 40e+18 })

          const buyerBalance = await apaToken.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(2500e+18) // 40 * rate of 50 +  25% bonus
      })

      it.skip('has bonus of 30% if sending 100+ ether during the presale', async () => {
          await timer(50) // within presale period
          await apaCrowdsale.buyTokens(purchaser2, { value: 100e+18 })

          const buyerBalance = await apaToken.balanceOf(purchaser2)
          buyerBalance.should.be.bignumber.equal(6500e+18) // 30% bonus
      })

      it.skip('has bonus of 40% if sending 500+ ether during the presale', async () => {
          await timer(50) // within presale period
          await apaCrowdsale.buyTokens(purchaser2, { value: 500e+18 })

          const buyerBalance = await apaToken.balanceOf(purchaser2)
          buyerBalance.should.be.bignumber.equal(35000e+18) // 40% bonus
      })

      it.skip('has bonus of 45% if sending 500+ ether during the presale', async () => {
          await timer(50) // within presale period
          await apaCrowdsale.buyTokens(purchaser2, { value: 1000e+18 })

          const buyerBalance = await apaToken.balanceOf(purchaser2)
          buyerBalance.should.be.bignumber.equal(72500e+18) // 45% bonus
      })

      it('has bonus of 20% during first crowdsale bonus period', async () => {
          await timer(dayInSecs * 12)
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(60e+18) // 20% bonus
      })

      it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
          await timer(dayInSecs * 12)
          await apaCrowdsale.sendTransaction({ from: purchaser2, value })

          const purchaserBalance = await apaToken.balanceOf(purchaser2)
          purchaserBalance.should.be.bignumber.equal(60e+18) // 20% bonus
      })

      it('gives out 15% bonus during second crowdsale bonus period', async () => {
          await timer(dayInSecs * 22)
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(575e+17) // 15% bonus
      })

      it('provides 10% bonus during third crowdsale bonus period', async () => {
          timer(dayInSecs * 32)
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(55e+18) // 10% bonus
      })

      it('provides 0% bonus after third crowdsale bonus period', async () => {
          timer(dayInSecs * 42)
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(50e+18) // 0% bonus
      })
  })

  describe('#mintTokenForPrivateInvestors', function () {
      it('does NOT mint tokens for private investors after crowdsale has started', async () => {
          timer(50)

          try {
              await apaCrowdsale.mintTokenForPrivateInvestors(buyer, rate, 0,  value)
              assert.fail()
          } catch(e) {
              ensuresException(e)
          }
          const buyerBalance = await apaToken.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(0)
      })

      it('mints tokens to private investors before the crowdsale starts', async () => {
          const { logs } = await apaCrowdsale.mintTokenForPrivateInvestors(buyer, rate, 0,  value)

          const buyerBalance = await apaToken.balanceOf(buyer)
          buyerBalance.should.be.bignumber.equal(50e+18)

          const event = logs.find(e => e.event === 'PrivateInvestorTokenPurchase')
          should.exist(event)
      })
  })

  describe('whitelisting', function () {
      // whitelist buyers
      it('should add address to whitelist', async () => {
          let whitelisted = await apaCrowdsale.isWhitelisted(sender)
          whitelisted.should.be.false

          await apaCrowdsale.addToWhitelist(sender, {from: owner})
          whitelisted = await apaCrowdsale.isWhitelisted(sender)
          whitelisted.should.be.true
      })

      it('should sell to whitelisted address', async () => {
          await apaCrowdsale.addToWhitelist(sender, {from: owner})
          timer(dayInSecs * 42)
          await apaCrowdsale.buyTokens(beneficiary, {value, from: sender}).should.be.fulfilled
      })

      it('whitelists buyer rate with a preferential rate', async () => {
          await apaCrowdsale.addToWhitelist(buyer)
          await apaCrowdsale.setPreferantialRate(preferentialRate)

          const prefRate = await apaCrowdsale.preferentialRate()
          prefRate.should.be.bignumber.equal(preferentialRate)

          timer(dayInSecs * 42)

          await apaCrowdsale.buyTokens(buyer, { value })
          const balance = await apaToken.balanceOf.call(buyer)
          balance.should.be.bignumber.equal(100e+18)

          const raised = await apaCrowdsale.weiRaised();
          raised.should.be.bignumber.equal(value)
      })

      it('whitelists buyer rate with custom rate', async () => {
          await apaCrowdsale.addToWhitelist(buyer)
          await apaCrowdsale.setBuyerRate(buyer, 200e+18)

          timer(dayInSecs * 42)

          await apaCrowdsale.buyTokens(buyer, { value })
          const balance = await apaToken.balanceOf.call(buyer)
          balance.should.be.bignumber.equal(2e+38)

          const raised = await apaCrowdsale.weiRaised();
          raised.should.be.bignumber.equal(value)
      })

     // whitelisting artists
     it('does NOT allow a non owner to whitelist artist', async () => {
         try {
             await apaCrowdsale.whitelistArtist(beneficiary, { from: sender } )
             assert.fail()
         } catch(error) {
             ensuresException(error)
         }

         const isArtist = await apaCrowdsale.isArtist(beneficiary)
         isArtist.should.be.false
     })

     it('does NOT allow the whitelist of an artist if the address is empty', async () => {
         try {
             await apaCrowdsale.whitelistArtist('0x0000000000000000000000000000000000000000', { from: sender } )
             assert.fail()
         } catch(error) {
             ensuresException(error)
         }

         const isArtist = await apaCrowdsale.isArtist('0x0000000000000000000000000000000000000000')
         isArtist.should.be.false
     })

     it('allows the whitelisting of an artist by the contract owner not allow a non owner to whitelist artist', async () => {
        await apaCrowdsale.whitelistArtist(beneficiary, { from: owner } )

         const isArtist = await apaCrowdsale.isArtist(beneficiary)
         isArtist.should.be.true
     })
  })

  describe('companyAllocations', () => {
      beforeEach(async () => {
          apaCrowdsale = await newCrowdsale(newRate)
          apaToken = AllPublicArtToken.at(await apaCrowdsale.token())

          timer(dayInSecs * 42)

          await apaCrowdsale.buyTokens(buyer, {value})

          await timer(dayInSecs * 70)
          await apaCrowdsale.finalize()

          const companyAllocations = await apaCrowdsale.companyAllocation()
          companyAllocationsContract = CompanyAllocation.at(companyAllocations)
      })

      it('assigns tokens correctly CompanyAllocation contract', async function () {
          const balance = await apaToken.balanceOf(await companyAllocationsContract.address)
          balance.should.be.bignumber.equal(expectedCompanyTokens)
      })

      it('adds founder and their allocation', async function () {
          await companyAllocationsContract.addCompanyAllocation(founder1, 800)
          await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})
          const allocatedTokens = await companyAllocationsContract.allocatedTokens()
          allocatedTokens.should.be.bignumber.equal(1800)

          const allocationsForFounder1 = await companyAllocationsContract.companyAllocations.call(founder1)
          const allocationsForFounder2 = await companyAllocationsContract.companyAllocations.call(founder2)
          allocationsForFounder1.should.be.bignumber.equal(800)
          allocationsForFounder2.should.be.bignumber.equal(1000)
      })

      it('does NOT unlock founders allocation before the unlock period is up', async function () {
          await companyAllocationsContract.addCompanyAllocation(founder1, 800)
          await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})

          try {
              await companyAllocationsContract.unlock({from: founder1})
              assert.fail()
          } catch(e) {
              ensuresException(e)
          }

          const tokensCreated = await companyAllocationsContract.tokensCreated()
          tokensCreated.should.be.bignumber.equal(0)
      })

      it('unlocks founders allocation after the unlock period is up', async function () {
          let tokensCreated
          await companyAllocationsContract.addCompanyAllocation(founder1, 800)
          await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})

          tokensCreated = await companyAllocationsContract.tokensCreated()
          tokensCreated.should.be.bignumber.equal(0)

          await timer(dayInSecs * 400)

          await companyAllocationsContract.unlock({from: founder1})
          await companyAllocationsContract.unlock({from: founder2})

          const tokenBalanceFounder1 = await apaToken.balanceOf(founder1)
          const tokenBalanceFounder2 = await apaToken.balanceOf(founder2)
          tokenBalanceFounder1.should.be.bignumber.equal(800)
          tokenBalanceFounder2.should.be.bignumber.equal(1000)
      })

      it('does NOT kill contract before one year is up', async function () {
          await companyAllocationsContract.addCompanyAllocation(founder1, 800)
          await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})

          try {
              await companyAllocationsContract.kill()
              assert.fail()
          } catch(e) {
              ensuresException(e)
          }

          const balance = await apaToken.balanceOf(await companyAllocationsContract.address)
          balance.should.be.bignumber.equal(expectedCompanyTokens)

          const tokensCreated = await companyAllocationsContract.tokensCreated()
          tokensCreated.should.be.bignumber.equal(0)
      })

      it('is able to kill contract after one year', async () => {
          await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})

          const tokensCreated = await companyAllocationsContract.tokensCreated()
          tokensCreated.should.be.bignumber.equal(0)

          await timer(dayInSecs * 700) // 700 days after

          await companyAllocationsContract.kill()

          const balance = await apaToken.balanceOf(await companyAllocationsContract.address)
          balance.should.be.bignumber.equal(0)

          const balanceOwner = await apaToken.balanceOf(owner)
          balanceOwner.should.be.bignumber.equal(expectedCompanyTokens)
      })
  })
});
