import pandas as pd
import numpy as np
from datetime import datetime

# Generate realistic real estate sample data
np.random.seed(42)

areas = ["Wakad", "Hinjewadi", "Baner", "Kharadi", "Viman Nagar", "Koregaon Park", "Aundh", "Pimple Saudagar"]
years = list(range(2018, 2025))

data = []
for area in areas:
    base_price = np.random.randint(4000, 7000)
    base_demand = np.random.randint(100, 500)
    
    for year in years:
        # Add year-over-year growth with some randomness
        growth_factor = 1 + (year - 2018) * 0.08 + np.random.uniform(-0.05, 0.15)
        demand_factor = 1 + (year - 2018) * 0.06 + np.random.uniform(-0.1, 0.2)
        
        price = int(base_price * growth_factor)
        demand = int(base_demand * demand_factor)
        
        data.append({
            "area": area,
            "year": year,
            "price": price,
            "demand": demand
        })

df = pd.DataFrame(data)

# Save to Excel
output_path = "api/sample_data.xlsx"
df.to_excel(output_path, index=False, engine="openpyxl")
print(f"✅ Sample data generated: {output_path}")
print(f"   Total rows: {len(df)}")
print(f"   Areas: {', '.join(areas)}")
print(f"   Years: {years[0]}-{years[-1]}")
