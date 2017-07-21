function compactInteger(input) {
  var decimals = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

  decimals = Math.max(decimals, 0);
  var number = parseInt(input, 10);
  var signString = number < 0 ? '-' : '';
  var unsignedNumber = Math.abs(number);
  var unsignedNumberString = String(unsignedNumber);
  var numberLength = unsignedNumberString.length;
  var numberLengths = [13, 10, 7, 4];
  var bigNumPrefixes = ['T', 'B', 'M', 'k'];

  // small numbers
  if (unsignedNumber < 1000) {
    return '' + signString + unsignedNumberString;
  }

  // really big numbers
  if (numberLength > numberLengths[0] + 3) {
    return number.toExponential(decimals).replace('e+', 'x10^');
  }

  // 999 < unsignedNumber < 999,999,999,999,999
  var length = void 0;
  for (var i = 0; i < numberLengths.length; i++) {
    var _length = numberLengths[i];
    if (numberLength >= _length) {
      length = _length;
      break;
    }
  }

  var decimalIndex = numberLength - length + 1;
  var unsignedNumberCharacterArray = unsignedNumberString.split('');

  var wholePartArray = unsignedNumberCharacterArray.slice(0, decimalIndex);
  var decimalPartArray = unsignedNumberCharacterArray.slice(decimalIndex, decimalIndex + decimals + 1);

  var wholePart = wholePartArray.join('');

  // pad decimalPart if necessary
  var decimalPart = decimalPartArray.join('');
  if (decimalPart.length < decimals) {
    decimalPart += '' + Array(decimals - decimalPart.length + 1).join('0');
  }

  var output = void 0;
  if (decimals === 0) {
    output = '' + signString + wholePart + bigNumPrefixes[numberLengths.indexOf(length)];
  } else {
    var outputNumber = Number(wholePart + '.' + decimalPart).toFixed(decimals);
    output = '' + signString + outputNumber + bigNumPrefixes[numberLengths.indexOf(length)];
  }

  return output;
};

