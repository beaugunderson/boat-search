'use strict';

var async = require('async');
var cheerio = require('cheerio');
var request = require('request');
var sheet = require('./sheet.js');
var _ = require('lodash');

// TODO: DRY
function text(string) {
  return string.replace(/[\n\t\u00A0 ]+/g, ' ').trim();
}

var specs = exports.specs = function (url, cb) {
  request.get(url, function (err, response, body) {
    if (err) {
      return cb(err);
    }

    var $ = cheerio.load(body);

    var s = _.compact($('.fullspecs').text().split('\n').map(function (spec) {
      return spec.trim();
    }));

    var data = {};

    var nameIndex = s.indexOf('Boat Name');

    if (nameIndex !== -1) {
      data['Boat Name'] = s[nameIndex + 1];
    }

    s.forEach(function (spec) {
      if (spec.indexOf(':') !== -1) {
        var parts = spec.split(':');

        var trimmed = parts[1].trim();

        if (trimmed !== '') {
          data[parts[0].trim()] = trimmed;
        }
      }
    });

    function gallons(string) {
      var matches = (/(\d+) *gallons/i).exec(string || '');

      if (matches) {
        return parseInt(matches[1], 10);
      }
    }

    function knots(string) {
      var matches = (/^(\d+)/).exec(string || '');

      if (matches) {
        return parseInt(matches[1], 10);
      }
    }

    var boatName = _.trim(text(data['Boat Name'] || ''), '"').trim();

    if ((/^[^a-z ']+$/).test(boatName) ||
        (/^[^A-Z ']+$/).test(boatName)) {
      boatName = _.startCase(boatName.toLowerCase());
    }

    var specsObject = {};

    specsObject.ballast = parseInt(data.Ballast || '', 10) || '';
    specsObject.boatName = boatName;
    specsObject.cruisingSpeed = knots(data['Cruising Speed']) || '';
    specsObject.displacement = parseInt(data.Displacement || '', 10) || '';
    specsObject.engineHours = parseInt(data['Engine Hours'] || '', 10) || '';
    specsObject.enginePower = parseInt(data['Engine Power'] || '', 10) || '';
    specsObject.freshWaterTanks = gallons(data['Fresh Water Tanks']) || '';
    specsObject.fuelTanks = gallons(data['Fuel Tanks']) || '';
    specsObject.keel = data.Keel || '';
    specsObject.loa = data.LOA || '';
    specsObject.maximumSpeed = knots(data['Maximum Speed']) || '';
    specsObject.propeller = (data.Propeller || '')
      .replace(/ propeller/, '')
      .toLowerCase();

    if (specsObject.ballast > 0 && specsObject.displacement > 0) {
      specsObject.ratio = specsObject.ballast / specsObject.displacement;
    }

    cb(null, specsObject);
  });
};

// XXX: unused
exports.sheetSpecs = function (cb) {
  sheet(function (spreadsheet, rows) {
    var slice = _.slice(_.toArray(rows), 1, 101);

    async.mapLimit(slice, 7, function (row, cbMapSeries) {
      var matches = (/"(http:.*?)"/i).exec(row['4']);

      if (!matches) {
        return cbMapSeries(new Error('no URL found'));
      }

      var url = matches[1];

      specs(url, function (err, data) {
        process.stdout.write('.');

        cbMapSeries(err, data);
      });
    }, function (err, data) {
      cb(err, data);
    });
  });
};
