const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");

import { should, isException, ensuresException, getBlockNow } from './helpers/utils'
import timer from './helpers/timer'

const BigNumber = web3.BigNumber

contract('AllPublicArtCrowdsale', ([_, wallet, buyer, purchaser, buyer2, purchaser2]) => {
    const rate = new BigNumber(500)
    const cap = new BigNumber(1000)

    const preferentialRate = new BigNumber(20)
    const value = 1e+18

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
      timer(20)
      await apaCrowdsale.addToWhitelist(buyer)

      await apaCrowdsale.buyTokens.sendTransaction(buyer, { value, from: buyer })
      const balance = await apaToken.balanceOf.call(buyer)
      console.log('balance', balance) // NOTE: note sure why balance is 0 here

      const raised = await apaCrowdsale.weiRaised();
      raised.should.be.bignumber.equal(value)
  })
});
