# EV Charging Station Finder Web App

A web application to help users locate electric vehicle (EV) charging stations across India. This project showcases interactive web mapping, geospatial filtering, heatmap visualizations, and optimized routing using Leaflet.js and Google APIs.

## 🚀 Features

- 🗺️ Interactive map with Leaflet.js + OpenStreetMap
- 📍 Location-based filtering (nearby, city, or state)
- 🔥 Heatmap showing station density
- 🧭 Route optimization & directions (Google Directions API)
- 📱 Mobile-responsive design with sidebar and clustering
- 🛠️ Backend built with Django & PostgreSQL (PostGIS)
- 📡 REST API for serving charging station data

## 🛠️ Tech Stack

- **Frontend:** HTML, CSS, JavaScript, Leaflet.js
- **Backend:** Django, Django REST Framework
- **Database:** PostgreSQL + PostGIS
- **APIs:** Google Maps Directions API
- **Map Tiles:** OpenStreetMap


## 🚀 Deployment Status

> ❌ Deployment was attempted on platforms like Heroku and Render, but failed due to unresolved GDAL dependency issues. The project currently runs successfully in a local environment. Future deployment may use Docker or a VPS setup to handle native dependencies.

## 📸 Screenshots

![Heatmap](HeatMap.png)
![Directions](Directions.png)

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/Queenofclouds-code/ev-charging-map.git
cd ev-charging-map

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt


Set Up PostgreSQL Database:
Create a PostgreSQL database with PostGIS extension.
Update the .env file with your database credentials (e.g., DATABASE_URL=postgres://user:password@localhost:5432/dbname).

Configure API Keys:
Add your Google Directions API key to the .env file (e.g., GOOGLE_MAPS_API_KEY=your_api_key).

# Run migrations (if needed)
python manage.py migrate

# Run the server
python manage.py runserver

# Open your browser
http://127.0.0.1:8000/
```

## 🗃️ Folder Structure (Simplified)

```
📁 stations_api/
├── models.py
├── serializers.py
├── views.py
├── settings.py
📁 static/
├── js/
│   └── script.js
📁 templates/
├── map.html
📄 manage.py
📄 requirements.txt
```

## 📊 Data

- 100 EV charging stations loaded from a cleaned JSON file
- Stored in PostgreSQL with PostGIS spatial fields
- Stations include fields like: `name`, `city`, `state`, `latitude`, `longitude`, `charging_points`, etc.

## 📌 Credits

- Data: Cleaned from public EV datasets
- Maps: OpenStreetMap
- Routing: Google Directions API

## 👩‍💻 Author

**Meghaj Kamble**  
📍 Pune, Maharashtra  
📧 meghaj9096@gmail.com  
🔗 [GitHub](https://github.com/Queenofclouds-code)

