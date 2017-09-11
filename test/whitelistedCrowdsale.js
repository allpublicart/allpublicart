import { ether, ensuresException, getBlockNow } from './helpers/utils'

const BigNumber = web3.BigNumber

const WhitelistedCrowdsale = artifacts.require('./WhitelistedCrowdsaleMock.sol')
const MintableToken = artifacts.require('zeppelin-solidity/contracts/tokens/MintableToken')

contract('WhitelistedCrowdsale', function ([_, owner, wallet, beneficiary, sender]) {
  const rate = new BigNumber(1000)

  beforeEach(async function () {
    this.startTime = getBlockNow() + 10

    this.endTime = getBlockNow() + (86400 * 20) // 20 days

    this.crowdsale = await WhitelistedCrowdsale.new(this.startTime, this.endTime, rate, wallet, {from: owner})

    this.token = MintableToken.at(await this.crowdsale.token())
  })

  describe('whitelisting', function () {
    const amount = 1e+18

    it('should add address to whitelist', async function () {
      let whitelisted = await this.crowdsale.isWhitelisted(sender)
      whitelisted.should.equal(false)
      await this.crowdsale.addToWhitelist(sender, {from: owner})
      whitelisted = await this.crowdsale.isWhitelisted(sender)
      whitelisted.should.equal(true)
    })

    it('should reject non-whitelisted sender', async function () {
      try {
          await this.crowdsale.buyTokens(beneficiary, {value: amount, from: sender})
      } catch(error) {
          ensuresException(error)
      }
    })

    it('should sell to whitelisted address', async function () {
      await this.crowdsale.addToWhitelist(sender, {from: owner})
      await this.crowdsale.buyTokens(beneficiary, {value: amount, from: sender}).should.be.fulfilled
    })
  })
})
