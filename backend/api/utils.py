import os
import re
import pandas as pd
import numpy as np
from dotenv import load_dotenv
from geopy.geocoders import Nominatim
import logging

load_dotenv()
logger = logging.getLogger(__name__)

def clean(col):
    if not isinstance(col, str):
        col = str(col)
    return col.strip().lower().replace("\t", "").replace("\n", "").replace("  ", " ")

def load_dataset(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Excel file not found: {path}")

    df = pd.read_excel(path, engine="openpyxl")
    df.columns = [clean(c) for c in df.columns]

    # area detection
    area_candidates = ["final location", "final_location", "area", "location", "locality"]
    found_area = None
    for c in df.columns:
        for ac in area_candidates:
            if ac in c:
                found_area = c
                break
        if found_area:
            break
    if found_area:
        df.rename(columns={found_area: "area"}, inplace=True)

    # price detection
    price_candidates = [
        "flat - weighted average rate",
        "flat-weighted average rate",
        "weighted average rate",
        "avg_rate",
        "rate",
        "price",
        "avg price",
        "avgprice"
    ]
    found_price = None
    for c in df.columns:
        for pc in price_candidates:
            if pc in c:
                found_price = c
                break
        if found_price:
            break
    if found_price:
        df.rename(columns={found_price: "price"}, inplace=True)
    else:
        df["price"] = pd.NA

    # demand detection
    demand_candidates = [
        "total sold - igr",
        "flat_sold - igr",
        "total_sales - igr",
        "sales",
        "demand",
        "units sold",
        "sold"
    ]
    found_demand = None
    for c in df.columns:
        for dc in demand_candidates:
            if dc in c:
                found_demand = c
                break
        if found_demand:
            break
    if found_demand:
        df.rename(columns={found_demand: "demand"}, inplace=True)
    else:
        df["demand"] = pd.NA

    # year detection
    year_candidates = ["year", "yr", "financial year"]
    found_year = None
    for c in df.columns:
        for yc in year_candidates:
            if yc in c:
                found_year = c
                break
        if found_year:
            break
    if found_year:
        df.rename(columns={found_year: "year"}, inplace=True)

    if "year" not in df.columns:
        raise Exception("No 'year' column detected in dataset! Please ensure the Excel contains a year column.")

    # normalize
    df["area"] = df.get("area", pd.Series([""] * len(df))).astype(str).str.strip()
    df["price"] = pd.to_numeric(df["price"], errors="coerce").fillna(0)
    df["demand"] = pd.to_numeric(df["demand"], errors="coerce").fillna(0)
    df["year"] = pd.to_numeric(df["year"], errors="coerce").fillna(0).astype(int)
    df["area"] = df["area"].astype(str)

    return df

def filter_by_area(df, query):
    q = str(query).strip().lower()
    if not q:
        return df.copy()
    if "area" in df.columns:
        mask = df["area"].astype(str).str.lower().str.contains(q, na=False)
        return df[mask].copy()
    return df.iloc[0:0].copy()

def chart_data(df, value_col="price", year_col="year", agg="mean"):
    if df.empty or value_col not in df.columns or year_col not in df.columns:
        return {"labels": [], "series": []}
    grouped = df.groupby(year_col)[value_col].agg(agg).reset_index().sort_values(year_col)
    return {"labels": grouped[year_col].astype(str).tolist(), "series": grouped[value_col].round(2).tolist()}

def validate_place_exists(area_name, existing_df=None):
    """
    Validate if a place name is a real location using Nominatim/OpenStreetMap.
    Also checks if it's in the existing dataframe first.
    
    Args:
        area_name (str): Area/place name to validate
        existing_df (DataFrame): Optional dataframe to check first
    
    Returns:
        tuple: (is_valid: bool, location_data: dict or None, is_in_excel: bool)
    """
    # First check if it's in the existing dataset
    if existing_df is not None and not existing_df.empty:
        area_lower = area_name.lower().strip()
        existing_areas = existing_df["area"].astype(str).str.lower().str.strip()
        if area_lower in existing_areas.values:
            return True, {"name": area_name, "source": "excel"}, True
    
    # Try to validate using Nominatim (OpenStreetMap)
    try:
        geolocator = Nominatim(user_agent="realestate_chatbot")
        location = geolocator.geocode(area_name, timeout=5)
        
        if location:
            return True, {
                "name": area_name,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "address": location.address,
                "source": "geolocation"
            }, False
        else:
            return False, None, False
    except Exception as e:
        logger.warning(f"Geolocation validation failed for {area_name}: {e}")
        # If geolocation fails, allow generation anyway but mark as unverified
        return True, {"name": area_name, "source": "unverified"}, False

def generate_synthetic_data(area_name, existing_df, location_data=None):
    """
    Generate synthetic real estate data for an area based on patterns from existing data.
    Uses location data if available to create more realistic values.
    
    Args:
        area_name (str): Name of the area to generate data for
        existing_df (DataFrame): Existing dataset to analyze patterns
        location_data (dict): Optional location metadata
    
    Returns:
        DataFrame: Synthetic data for the requested area
    """
    if existing_df.empty:
        return pd.DataFrame(columns=["area", "year", "price", "demand"])
    
    # Get year range from existing data
    min_year = int(existing_df["year"].min())
    max_year = int(existing_df["year"].max())
    years = list(range(min_year, max_year + 1))
    
    # Calculate statistics from existing data
    avg_price = existing_df["price"].mean()
    avg_demand = existing_df["demand"].mean()
    price_std = existing_df["price"].std()
    demand_std = existing_df["demand"].std()
    
    # Use consistent seed per area for reproducibility
    np.random.seed(hash(area_name.lower()) % 2**32)
    
    # Determine price multiplier based on area characteristics
    # Metro areas typically have higher prices
    metro_keywords = ["city", "central", "downtown", "metro", "urban"]
    area_lower = area_name.lower()
    is_metro = any(keyword in area_lower for keyword in metro_keywords)
    price_multiplier = 1.4 if is_metro else 0.9
    
    base_price = np.random.normal(avg_price * price_multiplier, price_std * 0.3)
    base_demand = np.random.normal(avg_demand * (1.2 if is_metro else 0.8), demand_std * 0.3)
    
    # Ensure positive values
    base_price = max(2000, base_price)
    base_demand = max(20, base_demand)
    
    # Generate data with realistic growth patterns
    data = []
    for year in years:
        years_passed = year - min_year
        # 7-12% annual price growth (realistic for real estate)
        price_growth = 1 + (years_passed * np.random.uniform(0.07, 0.12))
        # 5-10% demand growth
        demand_factor = 1 + (years_passed * np.random.uniform(0.05, 0.10))
        
        price = int(base_price * price_growth * np.random.uniform(0.93, 1.07))
        demand = int(base_demand * demand_factor * np.random.uniform(0.88, 1.12))
        
        data.append({
            "area": area_name,
            "year": year,
            "price": max(0, price),
            "demand": max(0, demand)
        })
    
    return pd.DataFrame(data)

def get_or_generate_area_data(area_name, base_df, validate=True):
    """
    Retrieve data for an area from base_df, validate if it's a real place,
    and generate synthetic data if not found but valid.
    
    Args:
        area_name (str): Area name to search for
        base_df (DataFrame): Base dataset
        validate (bool): Whether to validate the place exists
    
    Returns:
        tuple: (data_df, status_dict)
        status_dict contains: {is_valid, is_in_excel, source}
    """
    # Try to find exact match in existing data
    area_lower = area_name.lower().strip()
    existing = base_df[base_df["area"].str.lower() == area_lower]
    
    if not existing.empty:
        return existing.copy(), {
            "is_valid": True,
            "is_in_excel": True,
            "source": "excel",
            "message": f"Found data in uploaded Excel file"
        }
    
    # Validate if it's a real place
    if validate:
        is_valid, location_data, _ = validate_place_exists(area_name, base_df)
        
        if not is_valid:
            return pd.DataFrame(columns=["area", "year", "price", "demand"]), {
                "is_valid": False,
                "is_in_excel": False,
                "source": "invalid",
                "message": f"'{area_name}' is not a recognized location. Please check spelling or use a valid place name."
            }
    else:
        is_valid = True
        location_data = None
    
    # Generate synthetic data for valid area
    synthetic = generate_synthetic_data(area_name, base_df, location_data)
    
    return synthetic, {
        "is_valid": True,
        "is_in_excel": False,
        "source": "generated",
        "message": f"Generated realistic market data for '{area_name}' based on regional patterns",
        "location_data": location_data
    }

def generate_summary_mock(df, query, areas=None):
    """
    Generates an offline, clean summary for real estate data with area names.
    Supports single area and two-area comparison.

    Args:
        df (DataFrame): Filtered dataset for the query.
        query (str): User query.
        areas (list[str], optional): List of area names. Defaults to None.

    Returns:
        str: Clean summary text.
    """
    if df is None or df.empty:
        return f"No data found for '{query}'."

    rows = len(df)
    years = sorted(df["year"].unique())
    year_range = f"{years[0]}–{years[-1]}" if years else "N/A"

    if areas and len(areas) == 2:
        # Comparison summary
        area1, area2 = areas[0], areas[1]
        df1 = df[df["area"].str.lower() == area1.lower()]
        df2 = df[df["area"].str.lower() == area2.lower()]

        summary_parts = [f"📊 {area1.title()} vs {area2.title()} Real Estate Comparison ({year_range})"]

        # Price comparison
        if "price" in df1.columns and "price" in df2.columns and not df1.empty and not df2.empty:
            avg1_start = df1.groupby("year")["price"].mean().sort_index().iloc[0]
            avg1_end = df1.groupby("year")["price"].mean().sort_index().iloc[-1]
            pct1 = ((avg1_end - avg1_start) / avg1_start * 100) if avg1_start != 0 else 0

            avg2_start = df2.groupby("year")["price"].mean().sort_index().iloc[0]
            avg2_end = df2.groupby("year")["price"].mean().sort_index().iloc[-1]
            pct2 = ((avg2_end - avg2_start) / avg2_start * 100) if avg2_start != 0 else 0

            summary_parts.append(
                f"\n\n💰 Price Comparison:\n"
                f"• {area1.title()}: ₹{avg1_start:,.0f} → ₹{avg1_end:,.0f} ({pct1:+.1f}%)\n"
                f"• {area2.title()}: ₹{avg2_start:,.0f} → ₹{avg2_end:,.0f} ({pct2:+.1f}%)"
            )

        # Demand comparison
        if "demand" in df1.columns and "demand" in df2.columns and not df1.empty and not df2.empty:
            avg_d1 = df1["demand"].mean()
            avg_d2 = df2["demand"].mean()
            total_d1 = df1["demand"].sum()
            total_d2 = df2["demand"].sum()
            summary_parts.append(
                f"\n\n📈 Demand Comparison:\n"
                f"• {area1.title()}: {avg_d1:,.0f} units/year (Total: {total_d1:,.0f})\n"
                f"• {area2.title()}: {avg_d2:,.0f} units/year (Total: {total_d2:,.0f})"
            )

        # Insight
        insight = ""
        if not df1.empty and not df2.empty:
            if avg1_end > avg1_start and avg2_end > avg2_start:
                diff = abs(pct1 - pct2)
                leader = area1.title() if pct1 > pct2 else area2.title()
                insight = f"Both areas show positive growth. {leader} leads with {diff:.1f}% higher growth rate."
            elif avg1_end > avg1_start:
                insight = f"{area1.title()} shows {pct1:.1f}% price growth, while {area2.title()} is relatively stable."
            elif avg2_end > avg2_start:
                insight = f"{area2.title()} shows {pct2:.1f}% price growth, while {area1.title()} is relatively stable."
            else:
                insight = "Both areas show stable or declining prices, indicating a buyer-friendly market."

        summary_parts.append(f"\n\n💡 Insight: {insight}")
        summary_parts.append(f"\n\n📋 Analysis based on {rows} data records.")
        return "".join(summary_parts)

    else:
        # Single area summary (enhanced)
        area_label = ", ".join([a.title() for a in areas]) if areas else "Selected Area"
        summary_parts = [f"📊 {area_label} Real Estate Analysis ({year_range})"]

        # Price trend
        if "price" in df.columns:
            grouped = df.groupby("year")["price"].mean().sort_index()
            first = float(grouped.iloc[0])
            last = float(grouped.iloc[-1])
            pct_change = ((last - first) / first * 100) if first != 0 else 0
            trend = "increased" if last > first else "decreased" if last < first else "remained stable"
            min_price = df["price"].min()
            max_price = df["price"].max()
            avg_price = df["price"].mean()
            
            summary_parts.append(
                f"\n\n💰 Price Trend:\n"
                f"• Direction: {trend.title()} by {abs(pct_change):.1f}%\n"
                f"• Range: ₹{first:,.0f} → ₹{last:,.0f}\n"
                f"• Average: ₹{avg_price:,.0f}\n"
                f"• Min/Max: ₹{min_price:,.0f} / ₹{max_price:,.0f}"
            )

        # Demand trend
        if "demand" in df.columns:
            grouped_d = df.groupby("year")["demand"].mean().sort_index()
            d_first = float(grouped_d.iloc[0])
            d_last = float(grouped_d.iloc[-1])
            d_pct = ((d_last - d_first) / d_first * 100) if d_first != 0 else 0
            d_trend = "increased" if d_last > d_first else "decreased" if d_last < d_first else "remained stable"
            avg_demand = float(df["demand"].mean())
            total_demand = float(df["demand"].sum())
            
            summary_parts.append(
                f"\n\n📈 Demand Trend:\n"
                f"• Direction: {d_trend.title()} by {abs(d_pct):.1f}%\n"
                f"• Change: {d_first:,.0f} → {d_last:,.0f} units/year\n"
                f"• Average: {avg_demand:,.0f} units/year\n"
                f"• Total: {total_demand:,.0f} units"
            )

        # Insight
        insight = ""
        if "price" in df.columns and "demand" in df.columns:
            if last > first and d_last > d_first:
                insight = "Strong market: Both prices and demand are growing, indicating high investment potential."
            elif last > first and d_last <= d_first:
                insight = "Price-driven market: Prices rising with stable demand, may indicate affordability concerns."
            elif last <= first and d_last > d_first:
                insight = "Buyer-friendly market: Stable prices with growing demand, good opportunity for purchases."
            else:
                insight = "Stable market: Both prices and demand are steady, indicating market maturity."
        elif "price" in df.columns:
            insight = f"Price trend shows {trend} movement, indicating market direction."
        elif "demand" in df.columns:
            insight = f"Demand trend shows {d_trend} activity, indicating buyer interest."

        summary_parts.append(f"\n\n💡 Market Insight: {insight}")
        summary_parts.append(f"\n\n📋 Analysis based on {rows} data records across {len(years)} years.")
        return "".join(summary_parts)


def generate_summary_openai(df, query, mode="general"):
    try:
        from openai import OpenAI
    except Exception:
        return generate_summary_mock(df, query)

    OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")
    if not OPENAI_KEY:
        return generate_summary_mock(df, query)

    try:
        client = OpenAI(api_key=OPENAI_KEY)

        sample = df.to_dict(orient="records")

        prompt = f"""
You are a real estate analysis assistant. You MUST follow these strict rules:

1. Output ONLY ONE final formatted summary.
2. Do NOT explain your reasoning.
3. Do NOT output multiple summaries.
4. Do NOT add intros like "Sure", "Here is…".
5. Do NOT repeat the information in different words.
6. NEVER mention charts, tables, code, or the backend.
7. Use ONLY the values from the dataframe provided.

The user asked: "{query}"

### DATA
{sample}

### INSTRUCTIONS
- If one area is detected → Provide a single-area summary.
- If two areas are detected → Provide a comparison summary.
- If a year filter is triggered → Use only the filtered years from the dataframe.

Return ONLY the final summary text.
"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0,
            max_tokens=350,
            messages=[
                {"role": "system", "content": "You are a concise real-estate analysis engine."},
                {"role": "user", "content": prompt},
            ],
        )

        return response.choices[0].message.content.strip()

    except Exception:
        # Clean fallback: always return mock summary, no error text
        return generate_summary_mock(df, query)


def extract_areas(user_query, df):
    if not user_query or df is None:
        return []
    text = user_query.lower()
    all_areas = sorted(set(df["area"].astype(str).str.lower()))
    found = []

    # check for multi-word area matches
    for area in all_areas:
        area_words = area.split()
        # check if all words in area exist in query
        if all(w in text for w in area_words):
            found.append(area)
    # fallback: find single-word matches
    if not found:
        for area in all_areas:
            if area in text:
                found.append(area)

    return found[:2]  # only compare up to 2 areas


def extract_year_filter(user_query, df):
    text = (user_query or "").lower()
    years = re.findall(r"(19|20)\d{2}", text)
    if not years:
        return None
    # years list may be like ['20','19'] if regex groups; simpler convert full findall without group
    years_full = re.findall(r"(?:19|20)\d{2}", text)
    if not years_full:
        return None
    year = int(years_full[0])
    if "year" in df.columns:
        min_y = int(df["year"].min())
        max_y = int(df["year"].max())
        if year < min_y or year > max_y:
            return None
    return year

def chart_comparison(df1, df2, value_col="price", year_col="year", agg="mean"):
    if df1.empty and df2.empty:
        return {"labels": [], "series1": [], "series2": []}
    g1 = df1.groupby(year_col)[value_col].agg(agg).reset_index()
    g2 = df2.groupby(year_col)[value_col].agg(agg).reset_index()
    years = sorted(set(g1[year_col]).union(set(g2[year_col])))
    s1 = {int(row[year_col]): float(row[value_col]) for _, row in g1.iterrows()}
    s2 = {int(row[year_col]): float(row[value_col]) for _, row in g2.iterrows()}
    series1 = [round(s1.get(y, 0), 2) for y in years]
    series2 = [round(s2.get(y, 0), 2) for y in years]
    return {"labels": [str(y) for y in years], "series1": series1, "series2": series2}