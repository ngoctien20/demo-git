const destinations = new Set(['/kenh-ban', '/hoi-thoai', '/don-hang', '/san-pham']);
export function returnRoute(hash) {
  const route = hash.replace(/^#/, '');
  return destinations.has(route) ? route : '/';
}

export function callbackUrl(href) {
  const url = new URL(href);
  return url.origin + url.pathname;
}

export function chooseShop(stores, chosenId) {
  return stores.find(s => s.id === chosenId) ?? (stores.length === 1 ? stores[0] : null);
}
