'use strict';
import expectThrow from './helpers/expectThrow';
import toPromise from './helpers/toPromise';
const assertJump = require('./helpers/assertJump');
const RejectTokenMock = artifacts.require('./helpers/RejectTokenMock.sol');
const ForceEther = artifacts.require('../helpers/ForceEther.sol');
const ERC23TokenMock = artifacts.require('./helpers/ERC23TokenMock.sol');
const Ownable = artifacts.require('../contracts/ownership/Ownable.sol');

contract('RejectToken', function(accounts) {
  let token;
  
  beforeEach(async function() {
    // Create contract
    token = await RejectTokenMock.new(accounts[0], 100);
  });
  
  it('should return the correct totalSupply after construction', async function() {
    let totalSupply = await token.totalSupply();
    
    assert.equal(totalSupply, 100);
  });
  
  it('should return the correct allowance amount after approval', async function() {
    let token = await RejectTokenMock.new();
    await token.approve(accounts[1], 100);
    let allowance = await token.allowance(accounts[0], accounts[1]);
    
    assert.equal(allowance, 100);
  });
  
  it('should return correct balances after transfer', async function() {
    let token = await RejectTokenMock.new(accounts[0], 100);
    await token.transfer(accounts[1], 100);
    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    
    let balance1 = await token.balanceOf(accounts[1]);
    assert.equal(balance1, 100);
  });
  
  it('should throw an error when trying to transfer more than balance', async function() {
    let token = await RejectTokenMock.new(accounts[0], 100);
    try {
      await token.transfer(accounts[1], 101);
      assert.fail('should have thrown before');
    } catch(error) {
      assertJump(error);
    }
  });
  
  it('should return correct balances after transfering from another account', async function() {
    let token = await RejectTokenMock.new(accounts[0], 100);
    await token.approve(accounts[1], 100);
    await token.transferFrom(accounts[0], accounts[2], 100, {from: accounts[1]});
    
    let balance0 = await token.balanceOf(accounts[0]);
    assert.equal(balance0, 0);
    
    let balance1 = await token.balanceOf(accounts[2]);
    assert.equal(balance1, 100);
    
    let balance2 = await token.balanceOf(accounts[1]);
    assert.equal(balance2, 0);
  });
  
  it('should throw an error when trying to transfer more than allowed', async function() {
    await token.approve(accounts[1], 99);
    try {
      await token.transferFrom(accounts[0], accounts[2], 100, {from: accounts[1]});
      assert.fail('should have thrown before');
    } catch (error) {
      assertJump(error);
    }
  });
  
  describe('validating allowance updates to spender', function() {
    let preApproved;
    
    it('should start with zero', async function() {
      preApproved = await token.allowance(accounts[0], accounts[1]);
      assert.equal(preApproved, 0);
    })
    
    it('should increase by 50 then decrease by 10', async function() {
      await token.increaseApproval(accounts[1], 50);
      let postIncrease = await token.allowance(accounts[0], accounts[1]);
      preApproved.plus(50).should.be.bignumber.equal(postIncrease);
      await token.decreaseApproval(accounts[1], 10);
      let postDecrease = await token.allowance(accounts[0], accounts[1]);
      postIncrease.minus(10).should.be.bignumber.equal(postDecrease);
    })
  });
  
  it('should throw an error when trying to transfer to 0x0', async function() {
    let token = await RejectTokenMock.new(accounts[0], 100);
    try {
      let transfer = await token.transfer(0x0, 100);
      assert.fail('should have thrown before');
    } catch(error) {
      assertJump(error);
    }
  });
  
  it('should throw an error when trying to transferFrom to 0x0', async function() {
    let token = await RejectTokenMock.new(accounts[0], 100);
    await token.approve(accounts[1], 100);
    try {
      let transfer = await token.transferFrom(accounts[0], 0x0, 100, {from: accounts[1]});
      assert.fail('should have thrown before');
    } catch(error) {
      assertJump(error);
    }
  });
  
  describe('if the contract owns ether', function() {
    const amount = web3.toWei('1', 'ether');
    
    it('should not accept ether in constructor', async function() {
      await expectThrow(RejectTokenMock.new({value: amount}));
    });
    
    it('should not accept ether', async function() {
      let rejectToken = await RejectTokenMock.new();
      
      await expectThrow(
        toPromise(web3.eth.sendTransaction)({
          from: accounts[1],
          to: rejectToken.address,
          value: amount,
        }),
      );
    });
  
    it('should allow owner to reclaim ether', async function() {
      const startBalance = await web3.eth.getBalance(token.address);
      assert.equal(startBalance, 0);
  
      // Force ether into it
      let forceEther = await ForceEther.new({value: amount});
      await forceEther.destroyAndSend(token.address);
      const forcedBalance = await web3.eth.getBalance(token.address);
      assert.equal(forcedBalance, amount);
  
      // Reclaim
      const ownerStartBalance = await web3.eth.getBalance(accounts[0]);
      await token.reclaimEther();
      const ownerFinalBalance = await web3.eth.getBalance(accounts[0]);
      const finalBalance = await web3.eth.getBalance(token.address);
      assert.equal(finalBalance, 0);
      assert.isAbove(ownerFinalBalance, ownerStartBalance);
    });
  
    it('should allow only owner to reclaim ether', async function() {
      // Force ether into it
      let forceEther = await ForceEther.new({value: amount});
      await forceEther.destroyAndSend(token.address);
      const forcedBalance = await web3.eth.getBalance(token.address);
      assert.equal(forcedBalance, amount);
  
      // Reclaim
      await expectThrow(token.reclaimEther({from: accounts[1]}));
    });
  });
  
  describe('if the contract owns tokens', function() {
    let erc23Token;
    
    beforeEach(async function() {
      erc23Token = await ERC23TokenMock.new(accounts[0], 100);
      
      // Force token into contract
      await erc23Token.transfer(token.address, 10);
      const startBalance = await erc23Token.balanceOf(token.address);
      assert.equal(startBalance, 10);
    });
    
    it('should not accept ERC23 tokens', async function() {
      await expectThrow(erc23Token.transferERC23(token.address, 10, ''));
    });
    
    it('should allow owner to reclaim tokens', async function() {
      const ownerStartBalance = await erc23Token.balanceOf(accounts[0]);
      await token.reclaimToken(erc23Token.address);
      const ownerFinalBalance = await erc23Token.balanceOf(accounts[0]);
      const finalBalance = await erc23Token.balanceOf(token.address);
      assert.equal(finalBalance, 0);
      assert.equal(ownerFinalBalance - ownerStartBalance, 10);
    });
    
    it('should allow only owner to reclaim tokens', async function() {
      await expectThrow(
        token.reclaimToken(erc23Token.address, {from: accounts[1]}),
      );
    });
  });

  describe('if the contract owns another contract', function() {
    let ownable;
    
    beforeEach(async function() {
      ownable = await Ownable.new();
      
      // Force ownership into contract
      await ownable.transferOwnership(token.address);
      const ownerFirst = await ownable.owner();
      assert.equal(ownerFirst, token.address);
    });
    
    it('should allow owner to reclaim contracts', async function() {
      await token.reclaimContract(ownable.address);
      const owner = await ownable.owner();
      assert.equal(owner, accounts[0]);
    });
    
    it('should allow only owner to reclaim contracts', async function() {
      await expectThrow(
        token.reclaimContract(ownable.address, {from: accounts[1]}),
      );
    });
  });
  
});
