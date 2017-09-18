const AllPublicArtCrowdsale = artifacts.require("./AllPublicArtCrowdsale.sol");
const AllPublicArtToken = artifacts.require("./AllPublicArtToken.sol");
const CompanyAllocation = artifacts.require("./CompanyAllocation.sol");

const { should, getBlockNow, ensuresException } = require('./helpers/utils')
const timer = require('./helpers/timer')

const BigNumber = web3.BigNumber

contract('CompanyAllocation', ([owner, wallet, buyer, founder1, founder2]) => {
    const rate = new BigNumber(50)
    const cap = new BigNumber(1000e+18)

    const preferentialRate = new BigNumber(100)
    const value = 1e+18
    const dayInSecs = 86400

    const expectedCompanyTokens = new BigNumber(14375e+15)

    let startTime, endTime
    let crowdsale, token
    let companyAllocationsContract

    beforeEach('initialize crowdsale contract', async () => {
        startTime = getBlockNow() + 10

        endTime = getBlockNow() + (dayInSecs * 60) // 60 days

        crowdsale = await AllPublicArtCrowdsale.new(
            startTime,
            endTime,
            rate,
            cap,
            preferentialRate,
            wallet
        )
        token = AllPublicArtToken.at(await crowdsale.token())
    })

    describe('companyAllocations', () => {
        beforeEach(async () =>{
            await timer(20)

            await crowdsale.buyTokens(buyer, {value})

            await timer(dayInSecs * 70)
            await crowdsale.finalize()

            const companyAllocations = await crowdsale.companyAllocation()
            companyAllocationsContract = CompanyAllocation.at(companyAllocations)
        })

        it('assigns tokens correctly CompanyAllocation contract', async function () {
            const balance = await token.balanceOf(await companyAllocationsContract.address)
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

            await timer(dayInSecs * 40)

            await companyAllocationsContract.unlock({from: founder1})
            await companyAllocationsContract.unlock({from: founder2})

            const tokenBalanceFounder1 = await token.balanceOf(founder1)
            const tokenBalanceFounder2 = await token.balanceOf(founder2)
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

            const balance = await token.balanceOf(await companyAllocationsContract.address)
            balance.should.be.bignumber.equal(expectedCompanyTokens)

            const tokensCreated = await companyAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)
        })

        it('is able to kill contract after one year', async () => {
            await companyAllocationsContract.addCompanyAllocation.sendTransaction(founder2, 1000, {from: owner})

            const tokensCreated = await companyAllocationsContract.tokensCreated()
            tokensCreated.should.be.bignumber.equal(0)

            await timer(dayInSecs * 400) // 400 days after

            await companyAllocationsContract.kill()

            const balance = await token.balanceOf(await companyAllocationsContract.address)
            balance.should.be.bignumber.equal(0)

            const balanceOwner = await token.balanceOf(owner)
            balanceOwner.should.be.bignumber.equal(expectedCompanyTokens)
        })
    })
});
