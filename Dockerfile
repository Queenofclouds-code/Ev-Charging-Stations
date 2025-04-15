# Use official Python 3.10 image as the base
FROM python:3.10.12

# Install GDAL system dependencies
RUN apt-get update && apt-get install -y \
    libgdal-dev \
    gdal-bin \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for GDAL
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Set working directory
WORKDIR /app

# Copy requirements.txt and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project
COPY . .

# Collect static files with verbose output for debugging
RUN python manage.py collectstatic --noinput --verbosity 2

# Start the app with Gunicorn (migrations will be run manually)
CMD ["gunicorn", "EvCharging.wsgi:application", "--bind", "0.0.0.0:$PORT"]