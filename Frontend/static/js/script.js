function initializeApp(attempt = 1, maxAttempts = 10) {
    console.log(`Attempt ${attempt} to initialize app`);
    
    let findNearbyBtn = document.getElementById('find-nearby');
    let findByCityBtn = document.getElementById('find-by-city');
    let findByStateBtn = document.getElementById('find-by-state');
    let radiusSlider = document.getElementById('radius');
    let cityInput = document.getElementById('city');
    let stateInput = document.getElementById('state');
    let messageDiv = document.getElementById('message');
    let clearRouteBtn = document.getElementById('clear-route');
    let loadingDiv = document.getElementById('loading');
    let resetMapBtn = document.getElementById('reset-map');
    let setLocationBtn = document.getElementById('set-location');
    let toggleHeatmapBtn = document.getElementById('toggle-heatmap');
    let showAllIndiaBtn = document.getElementById('show-all-india');
    let optimizeRouteBtn = document.getElementById('optimize-route');
    let toggleSliderBtn = document.getElementById('toggle-slider'); // New slider button

    if (!findNearbyBtn || !findByCityBtn || !findByStateBtn || !radiusSlider || !cityInput || !stateInput || !messageDiv || 
        !clearRouteBtn || !loadingDiv || !resetMapBtn || 
        !setLocationBtn || !toggleHeatmapBtn || !showAllIndiaBtn || !optimizeRouteBtn || !toggleSliderBtn) {
        console.error('One or more DOM elements not found');
        if (attempt < maxAttempts) {
            setTimeout(() => initializeApp(attempt + 1, maxAttempts), 500);
            return;
        } else {
            console.error('Max attempts reached. Aborting initialization.');
            return;
        }
    }

    var map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    window.addEventListener('resize', () => map.invalidateSize());

    // Sidebar toggle for desktop only
    toggleSliderBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mapDiv = document.getElementById('map');
        const isCollapsed = sidebar.classList.toggle('collapsed');
        toggleSliderBtn.textContent = isCollapsed ? '<' : '>';
        toggleSliderBtn.classList.toggle('collapsed', isCollapsed);
        mapDiv.classList.toggle('collapsed', isCollapsed); // Toggle map class for mobile height
        setTimeout(() => map.invalidateSize(), 300); // Match transition duration
    });

    let filterMode = 'nearby';
    let circleLayer = null;
    let markers = L.markerClusterGroup({
        maxClusterRadius: 50,
        disableClusteringAtZoom: 15,
        spiderfyOnMaxZoom: true
    }).addTo(map);
    let fetchTimeout = null;
    let routeLayer = null;
    let userMarker = null;
    let userLocation = null;
    let heatLayer = null;
    let selectedStations = [];
    let routePopup = null;

    // Rest of your original code remains unchanged below
    const userIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41]
    });

    const stationIcon = L.icon({
        iconUrl: '/static/images/charging-station.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        shadowSize: [41, 41]
    });

    function debounce(func, wait) {
        return function (...args) {
            clearTimeout(fetchTimeout);
            fetchTimeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function toTitleCase(str) {
        if (!str) return str;
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    function stripHtml(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    function setUserLocation(callback) {
        navigator.geolocation.getCurrentPosition(position => {
            userLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
            if (userMarker) map.removeLayer(userMarker);
            userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
                .addTo(map)
                .bindPopup('Your Location');
            callback(userLocation.lat, userLocation.lon);
        }, (error) => {
            console.error('Geolocation error:', error);
            messageDiv.innerHTML = `
                Failed to get your location: ${error.message}<br>
                <button id="retry-geolocation">Retry</button>
                <button id="use-default-location">Use Default Location (Mumbai)</button>
            `;
            messageDiv.style.display = 'block';

            document.getElementById('retry-geolocation').addEventListener('click', () => {
                messageDiv.style.display = 'none';
                setUserLocation(callback);
            });

            document.getElementById('use-default-location').addEventListener('click', () => {
                userLocation = { lat: 19.0760, lon: 72.8777 };
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
                    .addTo(map)
                    .bindPopup('Default Location (Mumbai)');
                callback(userLocation.lat, userLocation.lon);
            });
        });
    }

    window.addDirectionsToStation = async function(userLat, userLon, stationLat, stationLon, stationName) {
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (routePopup) {
            map.removeLayer(routePopup);
            routePopup = null;
        }
        const existingInstructions = document.getElementById('instructions');
        if (existingInstructions) existingInstructions.remove();
    
        loadingDiv.textContent = 'Fetching directions...';
        loadingDiv.style.display = 'block';
    
        // Ensure userMarker is visible
        if (!userMarker) {
            userMarker = L.marker([userLat, userLon], { icon: userIcon })
                .addTo(map)
                .bindPopup('Your Location');
        } else {
            userMarker.setLatLng([userLat, userLon]);
        }
    
        const url = `/api/directions/?user_lat=${userLat}&user_lon=${userLon}&station_lat=${stationLat}&station_lon=${stationLon}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response is not JSON');
            }
            const data = await response.json();
            console.log('API Response:', data);
            if (data.error) {
                messageDiv.textContent = 'Could not find a route to this station: ' + data.error;
                messageDiv.style.display = 'block';
                return;
            }
            let latLngs = [];
            try {
                if (data.polyline) {
                    const decodedCoords = polyline.decode(data.polyline);
                    latLngs = decodedCoords.map(coord => [coord[0], coord[1]]);
                    console.log('Decoded latLngs:', latLngs);
                } else {
                    console.warn('No polyline in API response:', data);
                }
            } catch (error) {
                console.error('Error decoding polyline:', error, 'Polyline:', data.polyline);
            }
            routeLayer = L.polyline(latLngs, { color: 'blue', weight: 4 }).addTo(map);
    
            // Extract total time and distance from API response
            let totalDistance = data.total_distance || 'N/A';
            let totalDuration = data.total_duration || 'N/A';
            if (!data.total_distance || !data.total_duration) {
                // Fallback: Calculate totals by summing steps if API values are missing
                const distanceSum = data.instructions.reduce((sum, step) => {
                    const dist = parseFloat(step.distance) || 0;
                    return sum + dist;
                }, 0);
                const durationSum = data.instructions.reduce((sum, step) => {
                    const dur = parseInt(step.duration) || 0;
                    return sum + dur;
                }, 0);
                totalDistance = `${distanceSum.toFixed(1)} km`;
                totalDuration = `${Math.round(durationSum)} min`;
            }
            console.log('Total Distance:', totalDistance, 'Total Duration:', totalDuration);
    
            // Zoom to user’s location first
            map.setView([userLat, userLon], 15);
            console.log('Map view set to user location:', [userLat, userLon]);
    
            // Calculate the midpoint of the route for the popup, or fall back to user location
            let popupPosition = [userLat, userLon]; // Default to user location
            if (latLngs.length > 1) { // Ensure there are enough points
                const midPointIndex = Math.floor(latLngs.length / 2);
                popupPosition = latLngs[midPointIndex];
                console.log('Creating popup at midpoint:', popupPosition, 'Content:', `${totalDuration}, ${totalDistance}`);
    
                // Adjust the map view to include both the user’s location and the popup
                const bounds = L.latLngBounds([
                    [userLat, userLon],
                    popupPosition
                ]);
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                console.log('Map bounds after fitBounds:', bounds.toBBoxString());
            } else {
                console.warn('Not enough points in latLngs to create a popup, using user location:', latLngs);
            }
    
            // Create and display the popup on the route
            routePopup = L.popup({ className: 'route-popup', autoClose: false, closeOnClick: false })
                .setLatLng(popupPosition)
                .setContent(`${totalDuration}, ${totalDistance}`)
                .openOn(map);
            console.log('Popup created and opened at position:', popupPosition, 'Content:', `${totalDuration}, ${totalDistance}`);
    
            clearRouteBtn.style.display = 'block';
            if (data.instructions && data.instructions.length > 0) {
                const instructionsDiv = document.createElement('div');
                instructionsDiv.id = 'instructions';
                instructionsDiv.innerHTML = `
                    <h3>Directions to ${stationName}</h3>
                    <div class="route-summary">${totalDuration}, ${totalDistance}</div>
                    <ol class="step-list">
                        ${data.instructions.map((step, idx) => `
                            <li class="step-item">
                                <div class="step-instruction">${stripHtml(step.instruction)}</div>
                                <div class="step-details">
                                    <small>Distance: ${step.distance}, Duration: ${step.duration}</small>
                                </div>
                            </li>
                        `).join('')}
                    </ol>
                `;
                document.getElementById('sidebar').appendChild(instructionsDiv);
                instructionsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Error fetching directions:', error);
            messageDiv.textContent = 'Failed to load directions: ' + error.message;
            messageDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    };

    window.toggleStationSelection = function(stationLat, stationLon, stationName) {
        const station = { lat: stationLat, lon: stationLon, name: stationName };
        const index = selectedStations.findIndex(s => s.lat === stationLat && s.lon === stationLon);
        if (index === -1) {
            selectedStations.push(station);
            messageDiv.textContent = `${stationName} added to route optimization. (${selectedStations.length} selected)`;
        } else {
            selectedStations.splice(index, 1);
            messageDiv.textContent = `${stationName} removed from route optimization. (${selectedStations.length} selected)`;
        }
        messageDiv.style.display = 'block';
    };

    async function optimizeRouteThroughStations() {
        if (!userLocation) {
            messageDiv.textContent = 'Please set your starting location first.';
            messageDiv.style.display = 'block';
            return;
        }
        if (selectedStations.length < 1) {
            messageDiv.textContent = 'Please select at least one station to optimize a route.';
            messageDiv.style.display = 'block';
            return;
        }
    
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (routePopup) {
            map.removeLayer(routePopup);
            routePopup = null;
        }
        const existingInstructions = document.getElementById('instructions');
        if (existingInstructions) existingInstructions.remove();
    
        loadingDiv.textContent = 'Optimizing route...';
        loadingDiv.style.display = 'block';
    
        // Ensure userMarker is visible
        if (!userMarker) {
            userMarker = L.marker([userLocation.lat, userLocation.lon], { icon: userIcon })
                .addTo(map)
                .bindPopup('Your Location');
        } else {
            userMarker.setLatLng([userLocation.lat, userLocation.lon]);
        }
    
        const waypoints = selectedStations.map(s => `${s.lat},${s.lon}`).join('|');
        const destination = selectedStations[selectedStations.length - 1];
        const url = `/api/optimize-route/?user_lat=${userLocation.lat}&user_lon=${userLocation.lon}&waypoints=${waypoints}&destination_lat=${destination.lat}&destination_lon=${destination.lon}`;
    
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Response is not JSON');
            }
            const data = await response.json();
            console.log('API Response:', data);
            if (data.error) {
                messageDiv.textContent = 'Could not optimize route: ' + data.error;
                messageDiv.style.display = 'block';
                return;
            }
            let latLngs = [];
            try {
                if (data.polyline) {
                    const decodedCoords = polyline.decode(data.polyline);
                    latLngs = decodedCoords.map(coord => [coord[0], coord[1]]);
                    console.log('Decoded latLngs:', latLngs);
                } else {
                    console.warn('No polyline in API response:', data);
                }
            } catch (error) {
                console.error('Error decoding polyline:', error, 'Polyline:', data.polyline);
            }
            routeLayer = L.polyline(latLngs, { color: 'green', weight: 4 }).addTo(map);
    
            // Extract total time and distance from API response
            let totalDistance = data.total_distance || 'N/A';
            let totalDuration = data.total_duration || 'N/A';
            if (!data.total_distance || !data.total_duration) {
                // Fallback: Calculate totals by summing steps if API values are missing
                const distanceSum = data.instructions.reduce((sum, step) => {
                    const dist = parseFloat(step.distance) || 0;
                    return sum + dist;
                }, 0);
                const durationSum = data.instructions.reduce((sum, step) => {
                    const dur = parseInt(step.duration) || 0;
                    return sum + dur;
                }, 0);
                totalDistance = `${distanceSum.toFixed(1)} km`;
                totalDuration = `${Math.round(durationSum)} min`;
            }
            console.log('Total Distance:', totalDistance, 'Total Duration:', totalDuration);
    
            // Zoom to user’s location first
            map.setView([userLocation.lat, userLocation.lon], 15);
            console.log('Map view set to user location:', [userLocation.lat, userLocation.lon]);
    
            // Calculate the midpoint of the route for the popup, or fall back to user location
            let popupPosition = [userLocation.lat, userLocation.lon]; // Default to user location
            if (latLngs.length > 1) { // Ensure there are enough points
                const midPointIndex = Math.floor(latLngs.length / 2);
                popupPosition = latLngs[midPointIndex];
                console.log('Creating popup at midpoint:', popupPosition, 'Content:', `${totalDuration}, ${totalDistance}`);
    
                // Adjust the map view to include both the user’s location and the popup
                const bounds = L.latLngBounds([
                    [userLocation.lat, userLocation.lon],
                    popupPosition
                ]);
                map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                console.log('Map bounds after fitBounds:', bounds.toBBoxString());
            } else {
                console.warn('Not enough points in latLngs to create a popup, using user location:', latLngs);
            }
    
            // Create and display the popup on the route
            routePopup = L.popup({ className: 'route-popup', autoClose: false, closeOnClick: false })
                .setLatLng(popupPosition)
                .setContent(`${totalDuration}, ${totalDistance}`)
                .openOn(map);
            console.log('Popup created and opened at position:', popupPosition, 'Content:', `${totalDuration}, ${totalDistance}`);
    
            clearRouteBtn.style.display = 'block';
    
            if (data.instructions && data.instructions.length > 0) {
                const instructionsDiv = document.createElement('div');
                instructionsDiv.id = 'instructions';
                instructionsDiv.innerHTML = `
                    <h3>Optimized Route</h3>
                    <div class="route-summary">${totalDuration}, ${totalDistance}</div>
                    <p>Visiting ${selectedStations.length} stations in optimized order:</p>
                    <ol class="step-list">
                        ${data.instructions.map((step, idx) => `
                            <li class="step-item">
                                <div class="step-instruction">${stripHtml(step.instruction)}</div>
                                <div class="step-details">
                                    <small>Distance: ${step.distance}, Duration: ${step.duration}</small>
                                </div>
                            </li>
                        `).join('')}
                    </ol>
                    <p>Optimized order: ${data.optimized_waypoints.map((wp, idx) => `${idx + 1}. ${selectedStations.find(s => s.lat === wp[0] && s.lon === wp[1]).name}`).join(', ')}</p>
                `;
                document.getElementById('sidebar').appendChild(instructionsDiv);
                instructionsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (error) {
            console.error('Error optimizing route:', error);
            messageDiv.textContent = 'Failed to optimize route: ' + error.message;
            messageDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    }
    clearRouteBtn.addEventListener('click', () => {
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
            clearRouteBtn.style.display = 'none';
        }
        if (routePopup) {
            map.removeLayer(routePopup);
            routePopup = null;
        }
        const instructionsDiv = document.getElementById('instructions');
        if (instructionsDiv) instructionsDiv.remove();
        if (markers.getLayers().length > 0) map.fitBounds(markers.getBounds());
    });

    resetMapBtn.addEventListener('click', () => {
        markers.clearLayers();
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (routePopup) {
            map.removeLayer(routePopup);
            routePopup = null;
        }
        if (circleLayer) {
            map.removeLayer(circleLayer);
            circleLayer = null;
        }
        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }
        if (heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = null;
            toggleHeatmapBtn.textContent = 'Show Heatmap';
        }
        const instructionsDiv = document.getElementById('instructions');
        if (instructionsDiv) instructionsDiv.remove();
        clearRouteBtn.style.display = 'none';
        messageDiv.style.display = 'none';
        selectedStations = [];
        map.setView([20.5937, 78.9629], 5);
        radiusSlider.value = 10;
        radiusSlider.nextElementSibling.value = 10;
    });

    setLocationBtn.addEventListener('click', () => {
        filterMode = 'nearby';
        cityInput.value = '';
        stateInput.value = '';
        setUserLocation((lat, lon) => {
            messageDiv.textContent = `Starting location set to (${lat}, ${lon}). Showing nearby stations.`;
            messageDiv.style.display = 'block';
            fetchStations();
        });
    });

    async function fetchStations() {
        let url = `/api/stations/`;
        
        loadingDiv.textContent = 'Fetching stations...';
        loadingDiv.style.display = 'block';

        if (userLocation) {
            const userLat = userLocation.lat;
            const userLon = userLocation.lon;

            if (filterMode === 'nearby') {
                const distance = radiusSlider.value;
                url += `?lat=${userLat}&lon=${userLon}&distance=${distance}`;
                if (circleLayer) map.removeLayer(circleLayer);
                circleLayer = L.circle([userLat, userLon], { radius: distance * 1000, color: 'blue', fillOpacity: 0.1 }).addTo(map);
                map.setView([userLat, userLon], 13);
                if (userMarker) map.removeLayer(userMarker);
                userMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(map).bindPopup('Your Location');
                fetchAndDisplayStations(url, userLat, userLon);
            } else if (filterMode === 'city') {
                if (circleLayer) map.removeLayer(circleLayer); circleLayer = null;
                if (userMarker) map.removeLayer(userMarker); userMarker = null;
                if (cityInput.value) {
                    const cityValue = toTitleCase(cityInput.value);
                    cityInput.value = cityValue;
                    url += `?city=${cityValue}`;
                    fetchAndDisplayStations(url, userLat, userLon);
                } else {
                    loadingDiv.style.display = 'none';
                }
            } else if (filterMode === 'state') {
                if (circleLayer) map.removeLabel(circleLayer); circleLayer = null;
                if (userMarker) map.removeLayer(userMarker); userMarker = null;
                if (stateInput.value) {
                    const stateValue = toTitleCase(stateInput.value);
                    stateInput.value = stateValue;
                    url += `?state=${stateValue}`;
                    fetchAndDisplayStations(url, userLat, userLon);
                } else {
                    loadingDiv.style.display = 'none';
                }
            } else if (filterMode === 'all-india') {
                if (circleLayer) map.removeLayer(circleLayer); circleLayer = null;
                if (userMarker) map.removeLayer(userMarker); userMarker = null;
                url += '?all-india=true';
                fetchAndDisplayStations(url);
            }
        } else {
            setUserLocation((userLat, userLon) => {
                if (filterMode === 'nearby') {
                    const distance = radiusSlider.value;
                    url += `?lat=${userLat}&lon=${userLon}&distance=${distance}`;
                    if (circleLayer) map.removeLayer(circleLayer);
                    circleLayer = L.circle([userLat, userLon], { radius: distance * 1000, color: 'blue', fillOpacity: 0.1 }).addTo(map);
                    map.setView([userLat, userLon], 13);
                    if (userMarker) map.removeLayer(userMarker);
                    userMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(map).bindPopup('Your Location');
                    fetchAndDisplayStations(url, userLat, userLon);
                } else if (filterMode === 'city') {
                    if (circleLayer) map.removeLayer(circleLayer); circleLayer = null;
                    if (userMarker) map.removeLayer(userMarker); userMarker = null;
                    if (cityInput.value) {
                        const cityValue = toTitleCase(cityInput.value);
                        cityInput.value = cityValue;
                        url += `?city=${cityValue}`;
                        fetchAndDisplayStations(url, userLat, userLon);
                    } else {
                        loadingDiv.style.display = 'none';
                    }
                } else if (filterMode === 'state') {
                    if (circleLayer) map.removeLayer(circleLayer); circleLayer = null;
                    if (userMarker) map.removeLayer(userMarker); userMarker = null;
                    if (stateInput.value) {
                        const stateValue = toTitleCase(stateInput.value);
                        stateInput.value = stateValue;
                        url += `?state=${stateValue}`;
                        fetchAndDisplayStations(url, userLat, userLon);
                    } else {
                        loadingDiv.style.display = 'none';
                    }
                } else if (filterMode === 'all-india') {
                    if (circleLayer) map.removeLayer(circleLayer); circleLayer = null;
                    if (userMarker) map.removeLayer(userMarker); userMarker = null;
                    url += '?all-india=true';
                    fetchAndDisplayStations(url);
                }
            });
        }
    }

    function fetchAndDisplayStations(url, userLat = null, userLon = null) {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                markers.clearLayers();
                const stations = Array.isArray(data) ? data : (data.results || []);
                if (!stations.length) {
                    if (filterMode === 'nearby') {
                        messageDiv.textContent = "No stations nearby, increase the radius.";
                    } else if ((filterMode === 'city' && cityInput.value) || (filterMode === 'state' && stateInput.value)) {
                        messageDiv.textContent = "No stations found.";
                    } else if (filterMode === 'all-india') {
                        messageDiv.textContent = "No stations found in India.";
                    }
                    messageDiv.style.display = 'block';
                    loadingDiv.style.display = 'none';
                    return;
                }

                stations.forEach(station => {
                    if (!station.latitude || !station.longitude) {
                        console.error(`Station ${station.name} has invalid coordinates`);
                        return;
                    }

                    let popupContent;
                    if (userLat && userLon) {
                        popupContent = `
                            <strong>${station.name} (${station.city})</strong><br>
                            ${station.distance ? `Distance: ${station.distance} km` : ''}<br>
                            Operator: ${station.operator || 'N/A'}<br>
                            Connection Type: ${station.connection_type || 'N/A'}<br>
                            Charging Points: ${station.charging_points || 'N/A'}<br>
                            Status: ${station.status || 'N/A'}<br>
                            <button onclick="addDirectionsToStation(${userLat}, ${userLon}, ${station.latitude}, ${station.longitude}, '${station.name}')">Get Directions</button>
                            <button onclick="toggleStationSelection(${station.latitude}, ${station.longitude}, '${station.name}')">
                                ${selectedStations.some(s => s.lat === station.latitude && s.lon === station.longitude) ? 'Remove from Route' : 'Add to Route'}
                            </button>
                        `;
                    } else {
                        popupContent = `
                            <strong>${station.name}</strong><br>
                            City: ${station.city}<br>
                            Operator: ${station.operator || 'N/A'}<br>
                            Connection Type: ${station.connection_type || 'N/A'}<br>
                            Charging Points: ${station.charging_points || 'N/A'}<br>
                            Status: ${station.status || 'N/A'}<br>
                            <button onclick="toggleStationSelection(${station.latitude}, ${station.longitude}, '${station.name}')">
                                ${selectedStations.some(s => s.lat === station.latitude && s.lon === station.longitude) ? 'Remove from Route' : 'Add to Route'}
                            </button>
                        `;
                    }

                    L.marker([station.latitude, station.longitude], { icon: stationIcon })
                        .addTo(markers)
                        .bindPopup(popupContent);
                });

                if (markers.getLayers().length > 0) {
                    map.fitBounds(markers.getBounds());
                }
            })
            .catch(error => {
                console.error("Fetch Error:", error);
                messageDiv.textContent = 'Failed to fetch stations: ' + error.message;
                messageDiv.style.display = 'block';
            })
            .finally(() => {
                loadingDiv.style.display = 'none';
            });
    }

    async function fetchAndDisplayHeatmap() {
        let url = '/api/stations/?heatmap=true';
        
        if (filterMode === 'city' && cityInput.value) {
            url += `&city=${toTitleCase(cityInput.value)}`;
        } else if (filterMode === 'state' && stateInput.value) {
            url += `&state=${toTitleCase(stateInput.value)}`;
        } else if (filterMode === 'nearby' && userLocation) {
            const distance = radiusSlider.value;
            url += `&lat=${userLocation.lat}&lon=${userLocation.lon}&distance=${distance}`;
        } else if (filterMode === 'all-india') {
            url += '&all-india=true';
        }

        loadingDiv.textContent = 'Fetching heatmap data...';
        loadingDiv.style.display = 'block';

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();

            if (!data.heatmap_data || data.heatmap_data.length === 0) {
                messageDiv.textContent = filterMode === 'all-india' ? 'No stations available in India for heatmap.' : 'No stations available for heatmap.';
                messageDiv.style.display = 'block';
                return;
            }

            const heatData = data.heatmap_data.map(point => [point[0], point[1], 0.5]);
            if (heatLayer) map.removeLayer(heatLayer);
            heatLayer = L.heatLayer(heatData, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
                gradient: { 0.2: 'blue', 0.5: 'yellow', 1.0: 'red' }
            }).addTo(map);
            const bounds = L.latLngBounds(heatData.map(p => [p[0], p[1]]));
            map.fitBounds(bounds);
        } catch (error) {
            console.error('Error fetching heatmap data:', error);
            messageDiv.textContent = 'Failed to load heatmap: ' + error.message;
            messageDiv.style.display = 'block';
        } finally {
            loadingDiv.style.display = 'none';
        }
    }

    findNearbyBtn.addEventListener('click', () => {
        filterMode = 'nearby';
        cityInput.value = '';
        stateInput.value = '';
        if (heatLayer) map.removeLayer(heatLayer);
        fetchStations();
    });

    findByCityBtn.addEventListener('click', () => {
        filterMode = 'city';
        radiusSlider.value = 10;
        stateInput.value = '';
        if (heatLayer) map.removeLayer(heatLayer);
        fetchStations();
    });

    findByStateBtn.addEventListener('click', () => {
        filterMode = 'state';
        radiusSlider.value = 10;
        cityInput.value = '';
        if (heatLayer) map.removeLayer(heatLayer);
        fetchStations();
    });

    const debouncedFetchStations = debounce(fetchStations, 500);
    radiusSlider.addEventListener('input', () => {
        if (filterMode === 'nearby') debouncedFetchStations();
    });

    cityInput.addEventListener('input', () => {
        if (filterMode === 'city') {
            const cityValue = toTitleCase(cityInput.value);
            cityInput.value = cityValue;
            fetchStations();
        }
    });

    stateInput.addEventListener('input', () => {
        if (filterMode === 'state') {
            const stateValue = toTitleCase(stateInput.value);
            stateInput.value = stateValue;
            fetchStations();
        }
    });

    toggleHeatmapBtn.addEventListener('click', () => {
        if (heatLayer && map.hasLayer(heatLayer)) {
            map.removeLayer(heatLayer);
            heatLayer = null;
            toggleHeatmapBtn.textContent = 'Show Heatmap';
            fetchStations();
        } else {
            markers.clearLayers();
            if (circleLayer) map.removeLayer(circleLayer);
            fetchAndDisplayHeatmap();
            toggleHeatmapBtn.textContent = 'Hide Heatmap';
        }
    });

    showAllIndiaBtn.addEventListener('click', () => {
        filterMode = 'all-india';
        cityInput.value = '';
        stateInput.value = '';
        if (heatLayer) {
            map.removeLayer(heatLayer);
            heatLayer = null;
            toggleHeatmapBtn.textContent = 'Show Heatmap';
        }
        fetchStations();
    });

    optimizeRouteBtn.addEventListener('click', () => {
        optimizeRouteThroughStations();
    });

    fetchStations();
}

setTimeout(() => initializeApp(), 1000);