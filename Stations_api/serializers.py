from rest_framework import serializers
from .models import StationCharging


class StationSerializer(serializers.ModelSerializer):
    distance = serializers.SerializerMethodField()
    line_distance = serializers.SerializerMethodField()
      
    class Meta:
        model = StationCharging
        fields = '__all__'

    def get_distance(self, obj):
        if hasattr(obj, 'distance'):
            return obj.distance.km 
        return None

    def get_line_distance(self, obj):
        if hasattr(obj, 'line_distance'):
            return obj.line_distance.km
        return None