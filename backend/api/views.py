import os
import re
import pandas as pd
import numpy as np
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from dotenv import load_dotenv

from .utils import (
    load_dataset,
    extract_areas,
    extract_year_filter,
    chart_data,
    chart_comparison,
    generate_summary_openai,
    generate_summary_mock,
    get_or_generate_area_data,
    validate_place_exists,
)

load_dotenv()

PRELOADED = os.getenv("PRELOADED_EXCEL", "./api/sample_data.xlsx")

# Load dataset at startup
try:
    if os.path.exists(PRELOADED):
        DATAFRAME = load_dataset(PRELOADED)
        print("✅ Loaded dataset:", PRELOADED)
    else:
        DATAFRAME = None
        print("⚠️  No preloaded dataset found")
except Exception as e:
    print("❌ Dataset load error:", e)
    DATAFRAME = None

@csrf_exempt
def upload_file(request):
    """Handle Excel file uploads"""
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    f = request.FILES.get("file")
    if not f:
        return JsonResponse({"error": "file missing"}, status=400)

    p = default_storage.save("uploaded.xlsx", f)
    full_path = default_storage.path(p)

    try:
        df = load_dataset(full_path)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)

    global DATAFRAME
    DATAFRAME = df

    return JsonResponse({"status": "ok", "rows": len(df)})

def list_areas(request):
    """List all areas in the loaded dataset"""
    global DATAFRAME
    if DATAFRAME is None:
        return JsonResponse({"areas": []})
    return JsonResponse({"areas": sorted(list(DATAFRAME["area"].unique()))})

def dashboard_stats(request):
    """Get dashboard statistics"""
    global DATAFRAME
    if DATAFRAME is None:
        return JsonResponse({"error": "Dataset not loaded"}, status=400)
    
    df = DATAFRAME.copy()
    
    # Overall statistics
    total_areas = df["area"].nunique()
    total_records = len(df)
    year_range = f"{int(df['year'].min())}-{int(df['year'].max())}"
    
    # Latest year data
    latest_year = int(df["year"].max())
    latest_df = df[df["year"] == latest_year]
    
    # Top areas by price (latest year)
    top_by_price = latest_df.groupby("area")["price"].mean().sort_values(ascending=False).head(5)
    top_areas_price = [{"area": area, "value": round(float(price), 2)} for area, price in top_by_price.items()]
    
    # Top areas by demand (latest year)
    top_by_demand = latest_df.groupby("area")["demand"].sum().sort_values(ascending=False).head(5)
    top_areas_demand = [{"area": area, "value": int(demand)} for area, demand in top_by_demand.items()]
    
    # Overall market trends
    yearly_trends = df.groupby("year").agg({
        "price": "mean",
        "demand": "sum"
    }).reset_index()
    
    market_trend_data = {
        "years": yearly_trends["year"].astype(str).tolist(),
        "avg_price": yearly_trends["price"].round(2).tolist(),
        "total_demand": yearly_trends["demand"].astype(int).tolist()
    }
    
    # Area comparison data (all areas current year)
    area_stats = latest_df.groupby("area").agg({
        "price": "mean",
        "demand": "sum"
    }).reset_index()
    
    area_comparison = {
        "areas": area_stats["area"].tolist(),
        "prices": area_stats["price"].round(2).tolist(),
        "demands": area_stats["demand"].astype(int).tolist()
    }
    
    # Calculate growth rates
    if len(yearly_trends) >= 2:
        price_growth = ((yearly_trends["price"].iloc[-1] - yearly_trends["price"].iloc[0]) / 
                       yearly_trends["price"].iloc[0] * 100)
        demand_growth = ((yearly_trends["demand"].iloc[-1] - yearly_trends["demand"].iloc[0]) / 
                        yearly_trends["demand"].iloc[0] * 100)
    else:
        price_growth = 0
        demand_growth = 0
    
    return JsonResponse({
        "overview": {
            "total_areas": total_areas,
            "total_records": total_records,
            "year_range": year_range,
            "latest_year": latest_year,
            "avg_price": round(float(latest_df["price"].mean()), 2),
            "total_demand": int(latest_df["demand"].sum()),
            "price_growth": round(float(price_growth), 2),
            "demand_growth": round(float(demand_growth), 2)
        },
        "top_areas_price": top_areas_price,
        "top_areas_demand": top_areas_demand,
        "market_trends": market_trend_data,
        "area_comparison": area_comparison
    })

def query_view(request):
    """
    Main query endpoint - processes user queries about real estate areas.
    - Validates place names using geolocation
    - Generates realistic data for valid places not in Excel
    - Returns error for invalid places
    """
    global DATAFRAME
    if DATAFRAME is None:
        return JsonResponse({"error": "Dataset not loaded"}, status=400)

    q = request.GET.get("q", "").strip()
    if not q:
        return JsonResponse({"error": "Empty query"}, status=400)

    # 1. Extract areas from query
    areas = extract_areas(q, DATAFRAME)
    start_year = extract_year_filter(q, DATAFRAME)

    # 2. If no areas found in Excel data, try to extract from query text
    if not areas:
        words = q.lower().split()
        for word in words:
            # Look for potential place names (3+ chars, not common words)
            if len(word) > 2 and word not in ['the', 'and', 'for', 'from', 'area', 'analyze', 'show', 'tell', 'about', 'data', 'real', 'estate']:
                # Extract as potential area and validate
                potential_area = word.title()
                area_data, status = get_or_generate_area_data(potential_area, DATAFRAME, validate=True)
                
                if status["is_valid"]:
                    areas = [potential_area]
                    break
                # Continue to next word if invalid

    # 3. Handle invalid place names
    if not areas:
        return JsonResponse({
            "summary": f"❌ Unable to find or validate '{q}'. Please check spelling or provide a valid place name.",
            "chart": {"price": {}, "demand": {}},
            "table": [],
            "meta": {
                "areas_detected": [],
                "year_filter": None,
                "data_sources": {},
                "error": "invalid_place"
            }
        })

    # 4. Build dataset - fetch or generate data for detected areas
    df_list = []
    data_sources = {}
    
    for area in areas:
        area_data, status = get_or_generate_area_data(area, DATAFRAME, validate=True)
        
        if not status["is_valid"]:
            # Invalid place - return error
            return JsonResponse({
                "summary": status["message"],
                "chart": {"price": {}, "demand": {}},
                "table": [],
                "meta": {
                    "areas_detected": [area],
                    "year_filter": None,
                    "data_sources": {area: "invalid"},
                    "error": "invalid_place"
                }
            })
        
        df_list.append(area_data)
        data_sources[area] = status["source"]

    # Combine all data
    df = pd.concat(df_list, ignore_index=True) if df_list else DATAFRAME.copy()

    # 5. Filter by year if specified
    if start_year:
        df = df[df["year"] >= start_year]

    if df.empty:
        return JsonResponse({
            "summary": f"No data available for the requested criteria.",
            "chart": {"price": {}, "demand": {}},
            "table": [],
            "meta": {
                "areas_detected": areas,
                "year_filter": start_year,
                "data_sources": data_sources,
                "error": "no_data"
            }
        })

    # 6. Determine comparison mode
    is_compare = len(areas) > 1 or ("compare" in q.lower())

    # 7. Generate charts
    if is_compare and len(areas) >= 2:
        a1, a2 = areas[0], areas[1]
        df1 = df[df["area"].str.lower() == a1.lower()]
        df2 = df[df["area"].str.lower() == a2.lower()]
        price_chart = chart_comparison(df1, df2, "price")
        demand_chart = chart_comparison(df1, df2, "demand")
    elif is_compare:
        price_chart = chart_comparison(df, df, "price")
        demand_chart = chart_comparison(df, df, "demand")
    else:
        price_chart = chart_data(df, "price")
        demand_chart = chart_data(df, "demand")

    # 8. Generate summary
    summary = generate_summary_mock(df, q, areas=areas)
    if os.getenv("OPENAI_API_KEY"):
        try:
            summary = generate_summary_openai(df, q, "compare" if is_compare else "general")
        except Exception:
            pass

    # 9. Add data source notes
    summary_note = ""
    generated_areas = [k for k, v in data_sources.items() if v == "generated"]
    excel_areas = [k for k, v in data_sources.items() if v == "excel"]
    
    if generated_areas:
        summary_note += f"\n\n🔬 Data Generation: Synthetic market data was generated for {', '.join(generated_areas)} based on regional patterns and geolocation research."
    if excel_areas:
        summary_note += f"\n\n📊 Real Data: {', '.join(excel_areas)} data from uploaded Excel file."
    
    summary += summary_note

    # 10. Return response
    return JsonResponse({
        "summary": summary,
        "chart": {
            "price": price_chart,
            "demand": demand_chart
        },
        "table": df.head(150).fillna("").to_dict(orient="records"),
        "meta": {
            "areas_detected": areas,
            "year_filter": start_year,
            "data_sources": data_sources
        }
    })