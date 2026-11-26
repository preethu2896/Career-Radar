// The browser SDK sends x-client-info on authenticated function requests.
export const catalogueCorsHeaders = {
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'GET, POST, OPTIONS',
 'access-control-allow-headers':'authorization,apikey,content-type,x-client-info',
};
