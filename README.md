# qr-joel

QR code and deep-link gateway for [JOEL](https://www.joel-officiel.fr), the
Journal Officiel nomination alert service. Serves `links.joel-officiel.fr`.

Given a person, an organisation or a function tag, it renders a landing page
that deep-links the visitor into the JOEL bot on their messenger of choice, and
generates a branded QR code pointing at that page.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /` | Landing page. Takes one of `name`, `organisation_id` or `function_tag`. |
| `GET /qrcode` | PNG QR code. Same follow parameters, plus `size` and `frame`. |
| `GET /whatsapp`, `/telegram`, `/matrix`, `/tchap` | Redirect to the bot. |
| `GET /status` | Health check. |

The three follow parameters are mutually exclusive:

- `name` — a person, at least two words, for example `?name=Elisabeth%20Borne`
- `organisation_id` — a Wikidata entity id, for example `?organisation_id=Q643290`
- `function_tag` — a JORFSearch function tag, for example `?function_tag=ministre`

`verify` controls whether the value is checked against JORFSearch before use.
It defaults to on, and only `false` or `0` turns it off. Verification is always
required for organisations, since the display name comes from the lookup.

## Environment variables

At least one messenger must be configured, otherwise the server refuses to
start:

- `TELEGRAM_BOT_NAME`
- `WHATSAPP_BOT_PHONE_NUMBER`
- `MATRIX_BOT_USERNAME`
- `TCHAP_BOT_USERNAME`

Required unless `NODE_ENV=development`:

- `UMAMI_HOST`
- `UMAMI_ID`

Optional:

- `NODE_ENV` — `development` serves on port 8080 instead of 3000 and relaxes
  the Umami requirement.
- `FONTCONFIG_FILE` — path to an existing fontconfig file. When set, the server
  does not generate one, which lets the container run with a read-only root
  filesystem. The Docker image sets this.

## Development

```sh
npm install
NODE_ENV=development npm start     # http://localhost:8080
npm run build                      # tsc -p tsconfig.build.json
npm run lint
npm test
```

## Docker

```sh
docker build -t qr-joel .
docker run --rm -p 3000:3000 --env-file .env \
  --read-only --tmpfs /tmp \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --init \
  qr-joel
```

The image runs as the unprivileged `node` user and contains no build toolchain:
`sharp` ships its own prebuilt libvips, so no system image libraries are
installed.
