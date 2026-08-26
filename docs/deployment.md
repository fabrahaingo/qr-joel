# Deployment

## Hosts

| Host | Serves | Origin |
| --- | --- | --- |
| `links.joel-officiel.fr` | QR codes, messenger redirects, person pages | this application |
| `www.joel-officiel.fr` | marketing site, legal pages | OVHcloud static hosting |
| `umami.joel-officiel.fr` | analytics | self-hosted Umami |

Both public hosts sit on the same Cloudflare zone.

## Moving person pages onto the main domain

Person pages render on whichever host serves this application. They are worth
moving to `www.joel-officiel.fr/personne/...` because search engines treat a
subdomain as a separate site: consolidating on `www` reuses the reputation the
marketing site has already accumulated, along with its sitemap and its
`Organization` structured data.

That move is a Cloudflare configuration change, not a code change, and the
application is written so the two can be sequenced safely.

### Order of operations

The application defaults to serving and linking person pages on its own host.
Switch it over only once the routing is proven, otherwise every canonical URL
and redirect points at a 404.

1. **Prove the route first.** Add an origin rule for a throwaway path, for
   example `/_joel-probe`, pointing at this application's origin, and confirm
   `https://www.joel-officiel.fr/_joel-probe` reaches it. Getting this wrong
   takes down `www`, so do not start with the real path.
2. **Add the real origin rules.** Match these path prefixes and send them to
   this origin:
   - `/personne/*`
   - `/personnes` and `/personnes/*`
   - `/sitemap-personnes-*.xml`

   Each rule needs **both** a DNS record override and an HTTP `Host` header
   override. The header override alone only relabels the request; the DNS
   override is what actually reroutes it.

   Do **not** route `/sitemap.xml` or `/robots.txt` to this origin: those are
   served by the static site and would shadow it.
3. **Add a cache rule** on `/personne/*` marking it eligible for cache and
   respecting the origin TTL. Cloudflare does not cache HTML by default, and
   without this the origin sits in the path of every crawler request.
4. **Point the application at the new origin** by setting:

   ```
   PERSON_PAGE_ORIGIN=https://www.joel-officiel.fr
   ```

   Canonical URLs, the sitemap and internal links follow this value.
5. **Only then**, enable the legacy redirect:

   ```
   REDIRECT_LEGACY_NAME=true
   ```

   `?name=` links then answer `301` to the canonical person page. Printed QR
   codes keep working, because that page carries the QR code and the messenger
   buttons too.
6. **Update the static site's `sitemap.xml`** into a sitemap index that also
   references `https://www.joel-officiel.fr/sitemap-personnes-1.xml`.

### Rolling back

Unset `REDIRECT_LEGACY_NAME` and `PERSON_PAGE_ORIGIN`. The application returns
to serving and linking person pages on its own host, and the Cloudflare rules
become inert.

## Container

The image runs as the unprivileged `node` user, contains no build toolchain,
and never writes to its own directory. It therefore runs with a read-only root
filesystem:

```sh
docker run --rm -p 3000:3000 --env-file .env \
  --read-only --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --init \
  qr-joel
```

`FONTCONFIG_FILE` is set at build time and the file generated then, which is
what removes the last write to the application directory.

## Being a good neighbour to JORFSearch

JORFSearch is run by one volunteer and carries no service commitment. The
application is built to keep its load low, and those limits are not optional
decoration:

| Control | Value |
| --- | --- |
| Request timeout | 3 s |
| Retries | 1, with jittered backoff, honouring `Retry-After` |
| Concurrent upstream requests | 4 |
| Circuit breaker | opens for 60 s after 5 consecutive failures |
| Daily request ceiling | 20 000 |
| Positive cache | 6 h, served stale for 7 days |
| Negative cache | 1 h |

Requests carry a `User-Agent` naming the project and a contact address, so the
maintainer can reach us rather than block us.

`GET /status/jorf` reports live counters: cache hits, coalesced requests,
actual upstream calls, remaining daily budget and breaker state. Check it after
any traffic change.
