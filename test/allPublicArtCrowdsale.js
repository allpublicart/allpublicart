const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");

import { should, isException, ensuresException, getBlockNow } from './helpers/utils'
import timer from './helpers/timer'

const BigNumber = web3.BigNumber

contract('AllPublicArtCrowdsale', ([owner, wallet, buyer, purchaser, buyer2, purchaser2, beneficiary, sender]) => {
    const rate = new BigNumber(50)
    const cap = new BigNumber(1000)

    const preferentialRate = new BigNumber(20)
    const value = 1

    const expectedCompanyTokens = new BigNumber(14)
    const expectedTokenSupply = new BigNumber(71)

    let startTime, endTime
    let apaCrowdsale, apaToken

    beforeEach('initialize contract', async () => {
        startTime = getBlockNow() + 20
        endTime = getBlockNow() + 86400 * 20 // 20 days

        apaCrowdsale = await AllPublicArtCrowdsale.new(
            startTime,
            endTime,
            rate,
            cap,
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

  it('whitelists buyer rate with a preferential rate', async () => {
      await apaCrowdsale.addToWhitelist(buyer)
      await apaCrowdsale.setPreferantialRate(preferentialRate)

      const prefRate = await apaCrowdsale.preferentialRate()
      prefRate.should.be.bignumber.equal(preferentialRate)

      timer(20)

      await apaCrowdsale.buyTokens(buyer, { value })
      const balance = await apaToken.balanceOf.call(buyer)
      balance.should.be.bignumber.equal(24)

      const raised = await apaCrowdsale.weiRaised();
      raised.should.be.bignumber.equal(value)
  })

  it('whitelists buyer rate with custom rate', async () => {
      await apaCrowdsale.addToWhitelist(buyer)
      await apaCrowdsale.setBuyerRate(buyer, 200)

      timer(20)

      await apaCrowdsale.buyTokens(buyer, { value })
      const balance = await apaToken.balanceOf.call(buyer)
      balance.should.be.bignumber.equal(240)

      const raised = await apaCrowdsale.weiRaised();
      raised.should.be.bignumber.equal(value)
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
    buyerBalance.should.be.bignumber.equal(57)

    const totalSupply = await apaToken.totalSupply()
    totalSupply.should.be.bignumber.equal(expectedTokenSupply)
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
  })
});
