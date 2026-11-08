import json
import urllib.request
from pathlib import Path
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

places = {"Vääksy": (61.173, 25.533), "Lahti": (60.983, 25.657)}
path = Path("weather-history.json")
history = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
today = datetime.now(ZoneInfo("Europe/Helsinki")).date()
# Tallennetaan viimeiset 5 valmistunutta päivää, jotta mahdolliset väliin jääneet ajot täydentyvät.
for city, (lat, lon) in places.items():
    url = ("https://api.open-meteo.com/v1/forecast?"
           f"latitude={lat}&longitude={lon}&past_days=7&forecast_days=1"
           "&daily=temperature_2m_mean,weather_code,precipitation_sum,"
           "wind_speed_10m_max,relative_humidity_2m_mean"
           "&timezone=Europe%2FHelsinki")
    with urllib.request.urlopen(url, timeout=30) as response:
        daily = json.load(response)["daily"]
    for i, day in enumerate(daily["time"]):
        date = datetime.strptime(day, "%Y-%m-%d").date()
        if not (today - timedelta(days=7) <= date < today):
            continue
        code = daily["weather_code"][i]
        condition = ("☀️ Selkeää" if code == 0 else "⛅ Puolipilvistä" if code <= 3
                     else "🌫️ Sumuista" if code <= 48 else "🌧️ Sateista" if code <= 67
                     else "❄️ Lumisadetta" if code <= 77 else "🌦️ Sadekuuroja" if code <= 82
                     else "🌨️ Lumikuuroja" if code <= 86 else "⛈️ Ukkosta")
        temp = daily["temperature_2m_mean"][i]
        entry = {"city": city, "date": day, "temp": str(round(temp, 1)) if temp is not None else "",
                 "weather": condition, "notes": "", "automatic": True,
                 "rain": daily["precipitation_sum"][i],
                 "wind": daily["wind_speed_10m_max"][i],
                 "humidity": daily["relative_humidity_2m_mean"][i]}
        history = [old for old in history if not (old["city"] == city and old["date"] == day)]
        history.append(entry)
history.sort(key=lambda x: (x["date"], x["city"]))
path.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
