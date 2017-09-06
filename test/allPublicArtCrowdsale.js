const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");

const { isException, ensuresException, getBlockNow } = require('./helpers/utils')
const expect = require('chai').expect
const should = require('should')

const BigNumber = web3.BigNumber

contract('AllPublicArtCrowdsale', ([_, wallet, buyer, purchaser, buyer2, purchaser2]) => {
    const rate = new BigNumber(500)
    const goal = new BigNumber(900)
    const cap = new BigNumber(1000)

    let startTime, endTime
    let apaCrowdsale, apaToken

    beforeEach('initialize contract', async () => {
        startTime = getBlockNow() + 80
        endTime = getBlockNow() + 86400 * 20 // 20 days

        apaCrowdsale = await AllPublicArtCrowdsale.new(
            startTime,
            endTime,
            rate,
            goal,
            cap,
            wallet
        )
        apaToken = AllPublicArtToken.new()
    })

  it('has a cap', async () => {
      const crowdsaleCap = await apaCrowdsale.cap()
      crowdsaleCap.toNumber().should.equal(cap.toNumber())
  });
});
