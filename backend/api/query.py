import os
import re
import pandas as pd
from django.http import JsonResponse  # Optional, can use a simple dict
from utils import (
    load_dataset,
    extract_areas,
    extract_year_filter,
    chart_data,
    chart_comparison,
    generate_summary_mock
)

# Load dataset once at startup
PRELOADED = os.getenv("PRELOADED_EXCEL", "./api/sample_data.xlsx")
DATAFRAME = load_dataset(PRELOADED) if os.path.exists(PRELOADED) else None

def handler(request):
    q = request.GET.get("q", "").strip()
    if DATAFRAME is None:
        return {"error": "Dataset not loaded"}

    # Extract areas and year filter
    areas = extract_areas(q, DATAFRAME)
    start_year = extract_year_filter(q, DATAFRAME)
    df = DATAFRAME.copy()

    # Filter by area
    if areas:
        pattern = "|".join([re.escape(a) for a in areas])
        df = df[df["area"].str.contains(pattern, case=False, na=False)]

    # Filter by year
    if start_year:
        df = df[df["year"] >= start_year]

    if df.empty:
        return {
            "summary": f"No data found for '{q}'.",
            "chart": {"price": {}, "demand": {}},
            "table": []
        }

    # Detect comparison
    is_compare = len(areas) > 1 or ("compare" in q.lower())

    # Generate charts
    if is_compare and len(areas) >= 2:
        a1, a2 = areas[0], areas[1]
        df1 = DATAFRAME[DATAFRAME["area"].str.lower() == a1]
        df2 = DATAFRAME[DATAFRAME["area"].str.lower() == a2]
        price_chart = chart_comparison(df1, df2, "price")
        demand_chart = chart_comparison(df1, df2, "demand")
    elif is_compare:
        price_chart = chart_comparison(df, df, "price")
        demand_chart = chart_comparison(df, df, "demand")
    else:
        price_chart = chart_data(df, "price")
        demand_chart = chart_data(df, "demand")

    # Generate summary
    summary = generate_summary_mock(df, q)

    return {
        "summary": summary,
        "chart": {
            "price": price_chart,
            "demand": demand_chart
        },
        "table": df.head(150).fillna("").to_dict(orient="records"),
        "meta": {
            "areas_detected": areas,
            "year_filter": start_year
        }
    }
