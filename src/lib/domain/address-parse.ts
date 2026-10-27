/**
 * Splits a saved gym address ("Via Roma 12, 16162 Genova", "Via Roma, Genova GE, Italy") into the three parts the
 * Manager's position card asks for — street, house number and city — best effort: anything it cannot place is left
 * empty rather than guessed.
 */
export interface AddressParts {
  street: string;
  number: string;
  city: string;
}

export function parseAddress(address: string | null): AddressParts {
  if (!address) return { street: '', number: '', city: '' };
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  const first = parts[0] ?? '';
  const match = /^(.*?)\s+(\d+\s?[a-zA-Z]?(?:\/\w{1,2})?)$/.exec(first);
  const street = match?.[1]?.trim() ?? first;
  const number = match?.[2]?.replace(/\s+/g, '') ?? '';
  const city =
    parts
      .slice(1)
      .map((p) => p.replace(/^\d{5}\s*/, '').replace(/\s+[A-Z]{2}$/, '').trim())
      .find((p) => p.length >= 2 && !/^(italy|italia)$/i.test(p)) ?? '';
  return { street, number, city };
}
