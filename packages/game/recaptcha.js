/**
 * Created by horyu1234 on 2017-11-14.
 */

const request = require('request');
const GLOBAL = require('../../config/global.json');
 
exports.verifyRecaptcha = (responseToken, remoteIp) => {
  return new Promise((resolve) => {
    const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${GLOBAL.GOOGLE_RECAPTCHA_SECRET_KEY}&response=${responseToken}&remoteip=${remoteIp}`;
    request(verifyUrl, (err, response, body) => {
      try {
        const responseBody = JSON.parse(body);
        resolve(responseBody.success);
      } catch (e) {
        resolve(false);
      }
    });
  });
};