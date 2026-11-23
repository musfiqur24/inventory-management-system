import {test} from 'node:test';
import assert from 'node:assert/strict';
import {passwordResetLink} from '../src/services/passwordResetEmail.js';
test('password reset tokens stay in the browser fragment, outside server URLs',()=>{
 const url=new URL(passwordResetLink('private-reset-token','https://127.0.0.1/reset-password?token=old'));
 assert.equal(url.searchParams.get('token'),null);
 assert.equal(new URLSearchParams(url.hash.slice(1)).get('token'),'private-reset-token');
 assert.equal(url.pathname,'/reset-password');
});
