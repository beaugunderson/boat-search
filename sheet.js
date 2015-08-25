'use strict';

var Spreadsheet = require('edit-google-spreadsheet');
var _ = require('lodash');

module.exports = function (cb) {
  Spreadsheet.load({
    debug: true,
    spreadsheetId: process.env.SPREADSHEET_KEY,
    // worksheetName: '',
    worksheetId: process.env.WORKSHEET_ID,
    oauth: {
      email: process.env.OAUTH_EMAIL,
      keyFile: 'google-oauth.pem'
    }
  },
  function (loadError, spreadsheet) {
    if (loadError) {
      throw loadError;
    }

    spreadsheet.receive(function (receiveError, rows, info) {
      if (receiveError) {
        throw receiveError;
      }

      var columns = {};
      var indexes = {};

      _.forEach(rows['1'], function (value, key) {
        var camel = _.camelCase(value);

        indexes[parseInt(key, 10)] = camel;
        columns[camel] = parseInt(key, 10);
      });

      // remove the header row
      delete rows['1'];

      var ids = _(rows)
        .map(function (row) {
          return parseInt(row['1'], 10);
        })
        .compact()
        .map(String)
        .uniq()
        .value();

      cb(spreadsheet, rows, info, ids, indexes, columns);
    });
  });
};
