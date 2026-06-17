# Delivery Zones API (for n8n)

Endpoint for the n8n bot workflow to look up delivery fees/ETAs by city, or
list all delivery zones for a tenant.

## Auth
Same as the other `/api/v1/*` endpoints — send the shared secret as a header:

```
x-api-key: <FLOWBOT_API_KEY>
```

`FLOWBOT_API_KEY` must be set in the app's environment variables.

## GET /api/v1/delivery

### Lookup fee for a city
```
GET /api/v1/delivery?tenant_id=<tenant_id>&city=Dehiwala
```

Response (match found):
```json
{
  "zone": {
    "id": "...",
    "tenant_id": "...",
    "province": "Western",
    "district": "Colombo",
    "cities": ["Dehiwala", "Mount Lavinia"],
    "fee": 350,
    "estimated_days": "1-2",
    "free_delivery_threshold": 5000,
    "is_active": true
  }
}
```

Response (no match, or zone inactive):
```json
{ "zone": null }
```

### List all zones for a tenant
```
GET /api/v1/delivery?tenant_id=<tenant_id>
```

Response:
```json
{ "zones": [ { "id": "...", "province": "Western", ... }, ... ] }
```

## n8n setup
1. **HTTP Request** node, method `GET`.
2. URL: `https://<your-app-domain>/api/v1/delivery`
3. Query params: `tenant_id` (from your tenant config), `city` (extracted
   from the customer's message).
4. Header: `x-api-key` = `{{$env.FLOWBOT_API_KEY}}` (or however you store it
   in n8n credentials).
5. Use `{{$json.zone.fee}}`, `{{$json.zone.estimated_days}}`, and
   `{{$json.zone.free_delivery_threshold}}` in the bot's reply. If
   `zone` is `null`, fall back to a "we don't deliver there yet / contact us"
   message.
