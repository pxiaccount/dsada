# drive-data-analyst

A conversational data analyst agent built with the Mistral Agents SDK and
deployed as a managed deployment on Mistral Cloud.

Give it a link to a CSV file in your Google Drive and ask questions in plain
language. It fetches the file through your Google Drive connector
(`google_drive_mcp`), then answers with fixed, typed tools — no arbitrary code
execution:

- `data.load_csv` — load the fetched CSV into the session
- `data.describe_columns` — types, missing values, uniques, basic statistics
- `data.filter_rows` — count and sample rows matching conditions
- `data.groupby_aggregate` — count/sum/mean/median/min/max/std/nunique per group

The session keeps the conversation and the loaded dataset, so follow-up
questions work without re-explaining.

## Run locally

```bash
uv sync
export MISTRAL_API_KEY="..."
uv run agents chat
```

## Deploy

The deployment builds the `Dockerfile` from the pushed commit:

```bash
git add -A && git commit -m "Add drive-data-analyst" && git push
uv run agents deploy
```

The agent acts on behalf of the session user through the Google Drive
connector, so the deployment is hardened. Chat with the deployed agent:

```bash
uv run agents chat drive-data-analyst
```
