// TIEN404 V17.7H — inert Cloudflare staging placeholder.
// NO webhook, NO provider signatures/secrets, NO outbound operations,
// NO database, NO R2, NO routes, NO previews, NO traffic admission.
// Its only behavior on all HTTP methods/paths is an empty 404.
// This is not the V17.7G local fixture adapter; never import it here.
export default {
  async fetch() {
    return new Response(null, {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    });
  }
};
