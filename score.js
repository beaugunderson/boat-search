'use strict';

module.exports = function (boat) {
  var priceInteger = parseInt((boat.price || '').replace(/[\$,]/g, ''), 10) || 0;
  var yearInteger = parseInt((boat.year || ''), 10) || 0;
  var ratioFloat = parseFloat(boat.ratio || '', 10) || 0;
  var engineHoursInteger = parseInt(boat.engineHours || '', 10) || 0;
  var cruisingSpeedInteger = parseInt(boat.cruisingSpeed || '', 10) || 0;
  var fuelTanksInteger = parseInt(boat.fuelTanks || '', 10) || 0;
  var freshWaterTanksInteger = parseInt(boat.freshWaterTanks || '', 10) || 0;

  var points = 0;

  if (priceInteger >= 35000 && priceInteger <= 150000) {
    points += 1;
  }

  if (yearInteger < 1965 || yearInteger >= 2010) {
    points -= 1;
  }

  if (ratioFloat) {
    if (ratioFloat >= 0.35 && ratioFloat <= 0.40) {
      points += 2;
    } else if (ratioFloat >= 0.3 && ratioFloat < 0.35) {
      points += 1;
    } else if (ratioFloat <= 0.45 && ratioFloat > 0.4) {
      points += 1;
    }
  }

  if (engineHoursInteger >= 4000) {
    points -= 1;
  }

  if (engineHoursInteger > 0 && engineHoursInteger <= 1800) {
    points += 1;
  }

  if (cruisingSpeedInteger >= 7) {
    points += 2;
  }

  if (cruisingSpeedInteger === 6) {
    points += 1;
  }

  if (fuelTanksInteger >= 100) {
    points += 1;
  }

  if (freshWaterTanksInteger >= 100) {
    points += 1;
  }

  if ((/full/i).test(boat.keel)) {
    points += 2;
  }

  if ((/fin/i).test(boat.keel || '')) {
    points += 1;
  }

  if ((/3 blade/i).test(boat.propeller)) {
    points += 2;
  }

  if ((/folding/i).test(boat.propeller)) {
    points += 1;
  }

  if ((/ta shing|wauquiez|valiant|pacific seacraft|tayana|perry|freya/i).test(boat.title)) {
    points += 2;
  }

  if ((/hans christian|ericson/i).test(boat.title)) {
    points += 1;
  }

  if ((/sale pending/i).test(boat.location)) {
    points -= 1;
  }

  if (!(/fiberglass|wood/i).test(boat.hull)) {
    points -= 1;
  }

  if ((/cutter/i).test(boat.title) ||
      (/cutter/i).test(boat.type)) {
    points += 3;
  }

  if ((/seattle|wa,/i).test(boat.location)) {
    points += 2;
  }

  if ((/los angeles|dana point|huntington beach|santa barbara|ventura|long beach|newport beach|redondo beach|marina del rey|wilmington/i)
      .test(boat.location)) {
    points += 1;
  }

  return points;
};
