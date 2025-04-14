from rest_framework import generics, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import StationCharging
from .serializers import StationSerializer
from rest_framework.response import Response
from rest_framework import status
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.contrib.gis.geos import Point 
from django.shortcuts import render
import googlemaps
from django.conf import settings
from django.http import JsonResponse

class StationList(generics.ListAPIView):
    queryset = StationCharging.objects.all()
    serializer_class = StationSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['city', 'state', 'connection_type', 'charging_points', 'operator']
    search_fields = ['name', 'city', 'state']
    pagination_class = None  # Disable pagination globally (optional)

    def get_queryset(self):
        queryset = super().get_queryset()
        lat = self.request.query_params.get('lat', None)
        lon = self.request.query_params.get('lon', None)
        distance = self.request.query_params.get('distance', None)
        heatmap = self.request.query_params.get('heatmap', None)

        if heatmap != 'true' and lat and lon and distance:
            try:
                lat = float(lat)
                lon = float(lon)
                distance = float(distance)
                reference_point = Point(lon, lat, srid=4326)
                queryset = queryset.annotate(
                    distance=Distance('geom', reference_point)
                ).filter(
                    geom__distance_lte=(reference_point, D(km=distance))
                ).order_by('distance')
            except (ValueError, TypeError):
                pass

        return queryset

    def list(self, request, *args, **kwargs):
        heatmap = request.query_params.get('heatmap', None)
        all_india = request.query_params.get('all-india', None)

        if heatmap == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            if not queryset.exists():
                return Response({'heatmap_data': [], 'message': 'No stations found'}, status=status.HTTP_200_OK)
            heat_data = [[station.latitude, station.longitude] for station in queryset]
            return Response({'heatmap_data': heat_data}, status=status.HTTP_200_OK)

        if all_india == 'true':
            queryset = self.filter_queryset(self.get_queryset())
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

def get_directions(request):
    gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    
    try:
        user_lat = float(request.GET.get('user_lat'))
        user_lon = float(request.GET.get('user_lon'))
        station_lat = float(request.GET.get('station_lat'))
        station_lon = float(request.GET.get('station_lon'))
    except (ValueError, TypeError) as e:
        return JsonResponse({'error': 'Invalid coordinates provided'}, status=400)
    
    try:
        directions_result = gmaps.directions(
        (user_lat, user_lon),
        (station_lat, station_lon),
        mode="driving",
        units="metric",
        language="en"  # Request English instructions
)
        
        if not directions_result:
            return JsonResponse({'error': 'No route found'}, status=404)
        
        polyline = directions_result[0]['overview_polyline']['points']
        instructions = [
            {
                'instruction': step['html_instructions'],
                'distance': step.get('distance', {}).get('text', 'N/A'),
                'duration': step.get('duration', {}).get('text', 'N/A')
            }
            for step in directions_result[0]['legs'][0]['steps']
        ]
        # Calculate total distance and duration
        total_distance = directions_result[0]['legs'][0]['distance']['text']
        total_duration = directions_result[0]['legs'][0]['duration']['text']
        return JsonResponse({
            'polyline': polyline,
            'instructions': instructions,
            'total_distance': total_distance,
            'total_duration': total_duration
        })
    except googlemaps.exceptions.ApiError as e:
        print(f"Google Maps API Error: {str(e)}")
        return JsonResponse({'error': f'Google Maps API Error: {str(e)}'}, status=500)
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return JsonResponse({'error': f'Unexpected error: {str(e)}'}, status=500)

def optimize_route(request):
    gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)
    
    try:
        user_lat = float(request.GET.get('user_lat'))
        user_lon = float(request.GET.get('user_lon'))
        waypoints = request.GET.get('waypoints')
        destination_lat = float(request.GET.get('destination_lat'))
        destination_lon = float(request.GET.get('destination_lon'))
        
        if not waypoints:
            return JsonResponse({'error': 'No waypoints provided'}, status=400)
        
        waypoint_list = []
        for wp in waypoints.split('|'):
            lat, lon = map(float, wp.split(','))
            waypoint_list.append((lat, lon))
        
        directions_result = gmaps.directions(
    (user_lat, user_lon),
    (destination_lat, destination_lon),
    waypoints=waypoint_list,
    optimize_waypoints=True,
    mode="driving",
    units="metric",
    language="en"  # Request English instructions
)
        
        if not directions_result:
            return JsonResponse({'error': 'No optimized route found'}, status=404)
        
        polyline = directions_result[0]['overview_polyline']['points']
        instructions = []
        total_distance = 0
        total_duration = 0
        for leg in directions_result[0]['legs']:
            for step in leg['steps']:
                instructions.append({
                    'instruction': step['html_instructions'],
                    'distance': step.get('distance', {}).get('text', 'N/A'),
                    'duration': step.get('duration', {}).get('text', 'N/A')
                })
            total_distance += leg['distance']['value']  # In meters
            total_duration += leg['duration']['value']  # In seconds
        
        # Convert total distance to km and total duration to minutes
        total_distance_km = total_distance / 1000  # Convert meters to km
        total_duration_min = total_duration / 60  # Convert seconds to minutes
        total_distance_text = f"{total_distance_km:.1f} km"
        total_duration_text = f"{int(total_duration_min)} min"
        
        waypoint_order = directions_result[0].get('waypoint_order', [])
        optimized_waypoints = [waypoint_list[i] for i in waypoint_order]
        
        return JsonResponse({
            'polyline': polyline,
            'instructions': instructions,
            'optimized_waypoints': optimized_waypoints,
            'total_distance': total_distance_text,
            'total_duration': total_duration_text
        })
    except (ValueError, TypeError) as e:
        return JsonResponse({'error': 'Invalid coordinates provided'}, status=400)
    except googlemaps.exceptions.ApiError as e:
        print(f"Google Maps API Error: {str(e)}")
        return JsonResponse({'error': f'Google Maps API Error: {str(e)}'}, status=500)
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return JsonResponse({'error': f'Unexpected error: {str(e)}'}, status=500)

def index(request):
    return render(request, 'index.html')