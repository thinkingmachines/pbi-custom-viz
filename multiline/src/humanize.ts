const exists = maybe => typeof maybe !== 'undefined' && maybe !== null;

function compactInteger (input, decimals = 0) {
  decimals = Math.max(decimals, 0);
  const number = parseInt(input, 10);
  const signString = number < 0 ? '-' : '';
  const unsignedNumber = Math.abs(number);
  const unsignedNumberString = String(unsignedNumber);
  const numberLength = unsignedNumberString.length;
  const numberLengths = [13, 10, 7, 4];
  const bigNumPrefixes = ['T', 'B', 'M', 'k'];

  // small numbers
  if (unsignedNumber < 1000) {
    return `${ signString }${ unsignedNumberString }`;
  }

  // really big numbers
  if (numberLength > numberLengths[0] + 3) {
    return number.toExponential(decimals).replace('e+', 'x10^');
  }

  // 999 < unsignedNumber < 999,999,999,999,999
  let length;
  for (let i = 0; i < numberLengths.length; i++) {
    const _length = numberLengths[i];
    if (numberLength >= _length) {
      length = _length;
      break;
    }
  }

  const decimalIndex = numberLength - length + 1;
  const unsignedNumberCharacterArray = unsignedNumberString.split('');

  const wholePartArray = unsignedNumberCharacterArray.slice(0, decimalIndex);
  const decimalPartArray = unsignedNumberCharacterArray.slice(decimalIndex, decimalIndex + decimals + 1);

  const wholePart = wholePartArray.join('');

  // pad decimalPart if necessary
  let decimalPart = decimalPartArray.join('');
  if (decimalPart.length < decimals) {
    decimalPart += `${ Array(decimals - decimalPart.length + 1).join('0') }`;
  }

  let output;
  if (decimals === 0) {
    output = `${ signString }${ wholePart }${ bigNumPrefixes[numberLengths.indexOf(length)] }`;
  } else {
    const outputNumber = Number(`${ wholePart }.${ decimalPart }`).toFixed(decimals);
    output = `${ signString }${ outputNumber }${ bigNumPrefixes[numberLengths.indexOf(length)] }`;
  }

  return output;
}

function formatNumber (number, precision = 0, thousand = ',', decimal = '.') {
  // Create some private utility functions to make the computational
  // code that follows much easier to read.
  const firstComma = (_number, _thousand, _position) => {
    return _position ? _number.substr(0, _position) + _thousand : '';
  };

  const commas = (_number, _thousand, _position) => {
    return _number.substr(_position).replace(/(\d{3})(?=\d)/g, `$1${_thousand}`);
  };

  const decimals = (_number, _decimal, usePrecision) => {
    return usePrecision
      ? _decimal + toFixed(Math.abs(_number), usePrecision).split('.')[1]
      : '';
  };

  const usePrecision = normalizePrecision(precision);

  // Do some calc
  const negative = number < 0 && '-' || '';
  const base = String(parseInt(toFixed(Math.abs(number || 0), usePrecision), 10));
  const mod = base.length > 3 ? base.length % 3 : 0;

  // Format the number
  return (
    negative +
    firstComma(base, thousand, mod) +
    commas(base, thousand, mod) +
    decimals(number, decimal, usePrecision)
  );
}

function toFixed (value, precision) {
  precision = exists(precision) ? precision : normalizePrecision(precision, 0);
  const power = Math.pow(10, precision);

  // Multiply up by precision, round accurately, then divide and use native toFixed()
  return (Math.round(value * power) / power).toFixed(precision);
}

function normalizePrecision (value, base = 10) {
  value = Math.round(Math.abs(value));
  return isNaN(value) ? base : value;
}
