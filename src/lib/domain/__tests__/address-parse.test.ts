import { parseAddress } from '../address-parse';

describe('parseAddress', () => {
  it('splits street, number and city', () => {
    expect(parseAddress('via torino 10, Genova')).toEqual({ street: 'via torino', number: '10', city: 'Genova' });
  });
  it('drops postcode, province and country', () => {
    expect(parseAddress('Via Roma 12, 16162 Genova')).toEqual({ street: 'Via Roma', number: '12', city: 'Genova' });
    expect(parseAddress('Via Roma, Genova GE, Italy')).toEqual({ street: 'Via Roma', number: '', city: 'Genova' });
  });
  it('keeps street names that contain digits', () => {
    expect(parseAddress('Via 4 Novembre 5, Milano')).toEqual({ street: 'Via 4 Novembre', number: '5', city: 'Milano' });
  });
  it('handles empty input', () => {
    expect(parseAddress(null)).toEqual({ street: '', number: '', city: '' });
    expect(parseAddress('Via Uno')).toEqual({ street: 'Via Uno', number: '', city: '' });
  });
});
