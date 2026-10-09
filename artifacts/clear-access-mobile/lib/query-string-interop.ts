import queryString from 'query-string';

// The workspace pins query-string 9 for security updates. Expo Router 57
// expects the older named-export shape, so expose v9's default API as names.
export const exclude = queryString.exclude;
export const extract = queryString.extract;
export const parse = queryString.parse;
export const parseUrl = queryString.parseUrl;
export const pick = queryString.pick;
export const stringify = queryString.stringify;
export const stringifyUrl = queryString.stringifyUrl;

export default queryString;
