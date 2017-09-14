const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");

import { should, isException, ensuresException, getBlockNow } from './helpers/utils'
import timer from './helpers/timer'

const BigNumber = web3.BigNumber

contract('AllPublicArtCrowdsale', ([owner, wallet, buyer, purchaser, buyer2, purchaser2, beneficiary, sender]) => {
    const rate = new BigNumber(50)
    const cap = new BigNumber(1000e+18)

    const preferentialRate = new BigNumber(100)
    const value = 1e+18
    const dayInSecs = 86400

    const expectedCompanyTokens = new BigNumber(14375e+15)
    const expectedTokenSupply = new BigNumber(71875e+15)

    let startTime, endTime
    let apaCrowdsale, apaToken

    beforeEach('initialize contract', async () => {
        startTime = getBlockNow() + 20 // crowdsale starts in 20 seconds
        endTime = getBlockNow() + dayInSecs * 60 // 60 days

        apaCrowdsale = await AllPublicArtCrowdsale.new(
            startTime,
            endTime,
            rate,
            cap,
            preferentialRate,
            wallet
        )

        apaToken = AllPublicArtToken.at(await apaCrowdsale.token())
    })

  it('has a cap', async () => {
      const crowdsaleCap = await apaCrowdsale.cap()
      crowdsaleCap.toNumber().should.equal(cap.toNumber())
  });

  it('has a normal crowdsale rate', async () => {
      const crowdsaleRate = await apaCrowdsale.rate()
      crowdsaleRate.toNumber().should.equal(rate.toNumber())
  })

  it('assigns tokens correctly to company when finalized', async function () {
    timer(20)

    await apaCrowdsale.buyTokens(buyer, {value, from: purchaser})

    timer(endTime + 30)
    await apaCrowdsale.finalize()

    const companyAllocation = await apaCrowdsale.companyAllocation()
    const balance = await apaToken.balanceOf(companyAllocation)
    balance.should.be.bignumber.equal(expectedCompanyTokens)

    const buyerBalance = await apaToken.balanceOf(buyer)
    buyerBalance.should.be.bignumber.equal(575e+17) // 15% bonus

    const totalSupply = await apaToken.totalSupply()
    totalSupply.should.be.bignumber.equal(expectedTokenSupply)
  })

  describe('bonus purchases', () => {
      it('has bonus of 15% during the first 7 days of the crowdsale', async () => {
          timer(50) // within the first seven days
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(575e+17) // 15% bonus
      })

      it('is also able to buy tokens with bonus by sending ether to the contract directly', async () => {
          timer(50) // within the first seven days
          await apaCrowdsale.sendTransaction({ from: purchaser2, value })

          const purchaserBalance = await apaToken.balanceOf(purchaser2)
          purchaserBalance.should.be.bignumber.equal(575e+17) // 15% bonus
      })

      it('gives out 10% bonus during the second 7 days of the crowdsale', async () => {
          timer(dayInSecs * 8) // 8 days after start of the crowdsale - within the second seven days
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(55e+18) // 10% bonus
      })

      it('provides 5% bonus during the third 7 days of the crowdsale', async () => {
          timer(dayInSecs * 15) // 15 days after start of the crowdsale - within the third seven days
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(525e+17) // 5% bonus
      })

      it('provides 0% bonus after the third 7 days of the crowdsale ends', async () => {
          timer(dayInSecs * 22) // 21 days after start of the crowdsale - no bonus given
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(50e+18) // 0% bonus
      })

      it('whitelist addresses gets 20% bonus', async () => {
          await apaCrowdsale.addToWhitelist(buyer2)
          timer(dayInSecs * 22) // does not matter which point in time the crowdsale is
          await apaCrowdsale.buyTokens(buyer2, { value })

          const buyerBalance = await apaToken.balanceOf(buyer2)
          buyerBalance.should.be.bignumber.equal(120e+18) // 0% bonus
      })
  })

  describe('whitelisting', () => {
      it('should add address to whitelist', async () => {
          let whitelisted = await apaCrowdsale.isWhitelisted(sender)
          whitelisted.should.equal(false)

          await apaCrowdsale.addToWhitelist(sender, {from: owner})
          whitelisted = await apaCrowdsale.isWhitelisted(sender)
          whitelisted.should.equal(true)
      })

      it('should reject non-whitelisted sender', async () => {
          timer(20)

          try {
              await apaCrowdsale.buyTokens(beneficiary, {value, from: sender})
          } catch(error) {
              ensuresException(error)
          }
      })

      it('should sell to whitelisted address', async () => {
          await apaCrowdsale.addToWhitelist(sender, {from: owner})
          timer(20)
          await apaCrowdsale.buyTokens(beneficiary, {value, from: sender}).should.be.fulfilled
      })

      it('whitelists buyer rate with a preferential rate', async () => {
          await apaCrowdsale.addToWhitelist(buyer)
          await apaCrowdsale.setPreferantialRate(preferentialRate)

          const prefRate = await apaCrowdsale.preferentialRate()
          prefRate.should.be.bignumber.equal(preferentialRate)

          timer(20)

          await apaCrowdsale.buyTokens(buyer, { value })
          const balance = await apaToken.balanceOf.call(buyer)
          balance.should.be.bignumber.equal(120e+18)

          const raised = await apaCrowdsale.weiRaised();
          raised.should.be.bignumber.equal(value)
      })

      it('whitelists buyer rate with custom rate', async () => {
          await apaCrowdsale.addToWhitelist(buyer)
          await apaCrowdsale.setBuyerRate(buyer, 200e+18)

          timer(20)

          await apaCrowdsale.buyTokens(buyer, { value })
          const balance = await apaToken.balanceOf.call(buyer)
          balance.should.be.bignumber.equal(2.4e+38)

          const raised = await apaCrowdsale.weiRaised();
          raised.should.be.bignumber.equal(value)
      })
  })
});
