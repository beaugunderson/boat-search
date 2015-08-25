'use strict';

var async = require('async');
var cheerio = require('cheerio');
var linear = require('d3-scale').linear;
var moment = require('moment');
var request = require('request');
var sheet = require('./sheet.js');
var score = require('./score.js');
var specs = require('./data.js').specs;
var _ = require('lodash');

var searchUrl = 'http://www.yachtworld.com/core/listing/cache/searchResults.jsp';
var fromDate = moment().subtract(10, 'days').valueOf();

var searchOptions = {
  // Ntt: '',
  // city: '',
  // fromPrice: '',
  // fromYear: '',
  // is: '',
  // man: '',
  // toPrice: '',
  // toYear: '',
  // ybw: '',
  boatsAddedSelected: 5,
  cit: true,
  currencyid: 100,
  enid: 0,
  fracts: 1,
  fromLength: 34,
  ftid: 0,
  hmid: 0,
  luom: 126,
  Ntk: 'boatsEN',
  pbsint: fromDate,
  rid: [107, 108],
  searchtype: 'advancedsearch',
  slim: 'quick',
  sm: 3,
  toLength: 42,
  type: '(Sail)'
};

var now = moment().format('M/D/YYYY h:mma');

function text(string) {
  return string.replace(/[\n\t\u00A0 ]+/g, ' ').trim();
}

function filter(result) {
  var price = parseInt(result.price.replace(/[\$,]/g, ''), 10);

  return price < 200000 &&
    (/fraser|farr|alajuela|morgan|c *(and|&) *c|j boats|cheoy lee|jeanneau|beneteau|catalina|catamaran|hunter|ketch|pilothouse|cent(er|re) cockpit/i)
      .test(result.title) === false &&
    (/australia/i).test(result.location) === false &&
    (/steel|aluminum|ferro-cement/i).test(result.hull) === false &&
    (/catamaran|multi-hull|pilothouse|ketch|center cockpit|schooner|yawl/i)
      .test(result.type) === false;
}

function page(number, cb) {
  if (number > 0) {
    searchOptions.No = number;
  }

  request.get({
    url: searchUrl,
    qs: searchOptions,
    useQuerystring: true
  }, function (err, response, body) {
    if (err) {
      return cb(err);
    }

    var $ = cheerio.load(body);
    var $rows = $('div#searchResultsDetailsRow');

    var rows = [];

    $rows.each(function () {
      var $row = $(this);

      var url = 'http://www.yachtworld.com' +
        $row.find('#searchResultsDetailsRowTitle a').attr('href');

      var matches = /-(\d+)(\/|$)/.exec(url);
      var id;

      if (matches) {
        id = matches[1];
      } else {
        console.log('non-matching url', url);
      }

      var titleText = text($row.find('#searchResultsDetailsRowTitle a').text());

      var title = '=HYPERLINK("' + url + '", "' + titleText + '")';
      var location = text($row.find('.searchResultsDetailsDataTable').text());
      var price = text($row.find('#searchResultsDetailsRowPrice').text())
        .replace(/^US/, '');

      var $data = $row.find('#searchResultsDetailsData1 .searchResultTableInfo');

      var type = $data.get(0) && text($($data.get(0)).text());
      var hull = $data.get(1) && text($($data.get(1)).text());

      var cutter = 'No';

      if ((/cutter/i).test(title) ||
          (/cutter/i).test(type)) {
        cutter = 'Yes';
      }

      matches = (/^(\d+) ft/i).exec(titleText);
      var boatLength = '';

      if (matches) {
        boatLength = matches[1];
      }

      matches = /\d{4}/.exec(titleText);
      var year = '';

      if (matches) {
        year = matches[0];
      }

      rows.push({
        id: id,
        added: now,
        listingAge: '',
        title: title,
        cutter: cutter,
        boatLength: boatLength,
        year: year,
        price: price,
        location: location
          .replace(/, united states/i, '')
          .replace(/, canada/i, ''),
        type: type,
        hull: hull
      });
    });

    async.mapLimit(rows, 5, function (row, cbMapLimit) {
      var matches = (/"(http:.*?)"/i).exec(row.title);

      specs(matches[1], function (specsError, data) {
        process.stdout.write('.');

        row = _.assign(row, data);

        cbMapLimit(err, row);
      });
    }, function (specsError, specRows) {
      console.log();

      cb(err, specRows);
    });
  });
}

var previousResultsLength;
var pageCount = 0;
var results = [];

function convert(object, dictionary) {
  var out = {};

  _.forEach(object, function (value, key) {
    if (dictionary[key]) {
      out[dictionary[key]] = value;
    } else {
      console.log('key not found', key);
    }
  });

  return out;
}

async.doWhilst(function (cbDoWhilst) {
  console.log('getting page', pageCount);

  page(pageCount++ * 10, function (err, rows) {
    if (err) {
      return cbDoWhilst(err);
    }

    previousResultsLength = rows.length || 0;
    results = results.concat(rows);

    cbDoWhilst();
  });
}, function () {
  return previousResultsLength !== 0;
}, function (err) {
  if (err) {
    throw err;
  }

  var dateScale = linear()
    .domain([
      _.min(results, 'id').id,
      _.max(results, 'id').id
    ])
    .range([
      fromDate,
      moment().valueOf()
    ]);

  results.forEach(function (result) {
    // for one-time backfill
    // var days = 91 + Math.round((2836769 - parseInt(result.id, 10)) / 340);
    // var dateString = moment().subtract(days, 'days').format('M/D/YYYY');
    // result.listingAge = '=DATEDIF(DATEVALUE("' + dateString + '"), NOW(), "D")';

    // if (days >= 180) {
    //   result.points -= 1;
    // }

    var dateString = moment(dateScale(result.id)).format('M/D/YYYY');

    result.listingAge = '=DATEDIF(DATEVALUE("' + dateString + '"), NOW(), "D")';
    result.points = score(result);
  });

  sheet(function (spreadsheet, rows, info, ids, indexes, columns) {
    var pairs = _.pairs(rows);

    // re-score and re-filter old rows
    async.eachLimit(pairs, 5, function (pair, cbEachLimit) {
      var object = convert(pair[1], indexes);

      if (!filter(object)) {
        object.pass = 'Yes';
      }

      if (object.ballast ||
          object.boatName ||
          object.cruisingSpeed ||
          object.displacement ||
          object.engineHours ||
          object.enginePower ||
          object.freshWaterTanks ||
          object.fuelTanks ||
          object.keel ||
          object.loa ||
          object.maximumSpeed ||
          object.propeller) {
        console.log('skipping %d', object.id);

        object.points = score(object);

        rows[pair[0]] = convert(object, columns);

        return setImmediate(cbEachLimit);
      }

      var matches = (/"(http:.*?)"/i).exec(object.title);

      specs(matches[1], function (specsError, data) {
        process.stdout.write('r');

        if (!specsError && data) {
          object = _.assign(object, data);
        }

        // re-score if there's new data
        object.points = score(object);

        rows[pair[0]] = convert(object, columns);

        cbEachLimit();
      });
    }, function () {
      console.log();
      console.log('filtering %d results', results.length);

      results = _.reject(results, function (result) {
        return _.contains(ids, result.id);
      });

      console.log('found %d new results', results.length);

      results = results.filter(filter);

      console.log('found %d that passed our filters', results.length);

      var count = info.lastRow;

      results.forEach(function (result) {
        rows[++count] = convert(result, columns);
      });

      spreadsheet.add(rows);

      spreadsheet.send(function (sendError) {
        if (sendError) {
          throw sendError;
        }
      });
    });
  });
});
