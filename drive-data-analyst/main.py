"""Conversational data analyst for CSV files stored in Google Drive.

The agent fetches a CSV through the user's Google Drive connector, then answers
plain-language questions with fixed, sandbox-free tools: load the data,
describe its columns, filter rows and compute group-by aggregates. There is no
arbitrary code execution: every tool is a fixed, typed operation.
"""

from __future__ import annotations

import io
from typing import Annotated, Any, Literal

import pandas as pd
from pydantic import BaseModel, Field

from mistralai import agents


class Filter(BaseModel):
    """One condition applied to a column before rows are counted or aggregated."""

    column: str = Field(description="Column name to filter on, exactly as loaded.")
    operator: Literal[
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "greater_or_equal",
        "less_or_equal",
        "contains",
        "starts_with",
        "ends_with",
        "in",
        "not_in",
        "is_null",
        "not_null",
    ] = Field(description="Comparison to apply to the column's value.")
    value: Any = Field(
        default=None,
        description="Comparison value (string or number). Ignored for is_null and not_null. Use a list for in / not_in.",
    )


class Aggregation(BaseModel):
    """One aggregate computed per group (or over the whole dataset when no grouping is requested)."""

    column: str | None = Field(
        default=None,
        description="Column to aggregate. Omit only for function='count', which counts rows.",
    )
    function: Literal[
        "count", "sum", "mean", "median", "min", "max", "std", "nunique"
    ] = Field(description="Aggregate function to compute.")


_DATASETS: dict[str, pd.DataFrame] = {}
_META: dict[str, dict[str, Any]] = {}

_MAX_PREVIEW_ROWS = 20
_MAX_GROUP_ROWS = 50


def _dataset(ctx: agents.ToolCallbackContext) -> pd.DataFrame:
    df = _DATASETS.get(ctx.session.id)
    if df is None:
        raise agents.ToolError(
            "No CSV is loaded in this session yet. Fetch the file content from "
            "Google Drive (search_files / download_file_content) and call load_csv "
            "with the raw CSV text first."
        )
    return df


def _apply_filters(df: pd.DataFrame, filters: list[Filter], match_all: bool) -> pd.DataFrame:
    if not filters:
        return df
    masks = []
    for f in filters:
        if f.column not in df.columns:
            raise agents.ToolError(
                f"Unknown column {f.column!r}. Loaded columns: {list(df.columns)}"
            )
        s = df[f.column]
        if f.operator in ("is_null", "not_null"):
            mask = s.isna() if f.operator == "is_null" else s.notna()
        elif f.operator in ("in", "not_in"):
            values = f.value if isinstance(f.value, list) else [f.value]
            mask = s.isin(values)
            if f.operator == "not_in":
                mask = ~mask
        elif f.operator in ("contains", "starts_with", "ends_with"):
            text = str(f.value)
            mask = s.astype(str)
            if f.operator == "contains":
                mask = mask.str.contains(text, case=False, na=False)
            elif f.operator == "starts_with":
                mask = mask.str.startswith(text, na=False)
            else:
                mask = mask.str.endswith(text, na=False)
        else:
            value = f.value
            if pd.api.types.is_numeric_dtype(s) and not s.isna().all():
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    raise agents.ToolError(
                        f"Column {f.column!r} is numeric but {value!r} is not a number."
                    ) from None
            ops = {
                "equals": s == value,
                "not_equals": s != value,
                "greater_than": s > value,
                "less_than": s < value,
                "greater_or_equal": s >= value,
                "less_or_equal": s <= value,
            }
            mask = ops[f.operator]
        masks.append(mask.fillna(False))
    combined = masks[0]
    for m in masks[1:]:
        combined = combined & m if match_all else combined | m
    return df[combined]


def _rows_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    return df.to_dict(orient="records")


@agents.tool(
    name="load_csv",
    description=(
        "Load a CSV file into this session so the other data tools can use it. "
        "Pass the complete raw CSV text of the file you fetched from Google Drive."
    ),
    model_access="direct",
    namespace="data",
    annotations=agents.ToolAnnotations(read_only_hint=True),
)
async def load_csv(
    ctx: agents.ToolCallbackContext,
    /,
    csv_text: Annotated[str, Field(description="The complete raw CSV text of the file, including the header row.")],
    file_name: Annotated[str, Field(description="Name of the file, shown back to the user.")] = "data.csv",
) -> dict[str, Any]:
    """Load a CSV into the session and return its shape, columns and a preview."""
    try:
        df = pd.read_csv(io.StringIO(csv_text))
    except Exception as exc:
        raise agents.ToolError(
            f"Could not parse this text as CSV: {exc}. Make sure you passed the "
            "file's complete raw content, not a summary of it."
        ) from None
    if df.empty:
        raise agents.ToolError("The CSV parsed but contains no data rows.")
    _DATASETS[ctx.session.id] = df
    _META[ctx.session.id] = {"file_name": file_name, "rows": len(df), "columns": len(df.columns)}
    return {
        "file_name": file_name,
        "rows": len(df),
        "columns": [
            {"name": c, "dtype": str(df[c].dtype)} for c in df.columns
        ],
        "preview": _rows_to_records(df.head(5)),
    }


@agents.tool(
    name="describe_columns",
    description=(
        "Describe every column of the loaded CSV: type, missing values, unique "
        "values and, for numbers, basic statistics. Use this to understand the "
        "data before filtering or aggregating."
    ),
    model_access="direct",
    namespace="data",
    annotations=agents.ToolAnnotations(read_only_hint=True),
)
async def describe_columns(ctx: agents.ToolCallbackContext, /) -> dict[str, Any]:
    """Describe the columns of the loaded dataset."""
    df = _dataset(ctx)
    columns = []
    for col in df.columns:
        s = df[col]
        info: dict[str, Any] = {
            "name": col,
            "dtype": str(s.dtype),
            "non_null": int(s.count()),
            "missing": int(s.isna().sum()),
            "unique": int(s.nunique(dropna=True)),
        }
        if pd.api.types.is_numeric_dtype(s):
            info["numeric_stats"] = {
                "min": s.min(), "max": s.max(),
                "mean": s.mean(), "median": s.median(),
            }
        else:
            top = s.value_counts(dropna=True).head(5)
            info["top_values"] = {str(k): int(v) for k, v in top.items()}
        columns.append(info)
    return {
        "file_name": _META.get(ctx.session.id, {}).get("file_name"),
        "rows": len(df),
        "columns": columns,
    }


@agents.tool(
    name="filter_rows",
    description=(
        "Filter the loaded CSV by conditions on columns and return how many rows "
        "match plus a sample of the matching rows."
    ),
    model_access="direct",
    namespace="data",
    annotations=agents.ToolAnnotations(read_only_hint=True),
)
async def filter_rows(
    ctx: agents.ToolCallbackContext,
    /,
    filters: Annotated[list[Filter], Field(description="Conditions to apply. Use an empty list to sample all rows.")],
    match_all: Annotated[bool, Field(description="True: every filter must hold (AND). False: any filter (OR).")] = True,
    columns: Annotated[list[str] | None, Field(description="Optional subset of columns to return in the sample rows.")] = None,
    limit: Annotated[int, Field(description="Maximum number of sample rows to return.", ge=1, le=100)] = 10,
) -> dict[str, Any]:
    """Count and sample the rows that match the given filters."""
    df = _dataset(ctx)
    result = _apply_filters(df, filters, match_all)
    sample = result.head(limit)
    if columns:
        missing = [c for c in columns if c not in df.columns]
        if missing:
            raise agents.ToolError(f"Unknown columns {missing}. Loaded columns: {list(df.columns)}")
        sample = sample[columns]
    return {
        "total_rows": len(df),
        "matching_rows": len(result),
        "sample": _rows_to_records(sample),
    }


@agents.tool(
    name="groupby_aggregate",
    description=(
        "Group the loaded CSV by one or more columns and compute aggregates "
        "(count, sum, mean, median, min, max, std, nunique) per group, with "
        "optional filters first. Use this for questions like 'average X per Y' "
        "or 'total X by Y, top 5'."
    ),
    model_access="direct",
    namespace="data",
    annotations=agents.ToolAnnotations(read_only_hint=True),
)
async def groupby_aggregate(
    ctx: agents.ToolCallbackContext,
    /,
    aggregations: Annotated[list[Aggregation], Field(description="Aggregates to compute.")],
    group_by: Annotated[list[str] | None, Field(description="Columns to group by. Omit to aggregate over the whole dataset.")] = None,
    filters: Annotated[list[Filter] | None, Field(description="Optional filters applied before grouping.")] = None,
    sort_by: Annotated[str | None, Field(description="Output column to sort groups by, e.g. 'sales_sum' or 'count'.")] = None,
    sort_descending: Annotated[bool, Field(description="Sort sort_by from largest to smallest.")] = True,
    limit: Annotated[int, Field(description="Maximum number of groups to return.", ge=1, le=100)] = _MAX_GROUP_ROWS,
) -> dict[str, Any]:
    """Compute group-by aggregates over the loaded dataset."""
    df = _dataset(ctx)
    df = _apply_filters(df, filters or [], match_all=True)
    group_by = group_by or []
    for col in group_by:
        if col not in df.columns:
            raise agents.ToolError(f"Unknown column {col!r}. Loaded columns: {list(df.columns)}")
    for agg in aggregations:
        if agg.function != "count" and (agg.column is None or agg.column not in df.columns):
            raise agents.ToolError(
                f"Aggregation needs a loaded column: {agg.function} on {agg.column!r}. "
                f"Loaded columns: {list(df.columns)}"
            )

    ops = {
        "sum": "sum", "mean": "mean", "median": "median", "min": "min",
        "max": "max", "std": "std", "nunique": "nunique", "count": "size",
    }
    group_cols = list(group_by or [])
    if group_cols:
        grouped = df.groupby(group_cols, dropna=False)
    else:
        grouped = df.assign(_whole_dataset=0).groupby("_whole_dataset")
    built: dict[str, Any] = {}
    for agg in aggregations:
        if agg.function == "count":
            name = "count"
            series = grouped.size()
        else:
            name = f"{agg.column}_{agg.function}"
            series = getattr(grouped[agg.column], ops[agg.function])()
        built[name] = series
    out = pd.DataFrame(built).reset_index()
    if not group_cols:
        out = out.drop(columns=["_whole_dataset"])
    for c in out.columns:
        if str(out[c].dtype) == "object":
            out[c] = out[c].apply(lambda v: v if isinstance(v, (int, float)) else str(v))
    total = len(out)
    if sort_by:
        if sort_by not in out.columns:
            raise agents.ToolError(
                f"Unknown sort column {sort_by!r}. Available: {list(out.columns)}"
            )
        out = out.sort_values(sort_by, ascending=not sort_descending)
    out = out.head(limit)
    return {
        "rows_before_filters": _META.get(ctx.session.id, {}).get("rows"),
        "rows_after_filters": len(df),
        "total_groups": total,
        "returned_groups": len(out),
        "results": _rows_to_records(out),
    }


INSTRUCTIONS = """\
You are a conversational data analyst. The user gives you a link to a CSV file \
in their Google Drive and asks questions about it in plain language. You answer \
with real numbers computed from their actual data, never guesses.

How to work:
- When the user shares a Drive link (or names a file), use your Google Drive \
connector tools to locate and fetch the file: search_files or get_file_metadata \
to find it from the link, then download_file_content to get its raw CSV text. \
Then call the load_csv tool with the complete raw CSV text. Never summarize or \
truncate the CSV text you pass to load_csv.
- After loading, use describe_columns to understand the data, and answer \
questions with filter_rows and groupby_aggregate. Always ground every number \
you state in a tool result; if a tool fails or returns nothing, say so instead \
of estimating.
- You have no code execution and no other data tools. Do not try to run code \
or compute aggregates yourself for anything beyond a trivial count you can see \
in a tool result.
- The session remembers the conversation, and the loaded dataset is kept for \
your follow-up questions: do not reload the file unless a tool says no CSV is \
loaded. If that happens, fetch the file again from Google Drive using the link \
earlier in the conversation, then call load_csv again.
- Answer concisely in plain language, show the key numbers (and a short table \
when it helps), and mention which columns or filters you used when that \
clarifies the answer. If a question is ambiguous, ask one short clarifying \
question rather than guessing.
- Never invent, extrapolate or round numbers; report exactly what the tools \
returned, and say when the data cannot answer a question.
"""

agent = agents.Agent(
    model="mistral-large-4",
    name="drive-data-analyst",
    instructions=INSTRUCTIONS,
    tools=[load_csv, describe_columns, filter_rows, groupby_aggregate],
    connectors=[agents.connector("google_drive_mcp")],
)


if __name__ == "__main__":
    import asyncio

    async def main() -> None:
        result = await agent.run("What CSV files can you help me analyze?")
        if isinstance(result, agents.Completed):
            print(result.text)

    asyncio.run(main())
